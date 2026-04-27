// TaskGraph class construction — fromTasks, fromRecords, fromJSON, incremental building

import { DirectedGraph } from 'graphology';
import type { TaskGraphNodeAttributes, TaskGraphEdgeAttributes, TaskGraphSerialized } from '../schema/index.js';

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