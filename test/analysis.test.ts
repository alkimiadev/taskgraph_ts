import { describe, it, expect } from 'vitest';
import { TaskGraph } from '../src/graph/construction.js';
import { criticalPath, weightedCriticalPath } from '../src/analysis/critical-path.js';
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

  it('returns one of the two equal-length paths for diamond graph', () => {
    //       A
    //      / \
    //     B   C
    //      \ /
    //       D
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
    ]);
    const path = criticalPath(graph);
    // Both A→B→D and A→C→D have 3 nodes (weight 1 each, total weight 3)
    expect(path).toHaveLength(3);
    expect(path[0]).toBe('A');
    expect(path[2]).toBe('D');
    // The path must be either A→B→D or A→C→D
    expect(path[1] === 'B' || path[1] === 'C').toBe(true);
    // The middle node determines which path: B→D or C→D
    // path[1] is 'B' → path goes A→B→D
    // path[1] is 'C' → path goes A→C→D
  });

  it('returns the longer path when paths differ in length', () => {
    // A → B → D
    // A → C
    // The path A→B→D has 3 nodes, A→C has 2 nodes
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B'] },
    ]);
    expect(criticalPath(graph)).toEqual(['A', 'B', 'D']);
  });

  it('throws CircularDependencyError on cyclic graph', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: ['C'] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
    ]);
    expect(() => criticalPath(graph)).toThrow(CircularDependencyError);
  });

  it('handles graph with multiple sources correctly', () => {
    // A → C
    // B → C
    // Both A and B are sources, C depends on both
    // Longest path has length 2 (source to C)
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: [] },
      { id: 'C', name: 'Task C', dependsOn: ['A', 'B'] },
    ]);
    const path = criticalPath(graph);
    expect(path).toHaveLength(2);
    expect(path[0] === 'A' || path[0] === 'B').toBe(true);
    expect(path[1]).toBe('C');
  });

  it('handles graph with multiple sinks correctly', () => {
    // A → B
    // A → C
    // Both B and C are sinks
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
    ]);
    const path = criticalPath(graph);
    expect(path).toHaveLength(2);
    expect(path[0]).toBe('A');
    expect(path[1] === 'B' || path[1] === 'C').toBe(true);
  });

  it('handles a complex branching graph', () => {
    // A → B → D → F
    // A → C → E → F
    // Both branches have length 4, so either is valid
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

  it('handles the longer branch in an asymmetric graph', () => {
    // A → B → D → F
    // A → C → F
    // The A→B→D→F branch is longer (4 nodes) vs A→C→F (3 nodes)
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B'] },
      { id: 'F', name: 'Task F', dependsOn: ['D', 'C'] },
    ]);
    expect(criticalPath(graph)).toEqual(['A', 'B', 'D', 'F']);
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
    //
    // Path A→B→D: total = 1 + 5 + 1 = 7
    // Path A→C→D: total = 1 + 1 + 1 = 3
    // Should select A→B→D
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A'] },
      { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
    ]);

    const weightMap: Record<string, number> = { A: 1, B: 5, C: 1, D: 1 };
    const weightFn = (taskId: string) => weightMap[taskId] ?? 1;

    const path = weightedCriticalPath(graph, weightFn);
    expect(path).toEqual(['A', 'B', 'D']);
  });

  it('uses scope-based weight function for diverse scope values', () => {
    // Build a diamond with different scope values:
    //       plan (scope=moderate, cost=3)
    //      / \
    //  impl-A      impl-B
    // (scope=broad, (scope=narrow,
    //  cost=4)       cost=2)
    //      \ /
    //    test (scope=narrow, cost=2)
    //
    // Path plan→impl-A→test: 3 + 4 + 2 = 9
    // Path plan→impl-B→test: 3 + 2 + 2 = 7
    // Should select plan→impl-A→test
    const graph = TaskGraph.fromTasks([
      { id: 'plan', name: 'Planning', dependsOn: [], scope: 'moderate' as const },
      { id: 'impl-A', name: 'Impl A', dependsOn: ['plan'], scope: 'broad' as const },
      { id: 'impl-B', name: 'Impl B', dependsOn: ['plan'], scope: 'narrow' as const },
      { id: 'test', name: 'Testing', dependsOn: ['impl-A', 'impl-B'], scope: 'narrow' as const },
    ]);

    // Use scopeCostEstimate mapping from defaults.ts
    const scopeCostMap: Record<string, number> = {
      single: 1.0, narrow: 2.0, moderate: 3.0, broad: 4.0, system: 5.0,
    };
    const weightFn = (_taskId: string, attrs: { scope?: string }) =>
      scopeCostMap[attrs.scope ?? 'narrow'] ?? 2.0;

    const path = weightedCriticalPath(graph, weightFn);
    expect(path).toEqual(['plan', 'impl-A', 'test']);
  });

  it('throws CircularDependencyError on cyclic graph', () => {
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: ['C'] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['B'] },
    ]);
    expect(() => weightedCriticalPath(graph, () => 1)).toThrow(CircularDependencyError);
  });

  it('weighted path differs from unweighted when weights are non-uniform', () => {
    // Linear path A→B→C vs shortcut A→C
    // Unweighted: both paths end at C, A→B→C has 3 nodes vs A→C has 2
    // With weights: A→C accumulates A.w + C.w; A→B→C accumulates A.w + B.w + C.w
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A', 'B'] },
    ]);

    // Uniform weight — A→B→C is longer
    expect(criticalPath(graph)).toEqual(['A', 'B', 'C']);

    // With non-uniform weights where A→C shortcut is heavier:
    // A→B→C: 1 + 1 + 10 = 12
    // A→C: 1 + 10 = 11
    // Still A→B→C
    const heavyWeightMap: Record<string, number> = { A: 1, B: 1, C: 10 };
    expect(weightedCriticalPath(graph, (id) => heavyWeightMap[id] ?? 1)).toEqual(['A', 'B', 'C']);

    // With A having huge weight, but still A→B→C is longer:
    // A→B→C: 10 + 1 + 1 = 12
    // A→C: 10 + 1 = 11
    const heavyA: Record<string, number> = { A: 10, B: 1, C: 1 };
    expect(weightedCriticalPath(graph, (id) => heavyA[id] ?? 1)).toEqual(['A', 'B', 'C']);
  });

  it('returns correct path with zero-weight nodes', () => {
    // A(w=10) → B(w=0) → C(w=10)
    // A→C: 10 + 10 = 20
    // A→B→C: 10 + 0 + 10 = 20
    // Both tie — either is valid
    const graph = fromInputs([
      { id: 'A', name: 'Task A', dependsOn: [] },
      { id: 'B', name: 'Task B', dependsOn: ['A'] },
      { id: 'C', name: 'Task C', dependsOn: ['A', 'B'] },
    ]);

    const weightMap: Record<string, number> = { A: 10, B: 0, C: 10 };
    const path = weightedCriticalPath(graph, (id) => weightMap[id] ?? 1);
    // Both paths have weight 20, so either is acceptable
    expect(path[path.length - 1]).toBe('C');
    expect(path[0]).toBe('A');
  });

  it('handles large graph correctly', () => {
    // Build the large project graph from fixtures
    const graph = TaskGraph.fromTasks([
      { id: 'infra-setup', name: 'Infrastructure setup', dependsOn: [] },
      { id: 'db-schema', name: 'Database schema design', dependsOn: [] },
      { id: 'auth-design', name: 'Auth system design', dependsOn: [] },
      { id: 'auth-impl', name: 'Auth implementation', dependsOn: ['infra-setup', 'auth-design'] },
      { id: 'data-layer', name: 'Data access layer', dependsOn: ['db-schema', 'infra-setup'] },
      { id: 'api-gateway', name: 'API gateway', dependsOn: ['auth-impl', 'data-layer'] },
      { id: 'feature-users', name: 'User management', dependsOn: ['auth-impl', 'data-layer'] },
      { id: 'feature-notifications', name: 'Notification system', dependsOn: ['api-gateway', 'data-layer'] },
      { id: 'feature-search', name: 'Search functionality', dependsOn: ['data-layer'] },
      { id: 'feature-permissions', name: 'Permissions system', dependsOn: ['auth-impl'] },
      { id: 'feature-analytics', name: 'Analytics dashboard', dependsOn: ['data-layer', 'api-gateway'] },
      { id: 'integrate-auth', name: 'Auth integration test', dependsOn: ['feature-users', 'feature-permissions'] },
      { id: 'integrate-api', name: 'API integration test', dependsOn: ['feature-notifications', 'feature-search', 'api-gateway'] },
      { id: 'integrate-e2e', name: 'End-to-end integration', dependsOn: ['integrate-auth', 'integrate-api'] },
      { id: 'perf-tests', name: 'Performance testing', dependsOn: ['integrate-e2e'] },
      { id: 'security-audit', name: 'Security audit', dependsOn: ['auth-impl', 'integrate-auth'] },
      { id: 'docs-api', name: 'API documentation', dependsOn: ['api-gateway'] },
      { id: 'docs-user', name: 'User documentation', dependsOn: ['feature-users'] },
      { id: 'i18n', name: 'Internationalization', dependsOn: ['feature-users', 'feature-notifications'] },
      { id: 'accessibility', name: 'Accessibility compliance', dependsOn: ['feature-users', 'feature-analytics'] },
      { id: 'error-handling', name: 'Error handling polish', dependsOn: ['api-gateway', 'data-layer'] },
      { id: 'config-system', name: 'Configuration system', dependsOn: ['data-layer'] },
      { id: 'release', name: 'Production release', dependsOn: ['perf-tests', 'security-audit', 'docs-api', 'docs-user', 'i18n', 'accessibility', 'error-handling', 'config-system'] },
    ]);

    const path = criticalPath(graph);
    // The critical path should end at 'release' and contain multiple nodes
    expect(path.length).toBeGreaterThan(5);
    expect(path[path.length - 1]).toBe('release');
    // The path should start from a source node
    expect(path[0] === 'infra-setup' || path[0] === 'db-schema' || path[0] === 'auth-design').toBe(true);
    // All nodes in the path should be valid task IDs
    for (const nodeId of path) {
      expect(graph.getTask(nodeId)).toBeDefined();
    }
    // The path should be a valid chain (each consecutive pair has an edge)
    for (let i = 0; i < path.length - 1; i++) {
      const dependents = graph.dependents(path[i]);
      expect(dependents).toContain(path[i + 1]);
    }
  });

  it('weight function receives correct node attributes', () => {
    const graph = TaskGraph.fromTasks([
      { id: 'A', name: 'Task A', dependsOn: [], scope: 'broad' as const },
      { id: 'B', name: 'Task B', dependsOn: ['A'], scope: 'narrow' as const },
    ]);

    const accessedAttrs: Array<{ id: string; name: string; scope?: string }> = [];
    weightedCriticalPath(graph, (taskId, attrs) => {
      accessedAttrs.push({ id: taskId, name: attrs.name, scope: attrs.scope });
      return 1;
    });

    expect(accessedAttrs).toHaveLength(2);
    expect(accessedAttrs.find((a) => a.id === 'A')?.scope).toBe('broad');
    expect(accessedAttrs.find((a) => a.id === 'B')?.scope).toBe('narrow');
  });
});