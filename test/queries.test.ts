import { describe, it, expect } from 'vitest';
import { TaskGraph } from '../src/graph/index.js';
import {
  hasCycles,
  findCycles,
  topologicalOrder,
  dependencies,
  dependents,
  taskCount,
  getTask,
} from '../src/graph/queries.js';
import { TaskNotFoundError, CircularDependencyError } from '../src/error/index.js';
import type { TaskGraphSerialized } from '../src/schema/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple DAG: A → B → C → D */
function makeLinearChain(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'A', attributes: { name: 'Task A' } },
      { key: 'B', attributes: { name: 'Task B' } },
      { key: 'C', attributes: { name: 'Task C' } },
      { key: 'D', attributes: { name: 'Task D' } },
    ],
    edges: [
      { key: 'A->B', source: 'A', target: 'B', attributes: {} },
      { key: 'B->C', source: 'B', target: 'C', attributes: {} },
      { key: 'C->D', source: 'C', target: 'D', attributes: {} },
    ],
  };
  return new TaskGraph(data);
}

/** Create a diamond DAG: A → B → D, A → C → D */
function makeDiamond(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'A', attributes: { name: 'Task A' } },
      { key: 'B', attributes: { name: 'Task B' } },
      { key: 'C', attributes: { name: 'Task C' } },
      { key: 'D', attributes: { name: 'Task D' } },
    ],
    edges: [
      { key: 'A->B', source: 'A', target: 'B', attributes: {} },
      { key: 'A->C', source: 'A', target: 'C', attributes: {} },
      { key: 'B->D', source: 'B', target: 'D', attributes: {} },
      { key: 'C->D', source: 'C', target: 'D', attributes: {} },
    ],
  };
  return new TaskGraph(data);
}

/** Create a cyclic graph: A → B → C → A (cycle), plus A → D (non-cyclic branch) */
function makeCyclic(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'A', attributes: { name: 'Task A' } },
      { key: 'B', attributes: { name: 'Task B' } },
      { key: 'C', attributes: { name: 'Task C' } },
      { key: 'D', attributes: { name: 'Task D' } },
    ],
    edges: [
      { key: 'A->B', source: 'A', target: 'B', attributes: {} },
      { key: 'B->C', source: 'B', target: 'C', attributes: {} },
      { key: 'C->A', source: 'C', target: 'A', attributes: {} },
      { key: 'A->D', source: 'A', target: 'D', attributes: {} },
    ],
  };
  return new TaskGraph(data);
}

/** Create a graph with two independent cycles: A→B→C→A and X→Y→X */
function makeTwoCycles(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'A', attributes: { name: 'A' } },
      { key: 'B', attributes: { name: 'B' } },
      { key: 'C', attributes: { name: 'C' } },
      { key: 'X', attributes: { name: 'X' } },
      { key: 'Y', attributes: { name: 'Y' } },
    ],
    edges: [
      { key: 'A->B', source: 'A', target: 'B', attributes: {} },
      { key: 'B->C', source: 'B', target: 'C', attributes: {} },
      { key: 'C->A', source: 'C', target: 'A', attributes: {} },
      { key: 'X->Y', source: 'X', target: 'Y', attributes: {} },
      { key: 'Y->X', source: 'Y', target: 'X', attributes: {} },
    ],
  };
  return new TaskGraph(data);
}

/** Create an empty graph with no nodes */
function makeEmpty(): TaskGraph {
  return new TaskGraph();
}

// ---------------------------------------------------------------------------
// Tests: hasCycles
// ---------------------------------------------------------------------------

