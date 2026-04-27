// bottlenecks (graphology betweenness)

import { centrality } from 'graphology-metrics';
import type { TaskGraph } from '../graph/index.js';

/**
 * Result of bottleneck analysis: a task ID paired with its betweenness centrality score.
 *
 * Higher scores indicate the task lies on more shortest paths between other
 * nodes, making it a structural bottleneck — delaying or failing this task
 * has outsized impact on the overall workflow.
 */
export interface BottleneckResult {
  taskId: string;
  score: number;
}

/**
 * Compute bottleneck scores for all tasks in the graph using betweenness centrality.
 *
 * Betweenness centrality measures the fraction of shortest paths between all
 * node pairs that pass through a given node. Nodes with high betweenness are
 * structural bottlenecks: they sit on the most shortest paths and their
 * delay or failure disrupts the most communication/routes in the graph.
 *
 * Uses `graphology-metrics` betweenness centrality with `normalized: true`,
 * which produces scores in the **0.0–1.0** range. For disconnected graphs,
 * betweenness is 0 for nodes in components with fewer than 3 nodes (no
 * shortest paths can traverse through them between distinct endpoints).
 *
 * All tasks are included in the result, even those with score 0 (they are
 * not bottlenecks). Results are sorted by score descending (most critical
 * bottlenecks first).
 *
 * @param graph - The task graph to analyze
 * @returns Array of `{ taskId, score }` sorted by score descending
 */
export function bottlenecks(graph: TaskGraph): BottleneckResult[] {
  const raw = graph.raw;

  // Edge case: empty graph — graphology-metrics betweenness centrality
  // throws on an empty graph (mnemonist FixedStack requires positive capacity).
  // Return an empty array since there are no nodes to score.
  if (raw.order === 0) {
    return [];
  }

  // Compute normalized betweenness centrality (0.0–1.0 range)
  const centralityMap = centrality.betweenness(raw, { normalized: true });

  // Map to result objects for all nodes in the graph
  const results: BottleneckResult[] = [];
  raw.forEachNode((node) => {
    results.push({
      taskId: node,
      score: centralityMap[node] ?? 0,
    });
  });

  // Sort by score descending (highest bottleneck first)
  results.sort((a, b) => b.score - a.score);

  return results;
}