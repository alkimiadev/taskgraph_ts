import type {
  EvConfig,
  EvResult,
  WorkflowCostOptions,
  WorkflowCostResult,
} from "../schema/results.js";
import type { TaskGraphInner } from "../graph/construction.js";
import { topologicalOrder } from "../graph/queries.js";
import { resolveDefaults } from "./defaults.js";

/**
 * Calculate the expected value (EV) of a task.
 *
 * Pure math function — takes numeric inputs, returns EV result.
 * No graph dependency.
 *
 * Formula:
 *   expectedRetries = (1 - p) / p  when p > 0, else 0  (geometric series)
 *   C_success = scopeCost * impactWeight
 *   C_fail    = scopeCost * impactWeight + fallbackCost + timeLost * expectedRetries
 *   EV        = p * C_success + (1 - p) * C_fail
 *
 * When `config.retries` is provided and > 0, `expectedRetries` is capped at `retries`.
 * When `config.valueRate` is non-zero, the final EV is multiplied by `valueRate`.
 *
 * @param p - Probability of success (0 to 1)
 * @param scopeCost - Cost estimate from scope (1.0–5.0)
 * @param impactWeight - Impact weight (1.0–3.0)
 * @param config - Optional configuration: retries, fallbackCost, timeLost, valueRate
 * @returns EvResult with ev, pSuccess, and expectedRetries
 */
export function calculateTaskEv(
  p: number,
  scopeCost: number,
  impactWeight: number,
  config?: EvConfig,
): EvResult {
  const retries = config?.retries ?? 0;
  const fallbackCost = config?.fallbackCost ?? 0;
  const timeLost = config?.timeLost ?? 0;
  const valueRate = config?.valueRate ?? 0;

  // Expected retries: geometric series (1-p)/p when p > 0
  let expectedRetries = p > 0 ? (1 - p) / p : 0;

  // Cap at configured max retries when retries > 0
  if (retries > 0 && expectedRetries > retries) {
    expectedRetries = retries;
  }

  // C_success and C_fail: impactWeight scales scopeCost
  const cSuccess = scopeCost * impactWeight;
  const cFail = scopeCost * impactWeight + fallbackCost + timeLost * expectedRetries;

  // EV = P_success * C_success + (1 - P_success) * C_fail
  let ev = p * cSuccess + (1 - p) * cFail;

  // Apply value rate conversion when configured
  if (valueRate !== 0) {
    ev = ev * valueRate;
  }

  return { ev, pSuccess: p, expectedRetries };
}

/**
 * Compute the effective probability of a task given upstream propagation.
 *
 * Internal helper — not exported on the public API surface but used by
 * `workflowCost` to compute `pEffective` for each task.
 *
 * Algorithm (dag-propagate mode):
 * 1. Start with the task's intrinsic probability
 * 2. For each prerequisite, compute inherited quality:
 *    `parentP + (1 - parentP) × qualityRetention`
 * 3. Multiply all inherited quality factors together with intrinsic probability:
 *    `pEffective = pIntrinsic × ∏(inheritedQualityFactors)`
 *
 * In `independent` mode: `pEffective = pIntrinsic` (no propagation).
 *
 * @param taskId - The task ID to compute effective probability for
 * @param graph - The graphology graph instance
 * @param upstreamSuccessProbs - Map of task IDs → their actual success probabilities (for propagation)
 * @param defaultQualityRetention - Default quality retention per edge (0.0–1.0), default 0.9
 * @param propagationMode - 'dag-propagate' or 'independent'
 * @param pIntrinsic - The task's intrinsic success probability
 * @returns The effective probability after upstream propagation
 */
export function computeEffectiveP(
  taskId: string,
  graph: TaskGraphInner,
  upstreamSuccessProbs: Map<string, number>,
  defaultQualityRetention: number,
  propagationMode: "independent" | "dag-propagate",
  pIntrinsic: number,
): number {
  // Independent mode: no propagation at all
  if (propagationMode === "independent") {
    return pIntrinsic;
  }

  // dag-propagate mode: compute inherited quality from each prerequisite
  const prereqs = graph.inNeighbors(taskId);

  // No prerequisites → pEffective = pIntrinsic
  if (prereqs.length === 0) {
    return pIntrinsic;
  }

  // Compute inherited quality factor for each prerequisite
  let inheritedProduct = 1.0;
  for (const parentId of prereqs) {
    const parentP = upstreamSuccessProbs.get(parentId);
    // Parent should always be in upstreamSuccessProbs since we process
    // in topological order, but guard against missing entries
    if (parentP === undefined) {
      continue;
    }

    // Get per-edge qualityRetention: check edge attributes first, fall back to default
    const edgeKey = `${parentId}->${taskId}`;
    let qualityRetention = defaultQualityRetention;
    if (graph.hasEdge(edgeKey)) {
      const edgeAttrs = graph.getEdgeAttributes(edgeKey);
      if (edgeAttrs.qualityRetention !== undefined) {
        qualityRetention = edgeAttrs.qualityRetention;
      }
    }

    // Inherited quality: parentP + (1 - parentP) × qualityRetention
    // - qualityRetention=0.0 → no retention → inheritedQuality = parentP (full propagation)
    // - qualityRetention=1.0 → full retention → inheritedQuality = 1.0 (independent)
    const inheritedQuality = parentP + (1 - parentP) * qualityRetention;
    inheritedProduct *= inheritedQuality;
  }

  return pIntrinsic * inheritedProduct;
}

