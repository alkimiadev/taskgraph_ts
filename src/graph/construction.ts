// TaskGraph class construction — fromTasks, fromRecords, fromJSON, incremental building

import { DirectedGraph } from 'graphology';
import type { TaskGraphNodeAttributes, TaskGraphEdgeAttributes, TaskGraphSerialized } from '../schema/index.js';
import {
  removeTask as _removeTask,
  removeDependency as _removeDependency,
  updateTask as _updateTask,
  updateEdgeAttributes as _updateEdgeAttributes,
} from './mutation.js';

/**
 * Internal graph type alias for the graphology DirectedGraph with our attribute types.
 *
 * This is the concrete type of the underlying graphology instance wrapped by TaskGraph.
 */
export type TaskGraphInner = DirectedGraph<TaskGraphNodeAttributes, TaskGraphEdgeAttributes>;

/**
 * TaskGraph wraps a graphology DirectedGraph and provides the foundation
 * for construction, mutation, and query methods.
 *
 * Edges follow the **prerequisite → dependent** convention:
 * if task B has `dependsOn: ["A"]`, the edge is A → B.
 *
 * Constraints enforced by the underlying graph options:
 * - **No parallel edges** (`multi: false`): between any node pair, at most one edge.
 * - **No self-loops** (`allowSelfLoops: false`): a node cannot depend on itself.
 * - **Directed** (`type: 'directed'`): all edges have a direction.
 *
 * Edge keys are deterministic: `${source}->${target}` (per ADR-006).
 *
 * > **Warning on `raw`**: Mutating the underlying graphology instance directly
 * > bypasses TaskGraph's validation and invariants. Consumers using `raw`
 * > should treat the graph as read-only for structural changes and use
 * > TaskGraph methods for all mutations.
 */
export class TaskGraph {
  /** The underlying graphology DirectedGraph instance. */
  private readonly _graph: TaskGraphInner;

  /**
   * Create a new TaskGraph.
   *
   * @param data - Optional serialized graph data to initialize from (delegates to `fromJSON`).
   *               When provided, the graph is populated from the serialized data.
   *               When omitted, creates an empty graph.
   */
  constructor(data?: TaskGraphSerialized) {
    this._graph = new DirectedGraph<TaskGraphNodeAttributes, TaskGraphEdgeAttributes>({
      type: 'directed',
      multi: false,
      allowSelfLoops: false,
    });

    if (data) {
      TaskGraph.fromJSON(data, this);
    }
  }

  /**
   * Returns the underlying graphology DirectedGraph instance.
   *
   * Use this for read-only access (queries, event listeners) or for
   * operations not yet exposed by TaskGraph. Avoid mutating the graph
   * directly — prefer TaskGraph methods for all structural changes.
   */
  get raw(): TaskGraphInner {
    return this._graph;
  }

  /**
   * Produce a deterministic edge key from source and target node keys.
   *
   * Format: `${source}->${target}` (per ADR-006).
   *
   * This is used internally by addDependency and construction methods
   * that call `addEdgeWithKey` on the underlying graphology instance.
   *
   * @param source - Source (prerequisite) node key
   * @param target - Target (dependent) node key
   * @returns Deterministic edge key string
   */
  protected _edgeKey(source: string, target: string): string {
    return `${source}->${target}`;
  }

  // ---------------------------------------------------------------------------
  // Mutation methods
  // ---------------------------------------------------------------------------

  /**
   * Remove a task (node) from the graph.
   *
   * No-op if the node doesn't exist. Graphology automatically removes
   * all edges attached to the dropped node (cascade edge removal).
   *
   * @param id - The task ID to remove
   */
  removeTask(id: string): void {
    _removeTask(this._graph, id);
  }

  /**
   * Remove a dependency (edge) from the graph.
   *
   * No-op if the edge doesn't exist. Uses the deterministic edge key
   * `${prerequisite}->${dependent}` to identify the edge (per ADR-006).
   *
   * @param prerequisite - Source (prerequisite) task ID
   * @param dependent - Target (dependent) task ID
   */
  removeDependency(prerequisite: string, dependent: string): void {
    _removeDependency(this._graph, prerequisite, dependent);
  }

  /**
   * Update a task's attributes with a partial merge.
   *
   * Throws `TaskNotFoundError` if the task ID doesn't exist.
   * Uses a shallow merge of the provided attributes into the existing
   * node attributes.
   *
   * @param id - The task ID to update
   * @param attributes - Partial attributes to merge into the existing node
   * @throws {TaskNotFoundError} If the task ID doesn't exist in the graph
   */
  updateTask(id: string, attributes: Partial<TaskGraphNodeAttributes>): void {
    _updateTask(this._graph, id, attributes);
  }

  /**
   * Update an edge's attributes with a partial merge.
   *
   * Throws `TaskNotFoundError` if the edge doesn't exist.
   * Uses the deterministic edge key `${prerequisite}->${dependent}` to
   * identify the edge (per ADR-006).
   *
   * @param prerequisite - Source (prerequisite) task ID
   * @param dependent - Target (dependent) task ID
   * @param attrs - Partial edge attributes to merge into the existing edge
   * @throws {TaskNotFoundError} If the edge doesn't exist in the graph
   */
  updateEdgeAttributes(prerequisite: string, dependent: string, attrs: Partial<TaskGraphEdgeAttributes>): void {
    _updateEdgeAttributes(this._graph, prerequisite, dependent, attrs);
  }

  // ---------------------------------------------------------------------------
  // Static construction methods (stubs — implementation in dependent tasks)
  // ---------------------------------------------------------------------------

  /**
   * Construct a TaskGraph from an array of TaskInput objects.
   *
   * Edges are derived from `dependsOn` arrays with default `qualityRetention: 0.9`.
   * Dangling references in `dependsOn` silently create orphan nodes.
   *
   * @param tasks - Array of TaskInput objects
   * @returns A new TaskGraph populated from the task inputs
   */
  static fromTasks(tasks: unknown[]): TaskGraph {
    // Implementation in dependent task: graph/construction-methods
    void tasks;
    throw new Error('TaskGraph.fromTasks() not yet implemented');
  }

  /**
   * Construct a TaskGraph from explicit task and edge arrays.
   *
   * Unlike `fromTasks`, edges are provided explicitly with per-edge `qualityRetention`.
   * Dangling references in edges throw `TaskNotFoundError`.
   *
   * @param tasks - Array of TaskInput objects
   * @param edges - Array of DependencyEdge objects
   * @returns A new TaskGraph populated from the records
   */
  static fromRecords(tasks: unknown[], edges: unknown[]): TaskGraph {
    // Implementation in dependent task: graph/construction-methods
    void tasks;
    void edges;
    throw new Error('TaskGraph.fromRecords() not yet implemented');
  }

  /**
   * Construct a TaskGraph from serialized data (graphology native JSON format).
   *
   * If a `target` TaskGraph is provided, it is populated in-place and returned.
   * Otherwise, a new TaskGraph is created and populated.
   *
   * @param data - Serialized graph data in graphology native JSON format
   * @param target - Optional existing TaskGraph to populate (used by constructor)
   * @returns A TaskGraph populated from the serialized data
   */
  static fromJSON(data: TaskGraphSerialized, target?: TaskGraph): TaskGraph {
    const graph = target ?? new TaskGraph();
    graph._graph.import(data);
    return graph;
  }
}