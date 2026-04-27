// parallelGroups — groups of tasks that can be executed concurrently

import { topologicalGenerations } from 'graphology-dag';
import type { TaskGraph } from '../graph/index.js';
import { CircularDependencyError } from '../error/index.js';
import { findCycles } from '../graph/queries.js';

/**
 * Return groups of tasks that can be executed concurrently.
 *
 * Each inner array is a "generation" of tasks at the same topological depth
 * from sources — tasks with zero prerequisites are in the first group.
 *
 * Uses `graphology-dag.topologicalGenerations()` for the generation
 * computation. Works on disconnected graphs (each connected component is
 * sorted independently, then merged by depth).
 *
 * @param graph - The TaskGraph to analyze
 * @returns An array of arrays, where each inner array is a generation of
 *   tasks at the same depth from sources
 * @throws {CircularDependencyError} If the graph contains cycles, with
 *   `cycles` populated from `findCycles()`
 */
export function parallelGroups(graph: TaskGraph): string[][] {
  try {
    return topologicalGenerations(graph.raw);
  } catch {
    // graphology-dag throws when the graph is cyclic — re-throw with
    // our CircularDependencyError that carries cycle information
    throw new CircularDependencyError(findCycles(graph.raw));
  }
}