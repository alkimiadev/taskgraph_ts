import { describe, it, expect } from 'vitest';
import { TaskGraph } from '../src/graph/index.js';
import { TaskNotFoundError } from '../src/error/index.js';
import type { TaskGraphSerialized } from '../src/schema/index.js';

// ---------------------------------------------------------------------------
// Mutation method tests (acceptance criteria from task file)
// ---------------------------------------------------------------------------

/**
 * Helper: create a simple TaskGraph with two nodes and one edge.
 * Graph: A → B  (edge key: "a->b")
 */
function createSimpleGraph(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'a', attributes: { name: 'Task A', risk: 'low', scope: 'narrow' } },
      { key: 'b', attributes: { name: 'Task B', risk: 'medium', impact: 'component' } },
    ],
    edges: [
      { key: 'a->b', source: 'a', target: 'b', attributes: { qualityRetention: 0.9 } },
    ],
  };
  return new TaskGraph(data);
}

/**
 * Helper: create a diamond TaskGraph.
 * Graph: A → B, A → C, B → D, C → D
 */
function createDiamondGraph(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'a', attributes: { name: 'Task A' } },
      { key: 'b', attributes: { name: 'Task B' } },
      { key: 'c', attributes: { name: 'Task C' } },
      { key: 'd', attributes: { name: 'Task D' } },
    ],
    edges: [
      { key: 'a->b', source: 'a', target: 'b', attributes: { qualityRetention: 0.9 } },
      { key: 'a->c', source: 'a', target: 'c', attributes: { qualityRetention: 0.85 } },
      { key: 'b->d', source: 'b', target: 'd', attributes: { qualityRetention: 0.9 } },
      { key: 'c->d', source: 'c', target: 'd', attributes: { qualityRetention: 0.8 } },
    ],
  };
  return new TaskGraph(data);
}

// ---------------------------------------------------------------------------
// removeTask
// ---------------------------------------------------------------------------

