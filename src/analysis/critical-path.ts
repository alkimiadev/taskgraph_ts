// criticalPath, weightedCriticalPath
//
// Find the longest path from sources to sinks in a DAG using
// topological order + dynamic programming.
//
// Algorithm:
// 1. Get topological order (throws CircularDependencyError if cyclic)
// 2. For each node in topological order, compute the longest distance
//    from any source to that node
// 3. The node with the maximum distance is the end of the critical path
// 4. Backtrack from that node to reconstruct the full path
//
// For criticalPath (unweighted): each edge contributes weight 1
//   → dist[v] = max(dist[u] + 1) for all u → v
//   → This finds the path with the most edges (longest chain)
//
// For weightedCriticalPath: each node contributes a weight via weightFn
//   → dist[v] = max(dist[u] + weightFn(v)) for all u → v
//   → Sources get dist[v] = weightFn(v) (they contribute their own weight)
//   → This finds the path with the highest cumulative node weight

import type { TaskGraph } from '../graph/construction.js';
import type { TaskGraphNodeAttributes } from '../schema/graph.js';

// ---------------------------------------------------------------------------
// Internal helper: compute longest path via topological order + DP
// ---------------------------------------------------------------------------

interface LongestPathResult {
  /** The ordered array of node IDs on the longest path */
  path: string[];
  /** The total distance/weight of the longest path */
  distance: number;
}

/**
 * Core DP algorithm for longest path in a DAG.
 *
 * @param graph - The TaskGraph instance
 * @param nodeWeightFn - Function that returns the weight contribution of a node.
 *                       For unweighted criticalPath, this returns 1.
 *                       For weightedCriticalPath, this returns weightFn(nodeId, attrs).
 */
function computeLongestPath(
  graph: TaskGraph,
  nodeWeightFn: (nodeId: string, attrs: TaskGraphNodeAttributes) => number,
): LongestPathResult {
  const raw = graph.raw;

  // Empty graph → no path
  if (raw.order === 0) {
    return { path: [], distance: 0 };
  }

  // Get topological order — throws CircularDependencyError if cyclic
  const topo = graph.topologicalOrder();

  // Single node → the node itself is the path
  if (topo.length === 1) {
    const nodeId = topo[0];
    const attrs = raw.getNodeAttributes(nodeId);
    return { path: [nodeId!], distance: nodeWeightFn(nodeId!, attrs) };
  }

  // dist[v] = longest distance from any source to v
  const dist = new Map<string, number>();
  // predecessor[v] = the node u that maximizes dist[u] + weight(v)
  const predecessor = new Map<string, string | null>();

  // Initialize: sources (nodes with no incoming edges) get their own weight
  for (const v of topo) {
    const inDegree = raw.inDegree(v);
    if (inDegree === 0) {
      const attrs = raw.getNodeAttributes(v);
      dist.set(v, nodeWeightFn(v, attrs));
      predecessor.set(v, null);
    } else {
      dist.set(v, -Infinity);
      predecessor.set(v, null);
    }
  }

  // DP: process nodes in topological order
  for (const v of topo) {
    // Skip sources (already initialized)
    if (raw.inDegree(v) === 0) continue;

    const vAttrs = raw.getNodeAttributes(v);
    const vWeight = nodeWeightFn(v, vAttrs);

    // For each predecessor u → v, check if dist[u] + weight(v) is better
    for (const u of raw.inNeighbors(v)) {
      const uDist = dist.get(u)!; // u is processed before v (topo order)
      const candidate = uDist + vWeight;
      if (candidate > dist.get(v)!) {
        dist.set(v, candidate);
        predecessor.set(v, u);
      }
    }
  }

  // Find the node with the maximum distance (end of the critical path)
  let maxDist = -Infinity;
  let endNode: string | null = null;
  for (const [nodeId, d] of dist) {
    if (d > maxDist) {
      maxDist = d;
      endNode = nodeId;
    }
  }

  // Backtrack from endNode to reconstruct the path
  const path: string[] = [];
  let current: string | null = endNode;
  while (current !== null) {
    path.unshift(current);
    current = current !== null ? (predecessor.get(current) ?? null) : null;
  }

  return { path, distance: maxDist };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Find the critical path (longest path) in a task graph.
 *
 * Uses unweighted edges (each edge contributes weight 1 to the path length).
 * Each node on the path also contributes weight 1. This effectively finds
 * the path with the most nodes from any source to any sink.
 *
 * @param graph - The task graph to analyze
 * @returns An ordered array of task IDs representing the critical path,
 *          from source to sink
 * @throws {CircularDependencyError} If the graph contains cycles
 */
export function criticalPath(graph: TaskGraph): string[] {
  return computeLongestPath(graph, () => 1).path;
}

/**
 * Find the weighted critical path in a task graph.
 *
 * Each node contributes a weight determined by `weightFn`. The path with
 * the highest cumulative weight is returned.
 *
 * @param graph - The task graph to analyze
 * @param weightFn - A function that returns the weight of a node given
 *                   its ID and attributes
 * @returns An ordered array of task IDs representing the weighted critical
 *          path, from source to sink
 * @throws {CircularDependencyError} If the graph contains cycles
 */
export function weightedCriticalPath(
  graph: TaskGraph,
  weightFn: (taskId: string, attrs: TaskGraphNodeAttributes) => number,
): string[] {
  return computeLongestPath(graph, weightFn).path;
}