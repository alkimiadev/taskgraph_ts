import { describe, it, expect } from 'vitest';
import { bottlenecks, type BottleneckResult } from '../src/analysis/bottleneck.js';
import { TaskGraph } from '../src/graph/index.js';
import type { TaskInput } from '../src/schema/index.js';

// ---------------------------------------------------------------------------
// Bottlenecks analysis tests
// ---------------------------------------------------------------------------

describe('bottlenecks', () => {
  it('is exported from the analysis module', () => {
    expect(bottlenecks).toBeDefined();
    expect(typeof bottlenecks).toBe('function');
  });

  it('returns array of { taskId, score } objects', () => {
    const tg = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
    ]);
    const result = bottlenecks(tg);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    for (const entry of result) {
      expect(entry).toHaveProperty('taskId');
      expect(entry).toHaveProperty('score');
      expect(typeof entry.taskId).toBe('string');
      expect(typeof entry.score).toBe('number');
    }
  });

  it('sorts results by score descending', () => {
    const tg = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
      { id: 'D', name: 'Task D', dependsOn: ['C'] },
    ]);
    const result = bottlenecks(tg);

    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it('uses normalized scores in 0.0–1.0 range', () => {
    const tg = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
      { id: 'D', name: 'Task D', dependsOn: ['C'] },
    ]);
    const result = bottlenecks(tg);

    for (const entry of result) {
      expect(entry.score).toBeGreaterThanOrEqual(0);
      expect(entry.score).toBeLessThanOrEqual(1);
    }
  });

  it('includes tasks with score 0 (they are not bottlenecks)', () => {
    // Two independent nodes — no paths between them, both get betweenness 0
    const tg = TaskGraph.fromTasks([
      { id: 'X', name: 'Task X', dependsOn: [] },
      { id: 'Y', name: 'Task Y', dependsOn: [] },
    ]);
    const result = bottlenecks(tg);

    expect(result.length).toBe(2);
    expect(result.every((r) => r.score === 0)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Linear chain: A → B → C → D
  // Middle nodes (B, C) should have higher betweenness than endpoints (A, D).
  // B has the highest betweenness because it sits on all shortest paths
  // from A to C, A to D, and B to D.
  // -------------------------------------------------------------------------
  describe('linear chain: A → B → C → D', () => {
    const tg = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
      { id: 'D', name: 'Task D', dependsOn: ['C'] },
    ]);
    const result = bottlenecks(tg);

    it('middle node B has the highest betweenness', () => {
      expect(result[0].taskId).toBe('B');
      expect(result[0].score).toBeGreaterThan(0);
    });

    it('middle node C has the second-highest betweenness', () => {
      expect(result[1].taskId).toBe('C');
      expect(result[1].score).toBeGreaterThan(0);
    });

    it('endpoints A and D have the lowest betweenness', () => {
      // A and D are source/sink respectively — no paths traverse through them
      const aScore = result.find((r) => r.taskId === 'A')!.score;
      const dScore = result.find((r) => r.taskId === 'D')!.score;
      expect(aScore).toBe(0);
      expect(dScore).toBe(0);
    });

    it('all 4 nodes are included in results', () => {
      expect(result.length).toBe(4);
      const ids = result.map((r) => r.taskId).sort();
      expect(ids).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  // -------------------------------------------------------------------------
  // Star graph: center node C connects to all leaf nodes
  //     C
  //    /|\
  //   A B D E
  // The center is on all shortest paths between leaves.
  // -------------------------------------------------------------------------
  describe('star graph: center node connects to all leaves', () => {
    const tg = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: [] },
      { id: 'C', name: 'Center', dependsOn: ['A', 'B'] },
      { id: 'D', name: 'Task D', dependsOn: ['C'] },
      { id: 'E', name: 'Task E', dependsOn: ['C'] },
    ]);
    const result = bottlenecks(tg);

    it('center node C has the highest betweenness', () => {
      expect(result[0].taskId).toBe('C');
      expect(result[0].score).toBeGreaterThan(0);
    });

    it('leaf nodes have lower betweenness than center', () => {
      const centerScore = result[0].score;
      const leaves = result.filter((r) => r.taskId !== 'C');
      for (const leaf of leaves) {
        expect(leaf.score).toBeLessThanOrEqual(centerScore);
      }
    });

    it('center has strictly positive score', () => {
      expect(result[0].score).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Independent nodes: no edges between any nodes
  // All betweenness scores should be 0.
  // -------------------------------------------------------------------------
  describe('independent nodes: no edges', () => {
    it('all nodes have betweenness score 0', () => {
      const tg = TaskGraph.fromTasks([
        { id: 'X', name: 'Task X', dependsOn: [] },
        { id: 'Y', name: 'Task Y', dependsOn: [] },
        { id: 'Z', name: 'Task Z', dependsOn: [] },
      ]);
      const result = bottlenecks(tg);

      expect(result.length).toBe(3);
      for (const entry of result) {
        expect(entry.score).toBe(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Disconnected graph: two separate chains
  // Nodes in disconnected components have betweenness 0 (no shortest paths
  // go through them between different components — but within-component
  // paths still count).
  // -------------------------------------------------------------------------
  describe('disconnected graph: two separate chains', () => {
    const tg = TaskGraph.fromTasks([
      // Chain 1: A → B → C
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
      // Chain 2: D → E → F
      { id: 'D', name: 'Task D', dependsOn: [] },
      { id: 'E', name: 'Task E', dependsOn: ['D'] },
      { id: 'F', name: 'Task F', dependsOn: ['E'] },
    ]);
    const result = bottlenecks(tg);

    it('all 6 nodes are included', () => {
      expect(result.length).toBe(6);
    });

    it('middle nodes in each chain have the highest scores', () => {
      // B and E are the middle nodes in their respective chains
      const bScore = result.find((r) => r.taskId === 'B')!.score;
      const eScore = result.find((r) => r.taskId === 'E')!.score;
      expect(bScore).toBeGreaterThan(0);
      expect(eScore).toBeGreaterThan(0);
    });

    it('endpoint nodes have betweenness 0 in each chain', () => {
      const aScore = result.find((r) => r.taskId === 'A')!.score;
      const cScore = result.find((r) => r.taskId === 'C')!.score;
      const dScore = result.find((r) => r.taskId === 'D')!.score;
      const fScore = result.find((r) => r.taskId === 'F')!.score;
      expect(aScore).toBe(0);
      expect(cScore).toBe(0);
      expect(dScore).toBe(0);
      expect(fScore).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Diamond graph: A → B, A → C, B → D, C → D
  // B and C have higher betweenness than A or D (they sit on paths
  // between the source and sink).
  // -------------------------------------------------------------------------
  describe('diamond graph', () => {
    const tg = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
    ]);
    const result = bottlenecks(tg);

    it('B and C have strictly higher betweenness than A and D', () => {
      const bScore = result.find((r) => r.taskId === 'B')!.score;
      const cScore = result.find((r) => r.taskId === 'C')!.score;
      const aScore = result.find((r) => r.taskId === 'A')!.score;
      const dScore = result.find((r) => r.taskId === 'D')!.score;
      // B and C have equal betweenness in the diamond
      expect(bScore).toBe(cScore);
      // B and C have higher betweenness than A and D
      expect(bScore).toBeGreaterThan(aScore);
      expect(bScore).toBeGreaterThan(dScore);
    });
  });

  // -------------------------------------------------------------------------
  // Empty graph
  // -------------------------------------------------------------------------
  describe('empty graph', () => {
    it('returns an empty array for a graph with no nodes', () => {
      const tg = new TaskGraph();
      const result = bottlenecks(tg);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Single node
  // -------------------------------------------------------------------------
  describe('single node', () => {
    it('returns one entry with score 0', () => {
      const tg = TaskGraph.fromTasks([
        { id: 'solo', name: 'Solo task', dependsOn: [] },
      ]);
      const result = bottlenecks(tg);
      expect(result.length).toBe(1);
      expect(result[0].taskId).toBe('solo');
      expect(result[0].score).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // BottleneckResult interface type check
  // -------------------------------------------------------------------------
  it('returns BottleneckResult-typed objects', () => {
    const tg = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
    ]);
    const result: BottleneckResult[] = bottlenecks(tg);
    expect(result.length).toBeGreaterThan(0);
    // TypeScript compilation validates the type
  });
});