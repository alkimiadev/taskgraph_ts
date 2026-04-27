// Graph mutations — removeTask, removeDependency, updateTask, updateEdgeAttributes

import type { TaskGraphInner } from './construction.js';
import type { TaskGraphNodeAttributes, TaskGraphEdgeAttributes } from '../schema/index.js';
import { TaskNotFoundError } from '../error/index.js';

/**
 * Remove a task (node) from the graph.
 *
 * No-op if the node doesn't exist — removal is idempotent.
 * Graphology automatically removes all edges attached to the dropped node
 * (cascade edge removal).
 *
 * @param graph - The underlying graphology DirectedGraph instance
 * @param id - The task ID to remove
 */
export function removeTask(graph: TaskGraphInner, id: string): void {
  if (!graph.hasNode(id)) {
    return;
  }
  graph.dropNode(id);
}

/**
 * Remove a dependency (edge) from the graph.
 *
 * No-op if the edge doesn't exist — removal is idempotent.
 * Uses the deterministic edge key `${prerequisite}->${dependent}` to
 * identify the edge (per ADR-006).
 *
 * @param graph - The underlying graphology DirectedGraph instance
 * @param prerequisite - Source (prerequisite) task ID
 * @param dependent - Target (dependent) task ID
 */
export function removeDependency(graph: TaskGraphInner, prerequisite: string, dependent: string): void {
  const key = `${prerequisite}->${dependent}`;
  if (!graph.hasEdge(key)) {
    return;
  }
  graph.dropEdge(key);
}

/**
 * Update a task's attributes with a partial merge.
 *
 * Throws `TaskNotFoundError` if the task ID doesn't exist —
 * cannot update attributes of a non-existent node.
 *
 * Uses `mergeNodeAttributes` for a shallow merge of the provided
 * attributes into the existing node attributes.
 *
 * @param graph - The underlying graphology DirectedGraph instance
 * @param id - The task ID to update
 * @param attributes - Partial attributes to merge into the existing node
 * @throws {TaskNotFoundError} If the task ID doesn't exist in the graph
 */
export function updateTask(
  graph: TaskGraphInner,
  id: string,
  attributes: Partial<TaskGraphNodeAttributes>,
): void {
  if (!graph.hasNode(id)) {
    throw new TaskNotFoundError(id);
  }
  graph.mergeNodeAttributes(id, attributes);
}

/**
 * Update an edge's attributes with a partial merge.
 *
 * Throws `TaskNotFoundError` if the edge doesn't exist —
 * cannot update attributes of a non-existent edge.
 *
 * Uses the deterministic edge key `${prerequisite}->${dependent}` to
 * identify the edge (per ADR-006).
 *
 * Uses `mergeEdgeAttributes` for a shallow merge of the provided
 * attributes into the existing edge attributes.
 *
 * @param graph - The underlying graphology DirectedGraph instance
 * @param prerequisite - Source (prerequisite) task ID
 * @param dependent - Target (dependent) task ID
 * @param attrs - Partial edge attributes to merge into the existing edge
 * @throws {TaskNotFoundError} If the edge doesn't exist in the graph
 */
export function updateEdgeAttributes(
  graph: TaskGraphInner,
  prerequisite: string,
  dependent: string,
  attrs: Partial<TaskGraphEdgeAttributes>,
): void {
  const key = `${prerequisite}->${dependent}`;
  if (!graph.hasEdge(key)) {
    throw new TaskNotFoundError(key);
  }
  graph.mergeEdgeAttributes(key, attrs);
}