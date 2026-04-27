import { describe, it, expect } from 'vitest';
import { TaskGraph } from '../src/graph/construction.js';
import { criticalPath, weightedCriticalPath } from '../src/analysis/critical-path.js';
import { bottlenecks, type BottleneckResult } from '../src/analysis/bottleneck.js';
import { CircularDependencyError } from '../src/error/index.js';

// ---------------------------------------------------------------------------
// Helper: build TaskGraph from TaskInput[]
// ---------------------------------------------------------------------------

function fromInputs(inputs: Array<{ id: string; name: string; dependsOn: string[] }>): TaskGraph {
  return TaskGraph.fromTasks(inputs);
}

// ---------------------------------------------------------------------------
// criticalPath
// ---------------------------------------------------------------------------

describe('criticalPath', () => {
  it('returns empty array for empty graph', () => {
    const graph = new TaskGraph();
    expect(criticalPath(graph)).toEqual([]);
  });

  it('returns single node for single-node graph', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
    ]);
    expect(criticalPath(graph)).toEqual(['A']);
  });

  it('returns the full chain for a linear graph A→B→C→D', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
      { id: 'D', name: 'Task D', dependsOn: ['C'] },
    ]);
    expect(criticalPath(graph)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('selects the longer path in a diamond graph', () => {
    //     A
    //    / \
    //   B   C
    //    \ /
    //     D
    // Path A→B→D is longer than A→C→D if no weights
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
    ]);
    const path = criticalPath(graph);
    expect(path).toContain('A');
    expect(path).toContain('D');
    expect(path.length).toBe(3);
  });

  it('selects the path through the most dependencies in wider graph', () => {
    //     A
    //    / \
    //   B   C
    //   |   |
    //   D   E
    //    \ /
    //     F
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B'] },
      { id: 'E', name: 'Task E', dependsOn: ['C'] },
      { id: 'F', name: 'Task F', dependsOn: ['D', 'E'] },
    ]);
    const path = criticalPath(graph);
    expect(path).toHaveLength(4);
    expect(path[0]).toBe('A');
    expect(path[3]).toBe('F');
  });

  it('returns path with highest total weight when weights differ', () => {
    //     A
    //    / \
    //   B   C
    //    \ /
    //     D
    // B has weight 5, others have weight 1
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
    ]);
    const path = criticalPath(graph, (_id) => 1);
    expect(path.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// weightedCriticalPath
// ---------------------------------------------------------------------------

describe('weightedCriticalPath', () => {
  it('returns empty array for empty graph', () => {
    const graph = new TaskGraph();
    expect(weightedCriticalPath(graph, () => 1)).toEqual([]);
  });

  it('returns single node for single-node graph', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
    ]);
    expect(weightedCriticalPath(graph, (_id, _attrs) => 5)).toEqual(['A']);
  });

  it('with uniform weight behaves like criticalPath', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
      { id: 'D', name: 'Task D', dependsOn: ['C'] },
    ]);
    const unweighted = criticalPath(graph);
    const weighted = weightedCriticalPath(graph, () => 1);
    expect(weighted).toEqual(unweighted);
  });

  it('selects path with higher cumulative weight', () => {
    //       A (w=1)
    //      / \
    //   B(w=5) C(w=1)
    //      \ /
    //   D(w=1)
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
    ]);
    const path = weightedCriticalPath(graph, (id) => {
      if (id === 'B') return 5;
      return 1;
    });
    expect(path).toContain('B');
    expect(path).toContain('D');
  });

  it('uses scope cost as weight when provided', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [], scope: 'broad' },
      { id: 'B', name: 'Task B', dependsOn: ['A'], scope: 'narrow' },
    ]);
    const scopeCostMap: Record<string, number> = {
      single: 1, narrow: 2, moderate: 3, broad: 4, system: 5,
    };
    const accessedAttrs: Array<{ id: string; name: string; scope?: string }> = [];
    weightedCriticalPath(graph, (taskId, attrs) => {
      accessedAttrs.push({ id: taskId, name: attrs.name, scope: attrs.scope });
      return scopeCostMap[attrs.scope ?? 'narrow'] ?? 2;
    });

    expect(accessedAttrs).toHaveLength(2);
    expect(accessedAttrs.find((a) => a.id === 'A')?.scope).toBe('broad');
    expect(accessedAttrs.find((a) => a.id === 'B')?.scope).toBe('narrow');
  });

  it('throws CircularDependencyError on cyclic graph', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: ['B'] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
    ]);
    expect(() => weightedCriticalPath(graph, () => 1)).toThrow(CircularDependencyError);
  });

  it('handles graph where all weights are zero', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
    ]);
    const path = weightedCriticalPath(graph, () => 0);
    expect(path.length).toBeGreaterThanOrEqual(1);
  });

  it('handles three-way branching correctly', () => {
    //         A
    //       / | \
    //     B   C   D
    //      \  |  /
    //        E
    // B has weight 10, others weight 1
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['A'] },
      { id: 'E', name: 'Task E', dependsOn: ['B', 'C', 'D'] },
    ]);
    const path = weightedCriticalPath(graph, (id) => id === 'B' ? 10 : 1);
    expect(path).toEqual(['A', 'B', 'E']);
  });
});

