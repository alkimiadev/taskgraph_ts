// Graph queries — hasCycles, findCycles, topologicalOrder, dependencies, dependents,
// taskCount, getTask

import { hasCycle, topologicalSort } from 'graphology-dag';
import { stronglyConnectedComponents } from 'graphology-components';
import type { TaskGraphInner } from './construction.js';
import type { TaskGraphNodeAttributes } from '../schema/index.js';
import { TaskNotFoundError, CircularDependencyError } from '../error/index.js';

// ---------------------------------------------------------------------------
// 3-color DFS constants for findCycles
// ---------------------------------------------------------------------------

const WHITE = 0; // unvisited
const GREY = 1; // in current recursion stack
const BLACK = 2; // finished — all descendants explored

// ---------------------------------------------------------------------------
// Query functions (operating on the inner graphology graph)
// ---------------------------------------------------------------------------

/**
 * Check whether the graph contains any cycles.
 *
 * Uses `graphology-dag.hasCycle()` as a fast boolean check.
 */
export function hasCycles(graph: TaskGraphInner): boolean {
  return hasCycle(graph);
}

/**
 * Find all cycle paths in the graph.
 *
 * **Algorithm**:
 * 1. Fast pre-check via `stronglyConnectedComponents()`: if there are zero
 *    multi-node SCCs (and no self-loops — which our graph config forbids),
 *    return `[]` immediately.
 * 2. Otherwise, run a custom 3-color DFS (WHITE/GREY/BLACK). When a back
 *    edge is found (GREY → GREY), trace back through the recursion stack to
 *    extract the cycle path as an **ordered node sequence** where the last
 *    node has an edge back to the first.
 *
 * Returns **one representative cycle per back edge**, not an exhaustive
 * enumeration of all simple cycles (which could be exponential).
 *
 * Each inner array is an ordered sequence of node IDs representing a single
 * cycle: `[A, B, C]` means A → B → C → A.
 */
export function findCycles(graph: TaskGraphInner): string[][] {
  // Fast pre-check: if no multi-node SCCs exist, the graph is acyclic.
  // (Self-loops are prohibited by our graph config, so we only check SCCs.)
  const sccs = stronglyConnectedComponents(graph);
  const hasMultiNodeScc = sccs.some((component) => component.length > 1);
  if (!hasMultiNodeScc) {
    return [];
  }

  // 3-color DFS to extract cycle paths
  const color = new Map<string, typeof WHITE>();
  const stack: string[] = []; // current recursion stack
  const cycles: string[][] = [];

  for (const node of graph.nodes()) {
    color.set(node, WHITE);
  }

  for (const startNode of graph.nodes()) {
    if (color.get(startNode) !== WHITE) continue;
    dfs(graph, startNode, color, stack, cycles);
  }

  return cycles;
}

/**
 * Recursive 3-color DFS that detects back edges and extracts cycle paths.
 *
 * When we encounter a neighbor that is GREY (in the current recursion stack),
 * we've found a back edge and can extract the cycle by slicing the recursion
 * stack from that neighbor's position to the current position.
 */
function dfs(
  graph: TaskGraphInner,
  node: string,
  color: Map<string, number>,
  stack: string[],
  cycles: string[][],
): void {
  color.set(node, GREY);
  stack.push(node);

  for (const neighbor of graph.outNeighbors(node)) {
    const neighborColor = color.get(neighbor);

    if (neighborColor === GREY) {
      // Back edge found — extract the cycle path
      const cycleStart = stack.indexOf(neighbor);
      const cycle = stack.slice(cycleStart);
      cycles.push(cycle);
    } else if (neighborColor === WHITE) {
      dfs(graph, neighbor, color, stack, cycles);
    }
    // If BLACK, skip — this subtree is already fully explored
  }

  stack.pop();
  color.set(node, BLACK);
}

/**
 * Return task IDs in topological (prerequisite → dependent) order.
 *
 * Uses `graphology-dag.topologicalSort()` for the actual sort.
 *
 * @throws {CircularDependencyError} When the graph is cyclic, with `cycles`
 *   populated from `findCycles()`.
 */
export function topologicalOrder(graph: TaskGraphInner): string[] {
  try {
    return topologicalSort(graph);
  } catch {
    // Graph is cyclic — throw with cycle information
    throw new CircularDependencyError(findCycles(graph));
  }
}

/**
 * Return the prerequisite task IDs (inNeighbors) for a given task.
 *
 * @throws {TaskNotFoundError} If `taskId` doesn't exist in the graph.
 */
export function dependencies(graph: TaskGraphInner, taskId: string): string[] {
  if (!graph.hasNode(taskId)) {
    throw new TaskNotFoundError(taskId);
  }
  return graph.inNeighbors(taskId);
}

/**
 * Return the dependent task IDs (outNeighbors) for a given task.
 *
 * @throws {TaskNotFoundError} If `taskId` doesn't exist in the graph.
 */
export function dependents(graph: TaskGraphInner, taskId: string): string[] {
  if (!graph.hasNode(taskId)) {
    throw new TaskNotFoundError(taskId);
  }
  return graph.outNeighbors(taskId);
}

/**
 * Return the number of tasks (nodes) in the graph.
 */
export function taskCount(graph: TaskGraphInner): number {
  return graph.order;
}

/**
 * Return the attributes of a task node, or `undefined` if it doesn't exist.
 */
export function getTask(
  graph: TaskGraphInner,
  taskId: string,
): TaskGraphNodeAttributes | undefined {
  if (!graph.hasNode(taskId)) {
    return undefined;
  }
  return graph.getNodeAttributes(taskId);
}