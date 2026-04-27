// shouldDecomposeTask
//
// Pure function — takes node attributes (not a graph) and determines
// whether a task should be decomposed based on risk and scope thresholds.
//
// Decomposition threshold:
// - risk >= "high" OR scope >= "broad"
//
// Unassessed tasks (null/undefined risk or scope) are never flagged —
// resolveDefaults fills them with "medium" risk (below threshold) and
// "narrow" scope (below threshold).

import type { TaskGraphNodeAttributes } from "../schema/graph.js";
import type { TaskRisk, TaskScope } from "../schema/enums.js";
import type { DecomposeResult } from "../schema/results.js";
import {
  resolveDefaults,
  scopeCostEstimate,
  riskSuccessProbability,
} from "./defaults.js";

// ---------------------------------------------------------------------------
// Decomposition thresholds
// ---------------------------------------------------------------------------

/** Risk levels at or above this threshold trigger decomposition. */
const RISK_DECOMPOSE_THRESHOLD: TaskRisk[] = ["high", "critical"];

/** Scope levels at or above this threshold trigger decomposition. */
const SCOPE_DECOMPOSE_THRESHOLD: TaskScope[] = ["broad", "system"];

// ---------------------------------------------------------------------------
// shouldDecomposeTask
// ---------------------------------------------------------------------------

/**
 * Determine whether a task should be decomposed based on its risk and scope.
 *
 * Internally calls `resolveDefaults` to handle nullable `risk` and `scope`
 * fields. Unassessed fields use defaults that are below the decomposition
 * threshold, so only explicitly-assessed high-risk or broad-scope tasks are
 * flagged.
 *
 * @param attrs - Task node attributes (nullable categorical fields accepted)
 * @returns DecomposeResult with shouldDecompose flag and specific reasons
 */
export function shouldDecomposeTask(
  attrs: Partial<TaskGraphNodeAttributes> & Pick<TaskGraphNodeAttributes, "name">,
): DecomposeResult {
  const resolved = resolveDefaults(attrs);

  const reasons: string[] = [];

  // Check risk threshold
  if (RISK_DECOMPOSE_THRESHOLD.includes(resolved.risk)) {
    const failureProb = (1 - riskSuccessProbability(resolved.risk)).toFixed(2);
    reasons.push(`risk: ${resolved.risk} — failure probability ${failureProb}`);
  }

  // Check scope threshold
  if (SCOPE_DECOMPOSE_THRESHOLD.includes(resolved.scope)) {
    const costEst = scopeCostEstimate(resolved.scope).toFixed(1);
    reasons.push(`scope: ${resolved.scope} — cost estimate ${costEst}`);
  }

  return {
    shouldDecompose: reasons.length > 0,
    reasons,
  };
}