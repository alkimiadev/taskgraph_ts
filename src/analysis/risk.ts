// riskPath, riskDistribution
//
// Risk analysis functions:
// - riskPath: finds the highest-risk path through the graph
// - riskDistribution: groups all tasks by their risk category

import type { TaskGraph } from "../graph/construction.js";
import type { TaskRisk } from "../schema/enums.js";
import type { RiskPathResult, RiskDistributionResult } from "../schema/results.js";
import { weightedCriticalPath } from "./critical-path.js";
import { riskWeight, impactWeight } from "./defaults.js";

// ---------------------------------------------------------------------------
// riskPath
// ---------------------------------------------------------------------------

/**
 * Find the highest-risk path through the graph and its total risk score.
 *
 * Calls `weightedCriticalPath` with a weight function of
 * `riskWeight(risk) * impactWeight(impact)`, then sums the weight values
 * along the resulting path to produce `totalRisk`.
 *
 * @param graph - The task graph to analyze
 * @returns RiskPathResult with the path (ordered task IDs) and totalRisk
 * @throws {CircularDependencyError} If the graph contains cycles
 */
export function riskPath(graph: TaskGraph): RiskPathResult {
  const raw = graph.raw;

  // Define the risk weight function: riskWeight * impactWeight
  const riskWeightFn = (
    _taskId: string,
    attrs: { risk?: TaskRisk; impact?: string },
  ): number => {
    const risk = attrs.risk ?? "medium";
    const impact = (attrs.impact ?? "isolated") as Parameters<typeof impactWeight>[0];
    return riskWeight(risk) * impactWeight(impact);
  };

  const path = weightedCriticalPath(graph, riskWeightFn);

  // Compute totalRisk as the sum of weight values on the path
  let totalRisk = 0;
  for (const taskId of path) {
    const attrs = raw.getNodeAttributes(taskId);
    const risk = attrs.risk ?? "medium";
    const impact = (attrs.impact ?? "isolated") as Parameters<typeof impactWeight>[0];
    totalRisk += riskWeight(risk) * impactWeight(impact);
  }

  return { path, totalRisk };
}

// ---------------------------------------------------------------------------
// riskDistribution
// ---------------------------------------------------------------------------

const RISK_BUCKETS: TaskRisk[] = ["trivial", "low", "medium", "high", "critical"];

/**
 * Group all tasks in the graph by their risk category.
 *
 * Tasks with `risk: undefined` (not assessed) go into the `unspecified` bucket.
 * Each task appears in exactly one bucket.
 *
 * @param graph - The task graph to analyze
 * @returns RiskDistributionResult with task ID arrays per risk bucket
 */
export function riskDistribution(graph: TaskGraph): RiskDistributionResult {
  const result: RiskDistributionResult = {
    trivial: [],
    low: [],
    medium: [],
    high: [],
    critical: [],
    unspecified: [],
  };

  const raw = graph.raw;
  for (const nodeId of raw.nodes()) {
    const attrs = raw.getNodeAttributes(nodeId);
    const risk = attrs.risk;

    if (risk === undefined || risk === null) {
      result.unspecified.push(nodeId);
    } else if (RISK_BUCKETS.includes(risk as TaskRisk)) {
      result[risk as TaskRisk].push(nodeId);
    } else {
      // Unknown risk value — treat as unspecified
      result.unspecified.push(nodeId);
    }
  }

  return result;
}