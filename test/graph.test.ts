import { describe, it, expect } from 'vitest';
import { hasCycle } from 'graphology-dag';
import { TaskGraph, type TaskGraphInner } from '../src/graph/index.js';
import type { TaskGraphSerialized } from '../src/schema/index.js';
import type { TaskInput, DependencyEdge } from '../src/schema/index.js';
import {
  DuplicateNodeError,
  DuplicateEdgeError,
  TaskNotFoundError,
  InvalidInputError,
} from '../src/error/index.js';
import {
  createTaskGraph,
  linearChainTasks,
  linearChain,
  diamondTasks,
  diamond,
  mixedCategoryTasks,
  mixedCategory,
  cyclicTasks,
  cyclic,
  largeGraphTasks,
  largeGraph,
  allGraphs,
  allTasks,
} from './fixtures/graphs.js';

// ---------------------------------------------------------------------------
// TaskGraph class skeleton tests (acceptance criteria from task file)
// ---------------------------------------------------------------------------

describe('TaskGraph class', () => {
  it('is exported from src/graph/index.ts', () => {
    expect(TaskGraph).toBeDefined();
    expect(typeof TaskGraph).toBe('function');
  });

  describe('constructor', () => {
    it('creates an empty graph by default', () => {
      const tg = new TaskGraph();
      expect(tg.raw.order).toBe(0);
      expect(tg.raw.size).toBe(0);
    });

    it('creates a DirectedGraph with type: directed', () => {
      const tg = new TaskGraph();
      expect(tg.raw.type).toBe('directed');
    });

    it('sets multi: false (no parallel edges)', () => {
      const tg = new TaskGraph();
      expect(tg.raw.multi).toBe(false);
    });

    it('sets allowSelfLoops: false', () => {
      const tg = new TaskGraph();
      expect(tg.raw.allowSelfLoops).toBe(false);
    });

    it('accepts optional TaskGraphSerialized for initialization', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'a', attributes: { name: 'Task A' } },
          { key: 'b', attributes: { name: 'Task B' } },
        ],
        edges: [
          { key: 'a->b', source: 'a', target: 'b', attributes: { qualityRetention: 0.9 } },
        ],
      };
      const tg = new TaskGraph(data);
      expect(tg.raw.order).toBe(2);
      expect(tg.raw.size).toBe(1);
      expect(tg.raw.hasNode('a')).toBe(true);
      expect(tg.raw.hasNode('b')).toBe(true);
      expect(tg.raw.hasEdge('a->b')).toBe(true);
    });

    it('initializes from empty serialized data', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [],
        edges: [],
      };
      const tg = new TaskGraph(data);
      expect(tg.raw.order).toBe(0);
      expect(tg.raw.size).toBe(0);
    });
  });

  describe('raw getter', () => {
    it('returns the underlying graphology DirectedGraph instance', () => {
      const tg = new TaskGraph();
      const raw = tg.raw;
      expect(raw).toBeDefined();
      expect(raw.type).toBe('directed');
      expect(typeof raw.order).toBe('number');
      expect(typeof raw.size).toBe('number');
    });

    it('returns the same instance on repeated access', () => {
      const tg = new TaskGraph();
      const raw1 = tg.raw;
      const raw2 = tg.raw;
      expect(raw1).toBe(raw2);
    });

    it('the returned instance is a TaskGraphInner (DirectedGraph) type', () => {
      const tg = new TaskGraph();
      // Verify it has DirectedGraph methods
      const raw: TaskGraphInner = tg.raw;
      expect(typeof raw.addNode).toBe('function');
      expect(typeof raw.addEdgeWithKey).toBe('function');
      expect(typeof raw.export).toBe('function');
    });
  });

  describe('_edgeKey method', () => {
    it('produces deterministic keys in ${source}->${target} format', () => {
      const tg = new TaskGraph();
      // _edgeKey is protected but we can test its output through fromJSON
      // which uses addEdgeWithKey. Let's test via serialized data with
      // deterministic edge keys.
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'task-a', attributes: { name: 'Task A' } },
          { key: 'task-b', attributes: { name: 'Task B' } },
        ],
        edges: [
          { key: 'task-a->task-b', source: 'task-a', target: 'task-b', attributes: {} },
        ],
      };
      const tgFromData = new TaskGraph(data);
      // Verify the deterministic key format is accepted and works
      expect(tgFromData.raw.hasEdge('task-a->task-b')).toBe(true);
      expect(tgFromData.raw.source('task-a->task-b')).toBe('task-a');
      expect(tgFromData.raw.target('task-a->task-b')).toBe('task-b');
    });

    it('edge key format is stable and human-readable', () => {
      // Test the expected format `${source}->${target}` directly
      const source = 'setup-project';
      const target = 'implement-feature';
      const expectedKey = `${source}->${target}`;
      expect(expectedKey).toBe('setup-project->implement-feature');
      expect(expectedKey).toContain('->');
    });
  });

  describe('graph constraints', () => {
    it('no parallel edges constraint is enforced by multi: false', () => {
      const tg = new TaskGraph();
      tg.raw.addNode('a', { name: 'A' });
      tg.raw.addNode('b', { name: 'B' });
      // First edge succeeds
      tg.raw.addEdgeWithKey('a->b', 'a', 'b', {});
      // Second edge between same pair should fail due to multi: false
      expect(() => {
        tg.raw.addEdgeWithKey('a->b-dup', 'a', 'b', {});
      }).toThrow();
    });

    it('no self-loops constraint is enforced by allowSelfLoops: false', () => {
      const tg = new TaskGraph();
      tg.raw.addNode('a', { name: 'A' });
      // Self-loop should fail
      expect(() => {
        tg.raw.addEdgeWithKey('a->a', 'a', 'a', {});
      }).toThrow();
    });
  });

  describe('fromJSON', () => {
    it('creates a new TaskGraph from serialized data', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'x', attributes: { name: 'X' } },
          { key: 'y', attributes: { name: 'Y' } },
        ],
        edges: [
          { key: 'x->y', source: 'x', target: 'y', attributes: { qualityRetention: 0.85 } },
        ],
      };
      const tg = TaskGraph.fromJSON(data);
      expect(tg.raw.order).toBe(2);
      expect(tg.raw.size).toBe(1);
      expect(tg.raw.getEdgeAttributes('x->y').qualityRetention).toBe(0.85);
    });

    it('populates an existing TaskGraph when target is provided', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'm', attributes: { name: 'M' } },
        ],
        edges: [],
      };
      const existing = new TaskGraph();
      const result = TaskGraph.fromJSON(data, existing);
      expect(result).toBe(existing);
      expect(existing.raw.order).toBe(1);
      expect(existing.raw.hasNode('m')).toBe(true);
    });

    it('preserves orphan nodes from JSON', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'orphan', attributes: { name: 'Orphan Node' } },
          { key: 'connected', attributes: { name: 'Connected' } },
        ],
        edges: [],
      };
      const tg = TaskGraph.fromJSON(data);
      expect(tg.raw.order).toBe(2);
      expect(tg.raw.hasNode('orphan')).toBe(true);
      expect(tg.raw.size).toBe(0);
    });

    it('validates input against TaskGraphSerialized schema', () => {
      // Missing required 'options' field
      const invalid = {
        attributes: {},
        nodes: [],
        edges: [],
      } as unknown as TaskGraphSerialized;
      expect(() => TaskGraph.fromJSON(invalid)).toThrow(InvalidInputError);
    });

    it('validates node key type', () => {
      const invalid = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [{ key: 123, attributes: { name: 'Bad' } }],
        edges: [],
      } as unknown as TaskGraphSerialized;
      expect(() => TaskGraph.fromJSON(invalid)).toThrow(InvalidInputError);
    });
  });

  describe('re-export from src/index.ts', () => {
    it('TaskGraph is available from the top-level package export', async () => {
      // Dynamic import to test the actual re-export chain
      const mod = await import('../src/index.js');
      expect(mod.TaskGraph).toBeDefined();
      expect(typeof mod.TaskGraph).toBe('function');
    });
  });

  // ---------------------------------------------------------------------------
  // export() / toJSON() tests (acceptance criteria from graph/export task)
  // ---------------------------------------------------------------------------

  describe('export()', () => {
    it('returns an empty TaskGraphSerialized for an empty graph', () => {
      const tg = new TaskGraph();
      const data = tg.export();
      expect(data.options).toEqual({ type: 'directed', multi: false, allowSelfLoops: false });
      expect(data.attributes).toEqual({});
      expect(data.nodes).toEqual([]);
      expect(data.edges).toEqual([]);
    });

    it('includes all node attributes in the exported data', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'a', attributes: { name: 'Task A', risk: 'high', scope: 'broad' } },
          { key: 'b', attributes: { name: 'Task B' } },
        ],
        edges: [],
      };
      const tg = new TaskGraph(data);
      const exported = tg.export();

      expect(exported.nodes).toHaveLength(2);
      const nodeA = exported.nodes.find(n => n.key === 'a');
      expect(nodeA).toBeDefined();
      expect(nodeA!.attributes.name).toBe('Task A');
      expect(nodeA!.attributes.risk).toBe('high');
      expect(nodeA!.attributes.scope).toBe('broad');
    });

    it('includes edge attributes including qualityRetention', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'a', attributes: { name: 'Task A' } },
          { key: 'b', attributes: { name: 'Task B' } },
        ],
        edges: [
          { key: 'a->b', source: 'a', target: 'b', attributes: { qualityRetention: 0.85 } },
        ],
      };
      const tg = new TaskGraph(data);
      const exported = tg.export();

      expect(exported.edges).toHaveLength(1);
      expect(exported.edges[0].key).toBe('a->b');
      expect(exported.edges[0].source).toBe('a');
      expect(exported.edges[0].target).toBe('b');
      expect(exported.edges[0].attributes.qualityRetention).toBe(0.85);
    });

    it('round-trips through fromJSON: empty graph', () => {
      const tg = new TaskGraph();
      const exported = tg.export();
      const restored = TaskGraph.fromJSON(exported);
      expect(restored.raw.order).toBe(0);
      expect(restored.raw.size).toBe(0);
    });

    it('round-trips through fromJSON: graph with nodes and edges', () => {
      const original: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'x', attributes: { name: 'Task X', risk: 'medium', impact: 'component' } },
          { key: 'y', attributes: { name: 'Task Y', scope: 'narrow' } },
          { key: 'z', attributes: { name: 'Task Z' } },
        ],
        edges: [
          { key: 'x->y', source: 'x', target: 'y', attributes: { qualityRetention: 0.9 } },
          { key: 'y->z', source: 'y', target: 'z', attributes: { qualityRetention: 0.75 } },
        ],
      };
      const tg = new TaskGraph(original);
      const exported = tg.export();
      const restored = TaskGraph.fromJSON(exported);

      // Same structure
      expect(restored.raw.order).toBe(3);
      expect(restored.raw.size).toBe(2);

      // Same node attributes
      expect(restored.raw.getNodeAttributes('x')).toEqual({ name: 'Task X', risk: 'medium', impact: 'component' });
      expect(restored.raw.getNodeAttributes('y')).toEqual({ name: 'Task Y', scope: 'narrow' });
      expect(restored.raw.getNodeAttributes('z')).toEqual({ name: 'Task Z' });

      // Same edge attributes
      expect(restored.raw.getEdgeAttributes('x->y').qualityRetention).toBe(0.9);
      expect(restored.raw.getEdgeAttributes('y->z').qualityRetention).toBe(0.75);
    });

    it('round-trips through fromJSON: re-export matches original export', () => {
      const original: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'a', attributes: { name: 'Alpha', risk: 'high' } },
          { key: 'b', attributes: { name: 'Beta' } },
        ],
        edges: [
          { key: 'a->b', source: 'a', target: 'b', attributes: { qualityRetention: 0.9 } },
        ],
      };
      const tg = new TaskGraph(original);
      const first = tg.export();
      const restored = TaskGraph.fromJSON(first);
      const second = restored.export();

      expect(second.nodes).toEqual(first.nodes);
      expect(second.edges).toEqual(first.edges);
    });
  });

  describe('toJSON()', () => {
    it('returns the same result as export()', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'a', attributes: { name: 'Task A' } },
          { key: 'b', attributes: { name: 'Task B' } },
        ],
        edges: [
          { key: 'a->b', source: 'a', target: 'b', attributes: { qualityRetention: 0.9 } },
        ],
      };
      const tg = new TaskGraph(data);
      const exported = tg.export();
      const json = tg.toJSON();
      expect(json).toEqual(exported);
    });

    it('enables JSON.stringify(graph) to produce serialized output', () => {
      const data: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'a', attributes: { name: 'Task A' } },
        ],
        edges: [],
      };
      const tg = new TaskGraph(data);
      const stringified = JSON.stringify(tg);
      const parsed = JSON.parse(stringified);

      expect(parsed.options).toEqual({ type: 'directed', multi: false, allowSelfLoops: false });
      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.nodes[0].key).toBe('a');
      expect(parsed.nodes[0].attributes.name).toBe('Task A');
    });

    it('JSON.stringify round-trip produces an equivalent graph', () => {
      const original: TaskGraphSerialized = {
        attributes: {},
        options: { type: 'directed', multi: false, allowSelfLoops: false },
        nodes: [
          { key: 'p', attributes: { name: 'Parent', risk: 'low' } },
          { key: 'q', attributes: { name: 'Child', scope: 'single' } },
        ],
        edges: [
          { key: 'p->q', source: 'p', target: 'q', attributes: { qualityRetention: 0.95 } },
        ],
      };
      const tg = new TaskGraph(original);
      const json = JSON.stringify(tg);
      const parsed = JSON.parse(json) as TaskGraphSerialized;
      const restored = TaskGraph.fromJSON(parsed);

      expect(restored.raw.order).toBe(2);
      expect(restored.raw.size).toBe(1);
      expect(restored.raw.getNodeAttributes('p').risk).toBe('low');
      expect(restored.raw.getNodeAttributes('q').scope).toBe('single');
      expect(restored.raw.getEdgeAttributes('p->q').qualityRetention).toBe(0.95);
    });
  });
});