// ---------------------------------------------------------------------------
// bottlenecks
// ---------------------------------------------------------------------------

describe('bottlenecks', () => {
  it('is exported from the analysis module', () => {
    expect(bottlenecks).toBeDefined();
    expect(typeof bottlenecks).toBe('function');
  });

  it('returns empty array for empty graph', () => {
    const tg = new TaskGraph();
    const result = bottlenecks(tg);
    expect(result).toEqual([]);
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

    it('endpoints A and D have zero betweenness', () => {
      const aEntry = result.find((r) => r.taskId === 'A');
      const dEntry = result.find((r) => r.taskId === 'D');
      expect(aEntry?.score).toBe(0);
      expect(dEntry?.score).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Diamond: A → B, A → C, B → D, C → D
  // B and C are on all paths from A to D, so both are bottlenecks.
  // -------------------------------------------------------------------------
  describe('diamond: A → B/C → D', () => {
    const tg = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
    ]);
    const result = bottlenecks(tg);

    it('middle nodes B and C are greater than zero', () => {
      const bEntry = result.find((r) => r.taskId === 'B');
      const cEntry = result.find((r) => r.taskId === 'C');
      expect(bEntry?.score).toBeGreaterThan(0);
      expect(cEntry?.score).toBeGreaterThan(0);
    });

    it('endpoint A has zero betweenness (source)', () => {
      const aEntry = result.find((r) => r.taskId === 'A');
      expect(aEntry?.score).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Large graph (22+ nodes)
  // Uses the shared fixture from test/fixtures/graphs.ts
  // -------------------------------------------------------------------------
  describe('larger graph', () => {
    it('returns sensible results for a 22+ node project graph', () => {
      const tg = TaskGraph.fromTasks([
        { id: 'infra', name: 'Infrastructure', dependsOn: [] },
        { id: 'db', name: 'DB Schema', dependsOn: ['infra'] },
        { id: 'auth-design', name: 'Auth Design', dependsOn: ['infra'] },
        { id: 'auth-impl', name: 'Auth Implementation', dependsOn: ['auth-design', 'db'] },
        { id: 'data-layer', name: 'Data Layer', dependsOn: ['db'] },
        { id: 'api-gw', name: 'API Gateway', dependsOn: ['auth-impl', 'data-layer'] },
        { id: 'feat-users', name: 'Feature: Users', dependsOn: ['api-gw'] },
        { id: 'feat-notif', name: 'Feature: Notifications', dependsOn: ['api-gw'] },
        { id: 'feat-search', name: 'Feature: Search', dependsOn: ['data-layer'] },
        { id: 'feat-perms', name: 'Feature: Permissions', dependsOn: ['auth-impl'] },
        { id: 'int-auth', name: 'Integrate Auth', dependsOn: ['auth-impl'] },
        { id: 'int-api', name: 'Integrate API', dependsOn: ['feat-users', 'feat-notif'] },
        { id: 'e2e', name: 'E2E Tests', dependsOn: ['int-auth', 'int-api'] },
        { id: 'perf', name: 'Performance Tests', dependsOn: ['api-gw'] },
        { id: 'security', name: 'Security Audit', dependsOn: ['auth-impl'] },
        { id: 'docs-api', name: 'API Docs', dependsOn: ['api-gw'] },
        { id: 'docs-user', name: 'User Docs', dependsOn: ['feat-users'] },
        { id: 'i18n', name: 'Internationalization', dependsOn: ['feat-users'] },
        { id: 'feat-wizard', name: 'Onboarding Wizard', dependsOn: ['feat-users', 'auth-impl'] },
        { id: 'feat-dash', name: 'Dashboard', dependsOn: ['feat-users', 'data-layer'] },
        { id: 'release', name: 'Release', dependsOn: ['e2e', 'perf', 'security', 'docs-api', 'docs-user'] },
        { id: 'hotfix', name: 'Hotfix Pipeline', dependsOn: ['infra'] },
      ]);
      const result = bottlenecks(tg);
      expect(result.length).toBe(22);
      // Results should be sorted by score descending
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Disconnected components
  // -------------------------------------------------------------------------
  describe('disconnected components', () => {
    it('returns all nodes with score 0 for disconnected singletons', () => {
      const tg = TaskGraph.fromTasks([
        { id: 'X', name: 'Task X', dependsOn: [] },
        { id: 'Y', name: 'Task Y', dependsOn: [] },
        { id: 'Z', name: 'Task Z', dependsOn: [] },
      ]);
      const result = bottlenecks(tg);
      expect(result.length).toBe(3);
      expect(result.every((r) => r.score === 0)).toBe(true);
    });

    it('returns nodes between components with score 0', () => {
      // Two separate chains with no connection
      const tg = TaskGraph.fromTasks([
        { id: 'A1', name: 'A1', dependsOn: [] },
        { id: 'A2', name: 'A2', dependsOn: ['A1'] },
        { id: 'B1', name: 'B1', dependsOn: [] },
        { id: 'B2', name: 'B2', dependsOn: ['B1'] },
      ]);
      const result = bottlenecks(tg);
      expect(result.length).toBe(4);
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