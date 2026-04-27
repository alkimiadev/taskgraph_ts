// TaskGraph class construction — fromTasks, fromRecords, fromJSON, incremental building

import { DirectedGraph } from 'graphology';
import { Value } from '@alkdev/typebox/value';
import type {
  TaskGraphNodeAttributes,
  TaskGraphEdgeAttributes,
  TaskGraphSerialized,
  TaskInput,
  DependencyEdge,
} from '../schema/index.js';
import { TaskGraphSerialized as TaskGraphSerializedSchema } from '../schema/index.js';
import {
  DuplicateNodeError,
  DuplicateEdgeError,
  TaskNotFoundError,
  InvalidInputError,
} from '../error/index.js';

/**
 * Internal graph type alias for the graphology DirectedGraph with our attribute types.
 *
 * This is the concrete type of the underlying graphology instance wrapped by TaskGraph.
 */
export type TaskGraphInner = DirectedGraph<TaskGraphNodeAttributes, TaskGraphEdgeAttributes>;

// ---------------------------------------------------------------------------
// Helper: strip null → undefined for TaskInput → TaskGraphNodeAttributes
// ---------------------------------------------------------------------------

/**
 * Transform a TaskInput into TaskGraphNodeAttributes by:
 * 1. Stripping null values → undefined (absent = "not assessed")
 * 2. Dropping non-graph fields (tags, assignee, due, created, modified)
 *
 * Per graph-model.md, categorical fields are `Type.Optional(Nullable(Enum))` on input
 * but `Type.Optional(Enum)` on the graph — null and absent both become "not stored."
 */