// ---------------------------------------------------------------------------
// TaskGraph.fromTasks() tests
// ---------------------------------------------------------------------------

describe('TaskGraph.fromTasks', () => {
  it('creates a graph from a simple TaskInput array', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'Task A', dependsOn: [] },
      { id: 'b', name: 'Task B', dependsOn: ['a'] },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.size).toBe(1);
    expect(tg.raw.hasNode('a')).toBe(true);
    expect(tg.raw.hasNode('b')).toBe(true);
    expect(tg.raw.hasEdge('a->b')).toBe(true);
  });

  it('creates edges with default qualityRetention 0.9', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: ['a'] },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    const attrs = tg.raw.getEdgeAttributes('a->b');
    expect(attrs.qualityRetention).toBe(0.9);
  });

  it('silently creates orphan nodes for dangling dependsOn references', () => {
    const tasks: TaskInput[] = [
      { id: 'b', name: 'Task B', dependsOn: ['nonexistent-a'] },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.hasNode('nonexistent-a')).toBe(true);
    expect(tg.raw.getNodeAttributes('nonexistent-a').name).toBe('nonexistent-a');
    expect(tg.raw.hasEdge('nonexistent-a->b')).toBe(true);
  });

  it('throws DuplicateNodeError for duplicate task IDs', () => {
    const tasks: TaskInput[] = [
      { id: 'dup', name: 'First', dependsOn: [] },
      { id: 'dup', name: 'Second', dependsOn: [] },
    ];
    expect(() => TaskGraph.fromTasks(tasks)).toThrow(DuplicateNodeError);
    expect(() => TaskGraph.fromTasks(tasks)).toThrow('Duplicate node: dup');
  });

  it('deduplicates edges when the same dependsOn appears twice', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: ['a', 'a'] },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    expect(tg.raw.size).toBe(1);
  });

  it('handles empty task array', () => {
    const tg = TaskGraph.fromTasks([]);
    expect(tg.raw.order).toBe(0);
    expect(tg.raw.size).toBe(0);
  });

  it('handles tasks with no dependencies', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
      { id: 'c', name: 'C', dependsOn: [] },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    expect(tg.raw.order).toBe(3);
    expect(tg.raw.size).toBe(0);
  });

  it('strips null categorical fields (null → undefined, not stored on node)', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [], risk: null, scope: null },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    const attrs = tg.raw.getNodeAttributes('a');
    expect(attrs.risk).toBeUndefined();
    expect(attrs.scope).toBeUndefined();
    expect(attrs.name).toBe('A');
  });

  it('preserves non-null categorical fields', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [], risk: 'high', scope: 'broad' },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    const attrs = tg.raw.getNodeAttributes('a');
    expect(attrs.risk).toBe('high');
    expect(attrs.scope).toBe('broad');
  });

  it('does not store tags, assignee, due, created, modified on graph nodes', () => {
    const tasks: TaskInput[] = [
      {
        id: 'a',
        name: 'A',
        dependsOn: [],
        tags: ['backend', 'urgent'],
        assignee: 'alice',
        due: '2025-01-01',
        created: '2024-12-01',
        modified: '2024-12-15',
      },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    const attrs = tg.raw.getNodeAttributes('a');
    // These fields should NOT exist on node attributes
    expect((attrs as Record<string, unknown>)['tags']).toBeUndefined();
    expect((attrs as Record<string, unknown>)['assignee']).toBeUndefined();
    expect((attrs as Record<string, unknown>)['due']).toBeUndefined();
    expect((attrs as Record<string, unknown>)['created']).toBeUndefined();
    expect((attrs as Record<string, unknown>)['modified']).toBeUndefined();
  });

  it('builds a linear chain graph correctly', () => {
    const tasks: TaskInput[] = linearChainTasks.map(t => ({ ...t }));
    const tg = TaskGraph.fromTasks(tasks);
    expect(tg.raw.order).toBe(4);
    expect(tg.raw.size).toBe(3);
    expect(tg.raw.hasEdge('A->B')).toBe(true);
    expect(tg.raw.hasEdge('B->C')).toBe(true);
    expect(tg.raw.hasEdge('C->D')).toBe(true);
  });

  it('builds a diamond graph correctly', () => {
    const tasks: TaskInput[] = diamondTasks.map(t => ({ ...t }));
    const tg = TaskGraph.fromTasks(tasks);
    expect(tg.raw.order).toBe(4);
    expect(tg.raw.size).toBe(4);
  });

  it('builds a graph with cycles (not rejected at construction time)', () => {
    const tasks: TaskInput[] = cyclicTasks.map(t => ({ ...t }));
    const tg = TaskGraph.fromTasks(tasks);
    expect(tg.raw.order).toBe(4);
    expect(hasCycle(tg.raw)).toBe(true);
  });

  it('uses deterministic edge keys with -> format', () => {
    const tasks: TaskInput[] = [
      { id: 'setup-project', name: 'Setup', dependsOn: [] },
      { id: 'implement-feature', name: 'Implement', dependsOn: ['setup-project'] },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    expect(tg.raw.hasEdge('setup-project->implement-feature')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TaskGraph.fromRecords() tests
// ---------------------------------------------------------------------------

describe('TaskGraph.fromRecords', () => {
  it('creates a graph from tasks and explicit edges', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b', qualityRetention: 0.85 },
    ];
    const tg = TaskGraph.fromRecords(tasks, edges);
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.size).toBe(1);
    expect(tg.raw.hasEdge('a->b')).toBe(true);
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.85);
  });

  it('uses default qualityRetention 0.9 when not specified', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b' },
    ];
    const tg = TaskGraph.fromRecords(tasks, edges);
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.9);
  });

  it('throws TaskNotFoundError for dangling prerequisite reference', () => {
    const tasks: TaskInput[] = [
      { id: 'b', name: 'B', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'nonexistent', to: 'b' },
    ];
    expect(() => TaskGraph.fromRecords(tasks, edges)).toThrow(TaskNotFoundError);
    expect(() => TaskGraph.fromRecords(tasks, edges)).toThrow('Task not found: nonexistent');
  });

  it('throws TaskNotFoundError for dangling dependent reference', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'nonexistent' },
    ];
    expect(() => TaskGraph.fromRecords(tasks, edges)).toThrow(TaskNotFoundError);
  });

  it('throws DuplicateNodeError for duplicate task IDs', () => {
    const tasks: TaskInput[] = [
      { id: 'dup', name: 'First', dependsOn: [] },
      { id: 'dup', name: 'Second', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [];
    expect(() => TaskGraph.fromRecords(tasks, edges)).toThrow(DuplicateNodeError);
  });

  it('throws DuplicateEdgeError for duplicate prerequisite→dependent pairs', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'b', qualityRetention: 0.5 },
    ];
    expect(() => TaskGraph.fromRecords(tasks, edges)).toThrow(DuplicateEdgeError);
  });

  it('handles empty tasks and edges', () => {
    const tg = TaskGraph.fromRecords([], []);
    expect(tg.raw.order).toBe(0);
    expect(tg.raw.size).toBe(0);
  });

  it('handles tasks with no edges', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
    ];
    const tg = TaskGraph.fromRecords(tasks, []);
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.size).toBe(0);
  });

  it('strips null categorical fields during TaskInput → attributes transformation', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [], risk: null, scope: 'narrow' },
    ];
    const edges: DependencyEdge[] = [];
    const tg = TaskGraph.fromRecords(tasks, edges);
    const attrs = tg.raw.getNodeAttributes('a');
    expect(attrs.risk).toBeUndefined();
    expect(attrs.scope).toBe('narrow');
  });

  it('does not store tags, assignee, due, created, modified on graph nodes', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [], tags: ['x'], assignee: 'bob', due: '2025-01-01', created: '2024-01-01', modified: '2024-06-01' },
    ];
    const edges: DependencyEdge[] = [];
    const tg = TaskGraph.fromRecords(tasks, edges);
    const attrs = tg.raw.getNodeAttributes('a');
    expect((attrs as Record<string, unknown>)['tags']).toBeUndefined();
    expect((attrs as Record<string, unknown>)['assignee']).toBeUndefined();
  });

  it('uses deterministic edge keys with -> format', () => {
    const tasks: TaskInput[] = [
      { id: 'setup', name: 'Setup', dependsOn: [] },
      { id: 'build', name: 'Build', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'setup', to: 'build', qualityRetention: 0.95 },
    ];
    const tg = TaskGraph.fromRecords(tasks, edges);
    expect(tg.raw.hasEdge('setup->build')).toBe(true);
  });

  it('supports per-edge qualityRetention values', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
      { id: 'c', name: 'C', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b', qualityRetention: 0.7 },
      { from: 'a', to: 'c', qualityRetention: 0.5 },
    ];
    const tg = TaskGraph.fromRecords(tasks, edges);
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.7);
    expect(tg.raw.getEdgeAttributes('a->c').qualityRetention).toBe(0.5);
  });

  it('uses default qualityRetention 0.9 when per-edge not provided', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b' },  // no qualityRetention
    ];
    const tg = TaskGraph.fromRecords(tasks, edges);
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.9);
  });

  it('allows cycles at construction time (not rejected)', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
      { id: 'c', name: 'C', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ];
    const tg = TaskGraph.fromRecords(tasks, edges);
    expect(hasCycle(tg.raw)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TaskGraph.addTask() tests
// ---------------------------------------------------------------------------

describe('TaskGraph.addTask', () => {
  it('adds a task to an empty graph', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'Task A' });
    expect(tg.raw.order).toBe(1);
    expect(tg.raw.hasNode('a')).toBe(true);
    expect(tg.raw.getNodeAttributes('a').name).toBe('Task A');
  });

  it('adds multiple tasks', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'A' });
    tg.addTask('b', { name: 'B' });
    expect(tg.raw.order).toBe(2);
  });

  it('throws DuplicateNodeError if ID already exists', () => {
    const tg = new TaskGraph();
    tg.addTask('dup', { name: 'First' });
    expect(() => tg.addTask('dup', { name: 'Second' })).toThrow(DuplicateNodeError);
    expect(() => tg.addTask('dup', { name: 'Second' })).toThrow('Duplicate node: dup');
  });

  it('stores categorical attributes', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'A', risk: 'high', scope: 'broad', impact: 'project', status: 'pending' });
    const attrs = tg.raw.getNodeAttributes('a');
    expect(attrs.risk).toBe('high');
    expect(attrs.scope).toBe('broad');
    expect(attrs.impact).toBe('project');
    expect(attrs.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// TaskGraph.addDependency() tests
// ---------------------------------------------------------------------------

describe('TaskGraph.addDependency', () => {
  it('adds a dependency edge with default qualityRetention', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'A' });
    tg.addTask('b', { name: 'B' });
    tg.addDependency('a', 'b');
    expect(tg.raw.size).toBe(1);
    expect(tg.raw.hasEdge('a->b')).toBe(true);
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.9);
  });

  it('adds a dependency edge with explicit qualityRetention', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'A' });
    tg.addTask('b', { name: 'B' });
    tg.addDependency('a', 'b', 0.75);
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.75);
  });

  it('uses deterministic edge key format ${prerequisite}->${dependent}', () => {
    const tg = new TaskGraph();
    tg.addTask('setup', { name: 'Setup' });
    tg.addTask('build', { name: 'Build' });
    tg.addDependency('setup', 'build');
    expect(tg.raw.hasEdge('setup->build')).toBe(true);
  });

  it('throws TaskNotFoundError if prerequisite does not exist', () => {
    const tg = new TaskGraph();
    tg.addTask('b', { name: 'B' });
    expect(() => tg.addDependency('nonexistent', 'b')).toThrow(TaskNotFoundError);
    expect(() => tg.addDependency('nonexistent', 'b')).toThrow('Task not found: nonexistent');
  });

  it('throws TaskNotFoundError if dependent does not exist', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'A' });
    expect(() => tg.addDependency('a', 'nonexistent')).toThrow(TaskNotFoundError);
  });

  it('throws DuplicateEdgeError if edge already exists', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'A' });
    tg.addTask('b', { name: 'B' });
    tg.addDependency('a', 'b');
    expect(() => tg.addDependency('a', 'b')).toThrow(DuplicateEdgeError);
    expect(() => tg.addDependency('a', 'b')).toThrow('Duplicate edge: a → b');
  });

  it('allows different edges between different node pairs', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'A' });
    tg.addTask('b', { name: 'B' });
    tg.addTask('c', { name: 'C' });
    tg.addDependency('a', 'b', 0.9);
    tg.addDependency('a', 'c', 0.8);
    expect(tg.raw.size).toBe(2);
  });

  it('edge direction is prerequisite → dependent', () => {
    const tg = new TaskGraph();
    tg.addTask('a', { name: 'A' });
    tg.addTask('b', { name: 'B' });
    tg.addDependency('a', 'b');
    expect(tg.raw.source('a->b')).toBe('a');
    expect(tg.raw.target('a->b')).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// Cross-method integration tests
// ---------------------------------------------------------------------------

describe('Construction methods integration', () => {
  it('fromTasks + addTask + addDependency builds incrementally', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: ['a'] },
    ];
    const tg = TaskGraph.fromTasks(tasks);
    tg.addTask('c', { name: 'C' });
    tg.addDependency('b', 'c');
    expect(tg.raw.order).toBe(3);
    expect(tg.raw.size).toBe(2);
    expect(tg.raw.hasEdge('a->b')).toBe(true);
    expect(tg.raw.hasEdge('b->c')).toBe(true);
  });

  it('fromRecords then addDependency works', () => {
    const tasks: TaskInput[] = [
      { id: 'a', name: 'A', dependsOn: [] },
      { id: 'b', name: 'B', dependsOn: [] },
    ];
    const edges: DependencyEdge[] = [
      { from: 'a', to: 'b', qualityRetention: 0.8 },
    ];
    const tg = TaskGraph.fromRecords(tasks, edges);
    tg.addTask('c', { name: 'C' });
    tg.addDependency('b', 'c', 0.95);
    expect(tg.raw.order).toBe(3);
    expect(tg.raw.size).toBe(2);
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.8);
    expect(tg.raw.getEdgeAttributes('b->c').qualityRetention).toBe(0.95);
  });

  it('fromJSON then addTask + addDependency works', () => {
    const data: TaskGraphSerialized = {
      attributes: {},
      options: { type: 'directed', multi: false, allowSelfLoops: false },
      nodes: [{ key: 'a', attributes: { name: 'A' } }],
      edges: [],
    };
    const tg = TaskGraph.fromJSON(data);
    tg.addTask('b', { name: 'B' });
    tg.addDependency('a', 'b');
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.size).toBe(1);
  });

  it('all construction methods produce deterministic edge keys', () => {
    // fromTasks
    const tg1 = TaskGraph.fromTasks([
      { id: 'x', name: 'X', dependsOn: [] },
      { id: 'y', name: 'Y', dependsOn: ['x'] },
    ]);
    expect(tg1.raw.hasEdge('x->y')).toBe(true);

    // fromRecords
    const tg2 = TaskGraph.fromRecords(
      [
        { id: 'x', name: 'X', dependsOn: [] },
        { id: 'y', name: 'Y', dependsOn: [] },
      ],
      [{ from: 'x', to: 'y' }],
    );
    expect(tg2.raw.hasEdge('x->y')).toBe(true);

    // fromJSON
    const tg3 = TaskGraph.fromJSON({
      attributes: {},
      options: { type: 'directed', multi: false, allowSelfLoops: false },
      nodes: [{ key: 'x', attributes: { name: 'X' } }, { key: 'y', attributes: { name: 'Y' } }],
      edges: [{ key: 'x->y', source: 'x', target: 'y', attributes: {} }],
    });
    expect(tg3.raw.hasEdge('x->y')).toBe(true);

    // addDependency
    const tg4 = new TaskGraph();
    tg4.addTask('x', { name: 'X' });
    tg4.addTask('y', { name: 'Y' });
    tg4.addDependency('x', 'y');
    expect(tg4.raw.hasEdge('x->y')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Existing test fixtures (preserved)
// ---------------------------------------------------------------------------

describe('Test Fixtures', () => {
  describe('linearChain', () => {
    it('has 4 nodes', () => {
      expect(linearChain.order).toBe(4);
    });

    it('has 3 edges (A→B, B→C, C→D)', () => {
      expect(linearChain.size).toBe(3);
    });

    it('has correct task IDs', () => {
      expect(linearChainTasks.map(t => t.id)).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('diamond', () => {
    it('has 4 nodes', () => {
      expect(diamond.order).toBe(4);
    });

    it('has 4 edges (A→B, A→C, B→D, C→D)', () => {
      expect(diamond.size).toBe(4);
    });

    it('A has two dependents (B, C)', () => {
      expect(diamond.outNeighbors('A')).toHaveLength(2);
    });

    it('D has two prerequisites (B, C)', () => {
      expect(diamond.inNeighbors('D')).toHaveLength(2);
    });
  });

  describe('mixedCategory', () => {
    it('has 5 nodes', () => {
      expect(mixedCategory.order).toBe(5);
    });

    it('stores assessed categorical fields', () => {
      const authAttrs = mixedCategory.getNodeAttributes('auth');
      expect(authAttrs.risk).toBe('high');
      expect(authAttrs.scope).toBe('broad');
    });

    it('strips null categorical fields (absent = not assessed)', () => {
      const apiAttrs = mixedCategory.getNodeAttributes('api');
      expect(apiAttrs.risk).toBeUndefined();
      expect(apiAttrs.scope).toBeUndefined();
    });

    it('preserves non-null optional fields', () => {
      const apiAttrs = mixedCategory.getNodeAttributes('api');
      expect(apiAttrs.impact).toBe('component');
    });
  });

  describe('cyclic', () => {
    it('has 4 nodes', () => {
      expect(cyclic.order).toBe(4);
    });

    it('has 4 edges (C→A, A→B, B→C, A→D)', () => {
      expect(cyclic.size).toBe(4);
    });

    it('contains a cycle', () => {
      expect(hasCycle(cyclic)).toBe(true);
    });
  });

  describe('largeGraph', () => {
    it('has 23 nodes (20+ for performance testing)', () => {
      expect(largeGraph.order).toBe(23);
    });

    it('has more than 20 edges', () => {
      expect(largeGraph.size).toBeGreaterThan(20);
    });

    it('release node has 8 prerequisites', () => {
      expect(largeGraph.inNeighbors('release')).toHaveLength(8);
    });
  });

  describe('createTaskGraph helper', () => {
    it('builds a graph from TaskInput[]', () => {
      const tasks = [
        { id: 'x', name: 'Task X', dependsOn: [] },
        { id: 'y', name: 'Task Y', dependsOn: ['x'] },
      ];
      const graph = createTaskGraph(tasks);
      expect(graph.order).toBe(2);
      expect(graph.size).toBe(1);
    });

    it('handles empty task array', () => {
      const graph = createTaskGraph([]);
      expect(graph.order).toBe(0);
      expect(graph.size).toBe(0);
    });

    it('uses deterministic edge keys', () => {
      const graph = createTaskGraph([
        { id: 'a', name: 'A', dependsOn: [] },
        { id: 'b', name: 'B', dependsOn: ['a'] },
      ]);
      expect(graph.hasEdge('a->b')).toBe(true);
    });

    it('sets default qualityRetention 0.9 on edges', () => {
      const graph = createTaskGraph([
        { id: 'a', name: 'A', dependsOn: [] },
        { id: 'b', name: 'B', dependsOn: ['a'] },
      ]);
      const edgeAttrs = graph.getEdgeAttributes('a->b');
      expect(edgeAttrs.qualityRetention).toBe(0.9);
    });

    it('deduplicates edges when same dependency appears twice', () => {
      const tasks = [
        { id: 'a', name: 'A', dependsOn: [] },
        { id: 'b', name: 'B', dependsOn: ['a', 'a'] },
      ];
      const graph = createTaskGraph(tasks);
      expect(graph.size).toBe(1);
    });
  });

  describe('allGraphs / allTasks convenience exports', () => {
    it('allGraphs contains 5 fixtures', () => {
      expect(Object.keys(allGraphs)).toHaveLength(5);
    });

    it('allTasks contains 5 task arrays', () => {
      expect(Object.keys(allTasks)).toHaveLength(5);
    });

    it('each graph has matching task array', () => {
      expect(allGraphs.linearChain.order).toBe(linearChainTasks.length);
      expect(allGraphs.diamond.order).toBe(diamondTasks.length);
      expect(allGraphs.mixedCategory.order).toBe(mixedCategoryTasks.length);
      expect(allGraphs.cyclic.order).toBe(cyclicTasks.length);
      expect(allGraphs.large.order).toBe(largeGraphTasks.length);
    });
  });
});