describe('removeTask', () => {
  it('removes an existing task from the graph', () => {
    const tg = createSimpleGraph();
    expect(tg.raw.hasNode('a')).toBe(true);
    tg.removeTask('a');
    expect(tg.raw.hasNode('a')).toBe(false);
  });

  it('cascades edge removal (graphology handles this automatically)', () => {
    const tg = createSimpleGraph();
    expect(tg.raw.hasEdge('a->b')).toBe(true);
    tg.removeTask('a');
    // Edge a->b should also be gone because node 'a' was dropped
    expect(tg.raw.hasEdge('a->b')).toBe(false);
    expect(tg.raw.size).toBe(0);
  });

  it('is a no-op when the node does not exist', () => {
    const tg = createSimpleGraph();
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.size).toBe(1);
    // Remove a nonexistent node — should not throw or change the graph
    tg.removeTask('nonexistent');
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.size).toBe(1);
  });

  it('removes all edges attached to the dropped node in a diamond graph', () => {
    const tg = createDiamondGraph();
    // Node 'a' has outgoing edges to b and c
    expect(tg.raw.outNeighbors('a')).toContain('b');
    expect(tg.raw.outNeighbors('a')).toContain('c');
    tg.removeTask('a');
    // All edges from a should be gone
    expect(tg.raw.hasEdge('a->b')).toBe(false);
    expect(tg.raw.hasEdge('a->c')).toBe(false);
    // b, c, d still exist
    expect(tg.raw.hasNode('b')).toBe(true);
    expect(tg.raw.hasNode('c')).toBe(true);
    expect(tg.raw.hasNode('d')).toBe(true);
    // Edges b->d and c->d still exist
    expect(tg.raw.hasEdge('b->d')).toBe(true);
    expect(tg.raw.hasEdge('c->d')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// removeDependency
// ---------------------------------------------------------------------------

describe('removeDependency', () => {
  it('removes an existing edge from the graph', () => {
    const tg = createSimpleGraph();
    expect(tg.raw.hasEdge('a->b')).toBe(true);
    tg.removeDependency('a', 'b');
    expect(tg.raw.hasEdge('a->b')).toBe(false);
    expect(tg.raw.size).toBe(0);
  });

  it('uses the deterministic edge key format ${prerequisite}->${dependent}', () => {
    const tg = createSimpleGraph();
    // The edge key must be exactly "a->b"
    expect(tg.raw.hasEdge('a->b')).toBe(true);
    // After removal, the key should no longer exist
    tg.removeDependency('a', 'b');
    expect(tg.raw.hasEdge('a->b')).toBe(false);
  });

  it('is a no-op when the edge does not exist', () => {
    const tg = createSimpleGraph();
    // Remove a nonexistent edge — should not throw or change the graph
    tg.removeDependency('b', 'a'); // reverse direction doesn't exist
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.size).toBe(1);
  });

  it('is a no-op when neither node exists', () => {
    const tg = createSimpleGraph();
    tg.removeDependency('x', 'y');
    expect(tg.raw.order).toBe(2);
    expect(tg.raw.size).toBe(1);
  });

  it('removes only the specified edge in a multi-edge graph', () => {
    const tg = createDiamondGraph();
    expect(tg.raw.size).toBe(4);
    tg.removeDependency('a', 'b');
    expect(tg.raw.hasEdge('a->b')).toBe(false);
    // Other edges still exist
    expect(tg.raw.hasEdge('a->c')).toBe(true);
    expect(tg.raw.hasEdge('b->d')).toBe(true);
    expect(tg.raw.hasEdge('c->d')).toBe(true);
    expect(tg.raw.size).toBe(3);
  });

  it('preserves nodes after edge removal', () => {
    const tg = createSimpleGraph();
    tg.removeDependency('a', 'b');
    // Both nodes should still exist
    expect(tg.raw.hasNode('a')).toBe(true);
    expect(tg.raw.hasNode('b')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------

describe('updateTask', () => {
  it('merges partial attributes into an existing node', () => {
    const tg = createSimpleGraph();
    // Node 'a' starts with { name: 'Task A', risk: 'low', scope: 'narrow' }
    tg.updateTask('a', { risk: 'high' });
    const attrs = tg.raw.getNodeAttributes('a');
    expect(attrs.name).toBe('Task A'); // unchanged
    expect(attrs.risk).toBe('high'); // updated
    expect(attrs.scope).toBe('narrow'); // unchanged
  });

  it('merges multiple attributes at once', () => {
    const tg = createSimpleGraph();
    tg.updateTask('a', { risk: 'critical', status: 'blocked' });
    const attrs = tg.raw.getNodeAttributes('a');
    expect(attrs.name).toBe('Task A'); // unchanged
    expect(attrs.risk).toBe('critical'); // updated
    expect(attrs.scope).toBe('narrow'); // unchanged
    expect(attrs.status).toBe('blocked'); // newly set
  });

  it('throws TaskNotFoundError if the task does not exist', () => {
    const tg = createSimpleGraph();
    expect(() => {
      tg.updateTask('nonexistent', { risk: 'high' });
    }).toThrow(TaskNotFoundError);
  });

  it('TaskNotFoundError has the correct taskId property', () => {
    const tg = createSimpleGraph();
    try {
      tg.updateTask('nonexistent', { risk: 'high' });
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TaskNotFoundError);
      const err = e as TaskNotFoundError;
      expect(err.taskId).toBe('nonexistent');
    }
  });

  it('shallow merge — new fields can be added', () => {
    const tg = createSimpleGraph();
    // Node 'b' starts with { name: 'Task B', risk: 'medium', impact: 'component' }
    tg.updateTask('b', { scope: 'broad', level: 'implementation' });
    const attrs = tg.raw.getNodeAttributes('b');
    expect(attrs.name).toBe('Task B');
    expect(attrs.risk).toBe('medium');
    expect(attrs.impact).toBe('component');
    expect(attrs.scope).toBe('broad');
    expect(attrs.level).toBe('implementation');
  });

  it('can update the name field', () => {
    const tg = createSimpleGraph();
    tg.updateTask('a', { name: 'Updated Task A' });
    const attrs = tg.raw.getNodeAttributes('a');
    expect(attrs.name).toBe('Updated Task A');
  });
});

// ---------------------------------------------------------------------------
// updateEdgeAttributes
// ---------------------------------------------------------------------------

describe('updateEdgeAttributes', () => {
  it('merges partial attributes into an existing edge', () => {
    const tg = createSimpleGraph();
    // Edge 'a->b' starts with { qualityRetention: 0.9 }
    tg.updateEdgeAttributes('a', 'b', { qualityRetention: 0.75 });
    const attrs = tg.raw.getEdgeAttributes('a->b');
    expect(attrs.qualityRetention).toBe(0.75);
  });

  it('uses the deterministic edge key format to identify the edge', () => {
    const tg = createDiamondGraph();
    // Update edge a->c (qualityRetention: 0.85)
    tg.updateEdgeAttributes('a', 'c', { qualityRetention: 0.5 });
    const attrs = tg.raw.getEdgeAttributes('a->c');
    expect(attrs.qualityRetention).toBe(0.5);
    // Other edges unchanged
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.9);
    expect(tg.raw.getEdgeAttributes('b->d').qualityRetention).toBe(0.9);
    expect(tg.raw.getEdgeAttributes('c->d').qualityRetention).toBe(0.8);
  });

  it('throws TaskNotFoundError if the edge does not exist', () => {
    const tg = createSimpleGraph();
    expect(() => {
      tg.updateEdgeAttributes('b', 'a', { qualityRetention: 0.5 }); // reverse edge doesn't exist
    }).toThrow(TaskNotFoundError);
  });

  it('throws TaskNotFoundError when neither node exists', () => {
    const tg = createSimpleGraph();
    expect(() => {
      tg.updateEdgeAttributes('x', 'y', { qualityRetention: 0.5 });
    }).toThrow(TaskNotFoundError);
  });

  it('TaskNotFoundError for missing edge has the edge key as taskId', () => {
    const tg = createSimpleGraph();
    try {
      tg.updateEdgeAttributes('x', 'y', { qualityRetention: 0.5 });
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TaskNotFoundError);
      const err = e as TaskNotFoundError;
      expect(err.taskId).toBe('x->y');
    }
  });
});

// ---------------------------------------------------------------------------
// Standalone function tests (via re-exports from module)
// ---------------------------------------------------------------------------

describe('standalone mutation functions', () => {
  it('removeTask is exported from the module', async () => {
    const mod = await import('../src/graph/mutation.js');
    expect(typeof mod.removeTask).toBe('function');
  });

  it('removeDependency is exported from the module', async () => {
    const mod = await import('../src/graph/mutation.js');
    expect(typeof mod.removeDependency).toBe('function');
  });

  it('updateTask is exported from the module', async () => {
    const mod = await import('../src/graph/mutation.js');
    expect(typeof mod.updateTask).toBe('function');
  });

  it('updateEdgeAttributes is exported from the module', async () => {
    const mod = await import('../src/graph/mutation.js');
    expect(typeof mod.updateEdgeAttributes).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// Integration: mutations maintain deterministic edge key format
// ---------------------------------------------------------------------------

describe('mutation edge key format invariants', () => {
  it('removeDependency uses the deterministic key to find the edge', () => {
    const tg = createDiamondGraph();
    // Remove by (prerequisite, dependent) pair — internally uses "a->c" key
    tg.removeDependency('a', 'c');
    expect(tg.raw.hasEdge('a->c')).toBe(false);
    // Verify the edge key is gone from the graph's edge list
    const remainingEdges = [...tg.raw.edges()];
    expect(remainingEdges).not.toContain('a->c');
    expect(remainingEdges).toContain('a->b');
  });

  it('updateEdgeAttributes uses the deterministic key to find the edge', () => {
    const tg = createDiamondGraph();
    tg.updateEdgeAttributes('b', 'd', { qualityRetention: 0.5 });
    // Only the edge "b->d" is affected
    expect(tg.raw.getEdgeAttributes('b->d').qualityRetention).toBe(0.5);
    expect(tg.raw.getEdgeAttributes('a->b').qualityRetention).toBe(0.9);
    expect(tg.raw.getEdgeAttributes('a->c').qualityRetention).toBe(0.85);
    expect(tg.raw.getEdgeAttributes('c->d').qualityRetention).toBe(0.8);
  });
});