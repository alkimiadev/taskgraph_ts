import { describe, it, expect } from 'vitest';
import { parallelGroups } from '../src/analysis/parallel-groups.js';
import { TaskGraph } from '../src/graph/index.js';
import { CircularDependencyError } from '../src/error/index.js';
import type { TaskGraphSerialized } from '../src/schema/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple linear DAG: A → B → C → D */
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

/** Create a diamond DAG:
 *     A
 *    / \
 *   B   C
 *    \ /
 *     D
 */
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

/** Create a disconnected graph with two independent components:
 *   Component 1: X → Y
 *   Component 2: P → Q → R
 */
function makeDisconnected(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'X', attributes: { name: 'Task X' } },
      { key: 'Y', attributes: { name: 'Task Y' } },
      { key: 'P', attributes: { name: 'Task P' } },
      { key: 'Q', attributes: { name: 'Task Q' } },
      { key: 'R', attributes: { name: 'Task R' } },
    ],
    edges: [
      { key: 'X->Y', source: 'X', target: 'Y', attributes: {} },
      { key: 'P->Q', source: 'P', target: 'Q', attributes: {} },
      { key: 'Q->R', source: 'Q', target: 'R', attributes: {} },
    ],
  };
  return new TaskGraph(data);
}

/** Create a cyclic graph: A → B → C → A */
function makeCyclic(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'A', attributes: { name: 'Task A' } },
      { key: 'B', attributes: { name: 'Task B' } },
      { key: 'C', attributes: { name: 'Task C' } },
    ],
    edges: [
      { key: 'A->B', source: 'A', target: 'B', attributes: {} },
      { key: 'B->C', source: 'B', target: 'C', attributes: {} },
      { key: 'C->A', source: 'C', target: 'A', attributes: {} },
    ],
  };
  return new TaskGraph(data);
}

/** Create an empty graph */
function makeEmpty(): TaskGraph {
  return new TaskGraph();
}

/** Create a single-node graph */
function makeSingleNode(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [{ key: 'only', attributes: { name: 'Only task' } }],
    edges: [],
  };
  return new TaskGraph(data);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parallelGroups', () => {
  // ---------------------------------------------------------------------------
  // Linear chain: each group has size 1
  // ---------------------------------------------------------------------------

  describe('linear chain (A → B → C → D)', () => {
    it('returns 4 groups, each with size 1', () => {
      const graph = makeLinearChain();
      const groups = parallelGroups(graph);

      expect(groups).toHaveLength(4);
      for (const group of groups) {
        expect(group).toHaveLength(1);
      }
    });

    it('places A (no prerequisites) in the first group', () => {
      const graph = makeLinearChain();
      const groups = parallelGroups(graph);

      expect(groups[0]).toEqual(['A']);
    });

    it('preserves topological order across groups', () => {
      const graph = makeLinearChain();
      const groups = parallelGroups(graph);

      // Flatten groups to get topological order
      const flat = groups.flat();
      expect(flat).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  // ---------------------------------------------------------------------------
  // Diamond graph: B and C are parallel (same depth)
  // ---------------------------------------------------------------------------

  describe('diamond graph', () => {
    it('returns 3 groups', () => {
      const graph = makeDiamond();
      const groups = parallelGroups(graph);

      expect(groups).toHaveLength(3);
    });

    it('places A (no prerequisites) in the first group', () => {
      const graph = makeDiamond();
      const groups = parallelGroups(graph);

      expect(groups[0]).toEqual(['A']);
    });

    it('places B and C in the same group (parallel)', () => {
      const graph = makeDiamond();
      const groups = parallelGroups(graph);

      // B and C are at the same depth from source A
      const secondGroup = groups[1];
      expect(secondGroup).toHaveLength(2);
      expect(secondGroup).toContain('B');
      expect(secondGroup).toContain('C');
    });

    it('places D (depends on B and C) in the last group', () => {
      const graph = makeDiamond();
      const groups = parallelGroups(graph);

      expect(groups[2]).toEqual(['D']);
    });
  });

  // ---------------------------------------------------------------------------
  // Disconnected components
  // ---------------------------------------------------------------------------

  describe('disconnected components', () => {
    it('handles disconnected graphs correctly', () => {
      const graph = makeDisconnected();
      const groups = parallelGroups(graph);

      // X and P have no prerequisites, so they should be in the first group
      const firstGroup = groups[0];
      expect(firstGroup).toContain('X');
      expect(firstGroup).toContain('P');

      // Y and Q are at depth 1 from their respective sources
      const secondGroup = groups[1];
      expect(secondGroup).toContain('Y');
      expect(secondGroup).toContain('Q');

      // R is at depth 2 (P → Q → R)
      const thirdGroup = groups[2];
      expect(thirdGroup).toContain('R');
    });

    it('includes all nodes across all groups', () => {
      const graph = makeDisconnected();
      const groups = parallelGroups(graph);

      const allNodes = groups.flat().sort();
      expect(allNodes).toEqual(['P', 'Q', 'R', 'X', 'Y']);
    });
  });

  // ---------------------------------------------------------------------------
  // Cyclic graph
  // ---------------------------------------------------------------------------

  describe('cyclic graph', () => {
    it('throws CircularDependencyError', () => {
      const graph = makeCyclic();

      expect(() => parallelGroups(graph)).toThrow(CircularDependencyError);
    });

    it('populates cycles on the error', () => {
      const graph = makeCyclic();

      try {
        parallelGroups(graph);
        expect.unreachable('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CircularDependencyError);
        const cde = err as CircularDependencyError;
        expect(cde.cycles.length).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('returns empty array for empty graph', () => {
      const graph = makeEmpty();
      const groups = parallelGroups(graph);

      expect(groups).toEqual([]);
    });

    it('returns single group for a single node', () => {
      const graph = makeSingleNode();
      const groups = parallelGroups(graph);

      expect(groups).toEqual([['only']]);
    });
  });

  // ---------------------------------------------------------------------------
  // fromTasks integration
  // ---------------------------------------------------------------------------

  describe('fromTasks integration', () => {
    it('works with TaskGraph.fromTasks()', () => {
      const graph = TaskGraph.fromTasks([
        { id: 'A', name: 'Task A', dependsOn: [] },
        { id: 'B', name: 'Task B', dependsOn: ['A'] },
        { id: 'C', name: 'Task C', dependsOn: ['A'] },
        { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
      ]);

      const groups = parallelGroups(graph);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toEqual(['A']);
      expect(groups[1]).toHaveLength(2);
      expect(groups[1]).toContain('B');
      expect(groups[1]).toContain('C');
      expect(groups[2]).toEqual(['D']);
    });
  });
});