describe('hasCycles', () => {
  it('returns false for an empty graph', () => {
    const g = makeEmpty();
    expect(hasCycles(g.raw)).toBe(false);
    expect(g.hasCycles()).toBe(false);
  });

  it('returns false for a linear chain (DAG)', () => {
    const g = makeLinearChain();
    expect(hasCycles(g.raw)).toBe(false);
    expect(g.hasCycles()).toBe(false);
  });

  it('returns false for a diamond DAG', () => {
    const g = makeDiamond();
    expect(hasCycles(g.raw)).toBe(false);
  });

  it('returns true for a cyclic graph', () => {
    const g = makeCyclic();
    expect(hasCycles(g.raw)).toBe(true);
    expect(g.hasCycles()).toBe(true);
  });

  it('returns true for a graph with two independent cycles', () => {
    const g = makeTwoCycles();
    expect(hasCycles(g.raw)).toBe(true);
  });

  it('returns false for a single node with no edges', () => {
    const g = new TaskGraph();
    g.raw.addNode('only', { name: 'Only' });
    expect(hasCycles(g.raw)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: findCycles
// ---------------------------------------------------------------------------

describe('findCycles', () => {
  it('returns empty array for an empty graph', () => {
    const g = makeEmpty();
    expect(findCycles(g.raw)).toEqual([]);
    expect(g.findCycles()).toEqual([]);
  });

  it('returns empty array for an acyclic graph', () => {
    const g = makeLinearChain();
    expect(findCycles(g.raw)).toEqual([]);
  });

  it('returns empty array for a diamond DAG', () => {
    const g = makeDiamond();
    expect(findCycles(g.raw)).toEqual([]);
  });

  it('finds a single cycle in a simple cyclic graph (A→B→C→A)', () => {
    const g = makeCyclic();
    const cycles = findCycles(g.raw);
    expect(cycles.length).toBeGreaterThanOrEqual(1);

    // At least one cycle should contain A, B, C
    const cycle = cycles[0]!;
    expect(cycle).toContain('A');
    expect(cycle).toContain('B');
    expect(cycle).toContain('C');

    // The cycle should be an ordered path where last→first is an edge
    const first = cycle[0]!;
    const last = cycle[cycle.length - 1]!;
    expect(g.raw.hasEdge(last, first)).toBe(true);
  });

  it('each cycle is an ordered path: last node has edge to first', () => {
    const g = makeCyclic();
    const cycles = findCycles(g.raw);
    for (const cycle of cycles) {
      if (cycle.length > 1) {
        const first = cycle[0]!;
        const last = cycle[cycle.length - 1]!;
        expect(g.raw.hasEdge(last, first)).toBe(true);
      }
    }
  });

  it('finds cycles in a graph with two independent cycles', () => {
    const g = makeTwoCycles();
    const cycles = findCycles(g.raw);
    // Should find at least 2 cycles (one in each component)
    expect(cycles.length).toBeGreaterThanOrEqual(2);

    // Check that we have cycles covering both components
    const allNodes = cycles.flat();
    expect(allNodes).toContain('A');
    expect(allNodes).toContain('B');
    expect(allNodes).toContain('C');
    expect(allNodes).toContain('X');
    expect(allNodes).toContain('Y');
  });

  it('uses SCC pre-check optimization (skips DFS for acyclic graphs)', () => {
    // This tests the optimization path: for acyclic graphs,
    // findCycles should return [] quickly without running DFS.
    // We just verify the result is correct; the optimization is internal.
    const g = makeLinearChain();
    expect(findCycles(g.raw)).toEqual([]);
  });

  it('returns one representative cycle per back edge, not exhaustive enumeration', () => {
    const g = makeCyclic();
    const cycles = findCycles(g.raw);
    // A→B→C→A has one back edge (C→A), so we should get exactly 1 cycle
    expect(cycles.length).toBe(1);
  });

  it('finds cycle in a two-node cycle: X→Y→X', () => {
    const data: TaskGraphSerialized = {
      attributes: {},
      options: { type: 'directed', multi: false, allowSelfLoops: false },
      nodes: [
        { key: 'X', attributes: { name: 'X' } },
        { key: 'Y', attributes: { name: 'Y' } },
      ],
      edges: [
        { key: 'X->Y', source: 'X', target: 'Y', attributes: {} },
        { key: 'Y->X', source: 'Y', target: 'X', attributes: {} },
      ],
    };
    const g = new TaskGraph(data);
    const cycles = findCycles(g.raw);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    const cycle = cycles[0]!;
    expect(cycle).toContain('X');
    expect(cycle).toContain('Y');
    expect(cycle.length).toBe(2);
    // Last → first should be an edge
    expect(g.raw.hasEdge(cycle[cycle.length - 1]!, cycle[0]!)).toBe(true);
  });

  it('TaskGraph instance method delegates to the free function', () => {
    const g = makeCyclic();
    const fromFunction = findCycles(g.raw);
    const fromMethod = g.findCycles();
    expect(fromFunction).toEqual(fromMethod);
  });
});

// ---------------------------------------------------------------------------
// Tests: topologicalOrder
// ---------------------------------------------------------------------------

describe('topologicalOrder', () => {
  it('returns correct topological order for a linear chain', () => {
    const g = makeLinearChain();
    const order = topologicalOrder(g.raw);
    expect(order).toEqual(['A', 'B', 'C', 'D']);
    expect(g.topologicalOrder()).toEqual(order);
  });

  it('returns valid topological order for a diamond DAG', () => {
    const g = makeDiamond();
    const order = topologicalOrder(g.raw);
    // A must come before B and C, which must both come before D
    const aIdx = order.indexOf('A');
    const bIdx = order.indexOf('B');
    const cIdx = order.indexOf('C');
    const dIdx = order.indexOf('D');
    expect(aIdx).toBeLessThan(bIdx);
    expect(aIdx).toBeLessThan(cIdx);
    expect(bIdx).toBeLessThan(dIdx);
    expect(cIdx).toBeLessThan(dIdx);
    expect(order).toHaveLength(4);
  });

  it('returns single node order for a single-node graph', () => {
    const g = new TaskGraph();
    g.raw.addNode('only', { name: 'Only' });
    expect(topologicalOrder(g.raw)).toEqual(['only']);
  });

  it('returns empty array for an empty graph', () => {
    const g = makeEmpty();
    expect(topologicalOrder(g.raw)).toEqual([]);
  });

  it('throws CircularDependencyError when graph is cyclic', () => {
    const g = makeCyclic();
    expect(() => topologicalOrder(g.raw)).toThrow(CircularDependencyError);
    expect(() => g.topologicalOrder()).toThrow(CircularDependencyError);
  });

  it('CircularDependencyError contains cycles from findCycles', () => {
    const g = makeCyclic();
    try {
      topologicalOrder(g.raw);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CircularDependencyError);
      const err = e as CircularDependencyError;
      expect(err.cycles.length).toBeGreaterThanOrEqual(1);
      // The cycle should contain A, B, C
      const cycle = err.cycles[0]!;
      expect(cycle).toContain('A');
      expect(cycle).toContain('B');
      expect(cycle).toContain('C');
    }
  });

  it('CircularDependencyError message includes cycle description', () => {
    const g = makeCyclic();
    try {
      topologicalOrder(g.raw);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CircularDependencyError);
      expect((e as Error).message).toContain('Circular dependency');
    }
  });

  it('throws with multiple cycles when graph has multiple independent cycles', () => {
    const g = makeTwoCycles();
    try {
      topologicalOrder(g.raw);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(CircularDependencyError);
      const err = e as CircularDependencyError;
      // Should contain cycles from both components
      expect(err.cycles.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns prerequisite→dependent order (prerequisites always before dependents)', () => {
    const data: TaskGraphSerialized = {
      attributes: {},
      options: { type: 'directed', multi: false, allowSelfLoops: false },
      nodes: [
        { key: 'setup', attributes: { name: 'Setup' } },
        { key: 'impl', attributes: { name: 'Implementation' } },
        { key: 'test', attributes: { name: 'Test' } },
        { key: 'deploy', attributes: { name: 'Deploy' } },
      ],
      edges: [
        { key: 'setup->impl', source: 'setup', target: 'impl', attributes: {} },
        { key: 'impl->test', source: 'impl', target: 'test', attributes: {} },
        { key: 'test->deploy', source: 'test', target: 'deploy', attributes: {} },
      ],
    };
    const g = new TaskGraph(data);
    const order = topologicalOrder(g.raw);
    expect(order).toEqual(['setup', 'impl', 'test', 'deploy']);
  });
});

// ---------------------------------------------------------------------------
// Tests: dependencies
// ---------------------------------------------------------------------------

describe('dependencies', () => {
  it('returns prerequisites for a node with dependencies', () => {
    const g = makeLinearChain();
    expect(dependencies(g.raw, 'B')).toEqual(['A']);
    expect(g.dependencies('B')).toEqual(['A']);
  });

  it('returns empty array for a root node (no prerequisites)', () => {
    const g = makeLinearChain();
    expect(dependencies(g.raw, 'A')).toEqual([]);
  });

  it('returns multiple prerequisites for a merge node', () => {
    const g = makeDiamond();
    const deps = dependencies(g.raw, 'D');
    expect(deps).toHaveLength(2);
    expect(deps).toContain('B');
    expect(deps).toContain('C');
  });

  it('throws TaskNotFoundError for non-existent task ID', () => {
    const g = makeLinearChain();
    expect(() => dependencies(g.raw, 'nonexistent')).toThrow(TaskNotFoundError);
    expect(() => g.dependencies('nonexistent')).toThrow(TaskNotFoundError);
  });

  it('error contains the missing task ID', () => {
    const g = makeLinearChain();
    try {
      dependencies(g.raw, 'missing');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TaskNotFoundError);
      expect((e as TaskNotFoundError).taskId).toBe('missing');
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: dependents
// ---------------------------------------------------------------------------

describe('dependents', () => {
  it('returns dependents for a node with outgoing edges', () => {
    const g = makeLinearChain();
    expect(dependents(g.raw, 'A')).toEqual(['B']);
    expect(g.dependents('A')).toEqual(['B']);
  });

  it('returns empty array for a leaf node (no dependents)', () => {
    const g = makeLinearChain();
    expect(dependents(g.raw, 'D')).toEqual([]);
  });

  it('returns multiple dependents for a fan-out node', () => {
    const g = makeDiamond();
    const deps = dependents(g.raw, 'A');
    expect(deps).toHaveLength(2);
    expect(deps).toContain('B');
    expect(deps).toContain('C');
  });

  it('throws TaskNotFoundError for non-existent task ID', () => {
    const g = makeLinearChain();
    expect(() => dependents(g.raw, 'nonexistent')).toThrow(TaskNotFoundError);
    expect(() => g.dependents('nonexistent')).toThrow(TaskNotFoundError);
  });

  it('error contains the missing task ID', () => {
    const g = makeLinearChain();
    try {
      dependents(g.raw, 'missing');
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TaskNotFoundError);
      expect((e as TaskNotFoundError).taskId).toBe('missing');
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: taskCount
// ---------------------------------------------------------------------------

describe('taskCount', () => {
  it('returns 0 for an empty graph', () => {
    const g = makeEmpty();
    expect(taskCount(g.raw)).toBe(0);
    expect(g.taskCount()).toBe(0);
  });

  it('returns correct count for a linear chain', () => {
    const g = makeLinearChain();
    expect(taskCount(g.raw)).toBe(4);
  });

  it('returns correct count for a diamond graph', () => {
    const g = makeDiamond();
    expect(taskCount(g.raw)).toBe(4);
  });

  it('returns correct count for the large graph fixture', () => {
    const data: TaskGraphSerialized = {
      attributes: {},
      options: { type: 'directed', multi: false, allowSelfLoops: false },
      nodes: Array.from({ length: 23 }, (_, i) => ({
        key: `task-${i}`,
        attributes: { name: `Task ${i}` },
      })),
      edges: [],
    };
    const g = new TaskGraph(data);
    expect(taskCount(g.raw)).toBe(23);
  });

  it('TaskGraph instance method delegates to the free function', () => {
    const g = makeLinearChain();
    expect(g.taskCount()).toBe(taskCount(g.raw));
  });
});

// ---------------------------------------------------------------------------
// Tests: getTask
// ---------------------------------------------------------------------------

describe('getTask', () => {
  it('returns node attributes for an existing task', () => {
    const g = makeLinearChain();
    const attrs = getTask(g.raw, 'A');
    expect(attrs).toBeDefined();
    expect(attrs!.name).toBe('Task A');
    expect(g.getTask('A')).toEqual(attrs);
  });

  it('returns undefined for a non-existent task', () => {
    const g = makeLinearChain();
    expect(getTask(g.raw, 'nonexistent')).toBeUndefined();
    expect(g.getTask('nonexistent')).toBeUndefined();
  });

  it('returns all attributes including optional categorical fields', () => {
    const data: TaskGraphSerialized = {
      attributes: {},
      options: { type: 'directed', multi: false, allowSelfLoops: false },
      nodes: [
        {
          key: 'auth',
          attributes: {
            name: 'Auth module',
            risk: 'high',
            scope: 'broad',
            impact: 'phase',
          },
        },
      ],
      edges: [],
    };
    const g = new TaskGraph(data);
    const attrs = getTask(g.raw, 'auth');
    expect(attrs).toBeDefined();
    expect(attrs!.name).toBe('Auth module');
    expect(attrs!.risk).toBe('high');
    expect(attrs!.scope).toBe('broad');
    expect(attrs!.impact).toBe('phase');
  });

  it('returns attributes with undefined for absent optional fields', () => {
    const g = makeLinearChain();
    const attrs = getTask(g.raw, 'A');
    expect(attrs).toBeDefined();
    expect(attrs!.risk).toBeUndefined();
    expect(attrs!.scope).toBeUndefined();
  });

  it('returns undefined for an empty graph', () => {
    const g = makeEmpty();
    expect(getTask(g.raw, 'any')).toBeUndefined();
  });
});