function taskInputToNodeAttrs(input: TaskInput): TaskGraphNodeAttributes {
  const attrs: TaskGraphNodeAttributes = { name: input.name };

  // Only store non-null categorical fields
  if (input.status != null) attrs.status = input.status;
  if (input.scope != null) attrs.scope = input.scope;
  if (input.risk != null) attrs.risk = input.risk;
  if (input.impact != null) attrs.impact = input.impact;
  if (input.level != null) attrs.level = input.level;
  if (input.priority != null) attrs.priority = input.priority;

  // Note: tags, assignee, due, created, modified are NOT stored on graph nodes
  // They belong to the caller/consumer, not the graph.

  return attrs;
}

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
  // Static construction methods
  // ---------------------------------------------------------------------------

  /**
   * Construct a TaskGraph from an array of TaskInput objects.
   *
   * Transforms `TaskInput[]` into node data + edge data, builds a serialized
   * blob, and calls `graph.import()`. This is faster than N individual
   * addNode/addEdge calls and avoids the verbose builder API.
   *
   * Semantics:
   * - Each `dependsOn` entry creates an edge with default `qualityRetention: 0.9`.
   * - `dependsOn` targets not matching any task ID become **orphan nodes**
   *   with default attributes (`{ name: <dep-id> }`).
   * - Duplicate task IDs throw `DuplicateNodeError`.
   * - Uses `mergeNode` for idempotent node merging (same ID gets merged attributes).
   * - Duplicate `dependsOn` entries for the same pair create only one edge
   *   (idempotent via deterministic edge key).
   * - Cycles are NOT rejected at construction time — call `hasCycles()` or
   *   `validateGraph()` to detect.
   *
   * @param tasks - Array of TaskInput objects
   * @returns A new TaskGraph populated from the task inputs
   * @throws {DuplicateNodeError} if duplicate task IDs are found
   */
  static fromTasks(tasks: TaskInput[]): TaskGraph {
    const tg = new TaskGraph();

    // Detect duplicate IDs before any graph mutation
    const seenIds = new Set<string>();
    for (const task of tasks) {
      if (seenIds.has(task.id)) {
        throw new DuplicateNodeError(task.id);
      }
      seenIds.add(task.id);
    }

    // Build node map: id → TaskGraphNodeAttributes (using mergeNode semantics)
    // If the same ID appears multiple times, it's an error (checked above).
    // But for nodes created from dependsOn orphans, mergeNode allows idempotent merge.
    const nodeMap = new Map<string, TaskGraphNodeAttributes>();

    for (const task of tasks) {
      const attrs = taskInputToNodeAttrs(task);
      nodeMap.set(task.id, attrs);
    }

    // Collect edges from dependsOn arrays and track orphan node IDs
    const edgeSet = new Set<string>(); // for dedup
    const edgeEntries: Array<{
      key: string;
      source: string;
      target: string;
      attributes: TaskGraphEdgeAttributes;
    }> = [];
    const orphanIds = new Set<string>();

    for (const task of tasks) {
      for (const dep of task.dependsOn) {
        const edgeKey = `${dep}->${task.id}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edgeEntries.push({
            key: edgeKey,
            source: dep,
            target: task.id,
            attributes: { qualityRetention: 0.9 },
          });
        }

        // Track orphan nodes: dependsOn targets not in the tasks array
        if (!nodeMap.has(dep)) {
          orphanIds.add(dep);
        }
      }
    }

    // Add orphan nodes with default attributes
    for (const orphanId of orphanIds) {
      nodeMap.set(orphanId, { name: orphanId });
    }

    // Build serialized blob and import in bulk
    const serialized = {
      attributes: {} as Record<string, unknown>,
      options: {
        type: 'directed' as const,
        multi: false as const,
        allowSelfLoops: false as const,
      },
      nodes: Array.from(nodeMap.entries()).map(([key, attributes]) => ({
        key,
        attributes,
      })),
      edges: edgeEntries,
    };

    tg._graph.import(serialized);
    return tg;
  }

  /**
   * Construct a TaskGraph from explicit task and edge arrays.
   *
   * Unlike `fromTasks`, edges are provided explicitly with per-edge `qualityRetention`.
   * This method is strict:
   * - Edges must reference tasks that exist in the `tasks` array —
   *   throws `TaskNotFoundError` for dangling references.
   * - Duplicate task IDs throw `DuplicateNodeError`.
   * - Duplicate edges (same prerequisite→dependent pair) throw `DuplicateEdgeError`.
   * - Cycles are NOT rejected at construction time.
   *
   * @param tasks - Array of TaskInput objects
   * @param edges - Array of DependencyEdge objects
   * @returns A new TaskGraph populated from the records
   * @throws {DuplicateNodeError} if duplicate task IDs are found
   * @throws {DuplicateEdgeError} if duplicate prerequisite→dependent pairs are found
   * @throws {TaskNotFoundError} if an edge references a task ID not in the tasks array
   */
  static fromRecords(tasks: TaskInput[], edges: DependencyEdge[]): TaskGraph {
    const tg = new TaskGraph();

    // Detect duplicate IDs
    const taskIdSet = new Set<string>();
    for (const task of tasks) {
      if (taskIdSet.has(task.id)) {
        throw new DuplicateNodeError(task.id);
      }
      taskIdSet.add(task.id);
    }

    // Build node map
    const nodeMap = new Map<string, TaskGraphNodeAttributes>();
    for (const task of tasks) {
      nodeMap.set(task.id, taskInputToNodeAttrs(task));
    }

    // Validate edges and detect duplicates / dangling refs
    const edgeSet = new Set<string>();
    const edgeEntries: Array<{
      key: string;
      source: string;
      target: string;
      attributes: TaskGraphEdgeAttributes;
    }> = [];

    for (const edge of edges) {
      const { from: prerequisite, to: dependent } = edge;

      // Check both endpoints exist in the tasks array
      if (!taskIdSet.has(prerequisite)) {
        throw new TaskNotFoundError(prerequisite);
      }
      if (!taskIdSet.has(dependent)) {
        throw new TaskNotFoundError(dependent);
      }

      // Check for duplicate edges
      const edgeKey = `${prerequisite}->${dependent}`;
      if (edgeSet.has(edgeKey)) {
        throw new DuplicateEdgeError(prerequisite, dependent);
      }
      edgeSet.add(edgeKey);

      edgeEntries.push({
        key: edgeKey,
        source: prerequisite,
        target: dependent,
        attributes: {
          qualityRetention: edge.qualityRetention ?? 0.9,
        },
      });
    }

    // Build serialized blob and import in bulk
    const serialized = {
      attributes: {} as Record<string, unknown>,
      options: {
        type: 'directed' as const,
        multi: false as const,
        allowSelfLoops: false as const,
      },
      nodes: Array.from(nodeMap.entries()).map(([key, attributes]) => ({
        key,
        attributes,
      })),
      edges: edgeEntries,
    };

    tg._graph.import(serialized);
    return tg;
  }

  /**
   * Construct a TaskGraph from serialized data (graphology native JSON format).
   *
   * Validates input against the `TaskGraphSerialized` schema using TypeBox
   * `Value.Check`. Invalid data throws an `InvalidInputError` derived from
   * the first TypeBox validation error.
   *
   * If a `target` TaskGraph is provided, it is populated in-place and returned.
   * Otherwise, a new TaskGraph is created and populated.
   *
   * Orphan nodes in the JSON are preserved (graphology import doesn't enforce
   * connectivity).
   *
   * @param data - Serialized graph data in graphology native JSON format
   * @param target - Optional existing TaskGraph to populate (used by constructor)
   * @returns A TaskGraph populated from the serialized data
   * @throws {InvalidInputError} if data fails schema validation
   */
  static fromJSON(data: TaskGraphSerialized, target?: TaskGraph): TaskGraph {
    // Validate input against TaskGraphSerialized schema
    if (!Value.Check(TaskGraphSerializedSchema, data)) {
      const errors = Value.Errors(TaskGraphSerializedSchema, data);
      const firstError = errors.First();
      if (firstError) {
        throw InvalidInputError.fromTypeBoxError(firstError);
      }
      // Fallback if no specific error found (shouldn't happen, but be safe)
      throw new InvalidInputError('data', 'Input does not match TaskGraphSerialized schema');
    }

    const graph = target ?? new TaskGraph();
    graph._graph.import(data);
    return graph;
  }

  // ---------------------------------------------------------------------------
  // Incremental construction methods
  // ---------------------------------------------------------------------------

  /**
   * Add a task (node) to the graph.
   *
   * @param id - Unique task identifier (used as the node key)
   * @param attributes - Node attributes for the task
   * @throws {DuplicateNodeError} if a node with the given ID already exists
   */
  addTask(id: string, attributes: TaskGraphNodeAttributes): void {
    if (this._graph.hasNode(id)) {
      throw new DuplicateNodeError(id);
    }
    this._graph.addNode(id, attributes);
  }

  /**
   * Add a dependency (edge) between two tasks.
   *
   * Creates an edge from `prerequisite` to `dependent` using a deterministic
   * edge key (`${prerequisite}->${dependent}`) per ADR-006.
   *
   * @param prerequisite - Source node (must exist in the graph)
   * @param dependent - Target node (must exist in the graph)
   * @param qualityRetention - Optional edge quality retention (default: 0.9)
   * @throws {TaskNotFoundError} if either endpoint doesn't exist
   * @throws {DuplicateEdgeError} if an edge between the two nodes already exists
   */
  addDependency(prerequisite: string, dependent: string, qualityRetention: number = 0.9): void {
    // Validate both endpoints exist
    if (!this._graph.hasNode(prerequisite)) {
      throw new TaskNotFoundError(prerequisite);
    }
    if (!this._graph.hasNode(dependent)) {
      throw new TaskNotFoundError(dependent);
    }

    // Check for duplicate edge
    const edgeKey = this._edgeKey(prerequisite, dependent);
    if (this._graph.hasEdge(edgeKey)) {
      throw new DuplicateEdgeError(prerequisite, dependent);
    }

    this._graph.addEdgeWithKey(edgeKey, prerequisite, dependent, { qualityRetention });
  }
}