/**
 * Compute the total workflow cost using DAG-propagation probability model.
 *
 * Processes tasks in topological order, computing effective probability for each
 * task by combining its intrinsic probability with upstream propagation quality
 * factors. Each task's EV is computed using `calculateTaskEv`.
 *
 * **Completed task semantics**: When `includeCompleted: false`, tasks with
 * `status: "completed"` are excluded from the result's task list, but they
 * **remain in the propagation chain** with p=1.0. Removing completed tasks from
 * propagation would worsen downstream probability estimates.
 *
 * @param graph - The graphology graph instance
 * @param options - Optional configuration for the analysis
 * @returns WorkflowCostResult with per-task entries and aggregate totals
 * @throws {CircularDependencyError} If the graph contains cycles
 */
export function workflowCost(
  graph: TaskGraphInner,
  options?: WorkflowCostOptions,
): WorkflowCostResult {
  const propagationMode = options?.propagationMode ?? "dag-propagate";
  const defaultQualityRetention = options?.defaultQualityRetention ?? 0.9;
  const includeCompleted = options?.includeCompleted ?? false;

  // Get topological order — throws CircularDependencyError if cyclic
  const topoOrder = topologicalOrder(graph);

  // Map of task IDs → their actual success probability for downstream propagation
  const upstreamSuccessProbs = new Map<string, number>();

  // Per-task results
  const taskEntries: WorkflowCostResult["tasks"] = [];

  for (const taskId of topoOrder) {
    const nodeAttrs = graph.getNodeAttributes(taskId);
    const resolved = resolveDefaults(nodeAttrs);
    const pIntrinsic = resolved.successProbability;

    // Determine the probability to propagate downstream for this task
    let propagationP: number;
    let pEffective: number;

    // Completed tasks propagate with p=1.0 when includeCompleted is false
    const isCompleted = nodeAttrs.status === "completed";

    if (isCompleted && !includeCompleted) {
      // Completed + excluded: propagate p=1.0, compute pEffective normally but
      // for propagation purposes the task is a guaranteed success
      pEffective = computeEffectiveP(
        taskId,
        graph,
        upstreamSuccessProbs,
        defaultQualityRetention,
        propagationMode,
        pIntrinsic,
      );
      propagationP = 1.0;
    } else {
      // Normal task: compute pEffective and use it for downstream propagation
      pEffective = computeEffectiveP(
        taskId,
        graph,
        upstreamSuccessProbs,
        defaultQualityRetention,
        propagationMode,
        pIntrinsic,
      );
      propagationP = pEffective;
    }

    // Store for downstream propagation
    upstreamSuccessProbs.set(taskId, propagationP);

    // Skip completed tasks from the result when includeCompleted is false
    if (isCompleted && !includeCompleted) {
      continue;
    }

    // Calculate EV using pEffective
    const evResult = calculateTaskEv(
      pEffective,
      resolved.costEstimate,
      resolved.impactWeight,
    );

    taskEntries.push({
      taskId,
      name: resolved.name,
      ev: evResult.ev,
      pIntrinsic,
      pEffective,
      probability: pEffective,
      scopeCost: resolved.costEstimate,
      impactWeight: resolved.impactWeight,
    });
  }

  // Apply limit if specified
  const limitedEntries = options?.limit !== undefined
    ? taskEntries.slice(0, options.limit)
    : taskEntries;

  // Compute totals
  const totalEv = limitedEntries.reduce((sum, entry) => sum + entry.ev, 0);
  const averageEv = limitedEntries.length > 0 ? totalEv / limitedEntries.length : 0;

  return {
    tasks: limitedEntries,
    totalEv,
    averageEv,
    propagationMode,
  };
}