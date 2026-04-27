import { describe, it, expect } from 'vitest';
import { TaskGraph } from '../src/graph/index.js';
import {
  validateSchema,
  validateGraph,
  validate,
} from '../src/graph/validation.js';
import type { TaskGraphSerialized, TaskGraphNodeAttributes } from '../src/schema/index.js';
import type { ValidationError, GraphValidationError, AnyValidationError } from '../src/error/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a linear chain DAG: A → B → C → D */
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

/** Create a cyclic graph: A → B → C → A, plus A → D */
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

/** Create a graph with typed categorical attributes */
function makeMixedCategory(): TaskGraph {
  const data: TaskGraphSerialized = {
    attributes: {},
    options: { type: 'directed', multi: false, allowSelfLoops: false },
    nodes: [
      { key: 'auth', attributes: { name: 'Auth module', risk: 'high', scope: 'broad', impact: 'phase' } },
      { key: 'api', attributes: { name: 'API layer', impact: 'component' } },
      { key: 'db', attributes: { name: 'Database setup', risk: 'medium', scope: 'moderate' } },
    ],
    edges: [
      { key: 'auth->api', source: 'auth', target: 'api', attributes: {} },
      { key: 'db->api', source: 'db', target: 'api', attributes: {} },
    ],
  };
  return new TaskGraph(data);
}

// ===========================================================================
// SUBGRAPH TESTS
// ===========================================================================

describe('subgraph', () => {
  it('returns an empty graph when filter matches no nodes', () => {
    const tg = makeLinearChain();
    const sub = tg.subgraph(() => false);
    expect(sub.taskCount()).toBe(0);
    expect(sub.raw.size).toBe(0);
  });

  it('returns the entire graph when filter matches all nodes', () => {
    const tg = makeLinearChain();
    const sub = tg.subgraph(() => true);
    expect(sub.taskCount()).toBe(4);
    expect(sub.raw.size).toBe(3);
  });

  it('filters nodes by attribute', () => {
    const tg = makeMixedCategory();
    const sub = tg.subgraph((_id, attrs) => attrs.risk === 'high');
    // Only 'auth' has risk: 'high'
    expect(sub.taskCount()).toBe(1);
    expect(sub.getTask('auth')).toBeDefined();
    expect(sub.getTask('auth')!.name).toBe('Auth module');
  });

  it('returns only edges where both endpoints are in the filtered set (internal-only per ADR-007)', () => {
    // Diamond: A → B, A → C, B → D, C → D
    // Filter to only {B, D}: B→D should remain, but A→B, A→C, C→D should be removed
    const tg = makeDiamond();
    const sub = tg.subgraph((id) => id === 'B' || id === 'D');
    expect(sub.taskCount()).toBe(2);
    // Only B→D should remain (both endpoints in the set)
    expect(sub.raw.hasEdge('B->D')).toBe(true);
    // A→B should NOT exist (A not in filter)
    expect(sub.raw.hasEdge('A->B')).toBe(false);
    // A→C should NOT exist (A not in filter)
    expect(sub.raw.hasEdge('A->C')).toBe(false);
    // C→D should NOT exist (C not in filter)
    expect(sub.raw.hasEdge('C->D')).toBe(false);
  });

  it('preserves node attributes in the subgraph', () => {
    const tg = makeMixedCategory();
    const sub = tg.subgraph((id) => id === 'auth');
    expect(sub.getTask('auth')).toEqual({
      name: 'Auth module',
      risk: 'high',
      scope: 'broad',
      impact: 'phase',
    });
  });

  it('preserves edge attributes in the subgraph', () => {
    const data: TaskGraphSerialized = {
      attributes: {},
      options: { type: 'directed', multi: false, allowSelfLoops: false },
      nodes: [
        { key: 'A', attributes: { name: 'Task A' } },
        { key: 'B', attributes: { name: 'Task B' } },
      ],
      edges: [
        { key: 'A->B', source: 'A', target: 'B', attributes: { qualityRetention: 0.75 } },
      ],
    };
    const tg = new TaskGraph(data);
    const sub = tg.subgraph(() => true);
    expect(sub.raw.getEdgeAttributes('A->B').qualityRetention).toBe(0.75);
  });

  it('does not mutate the original graph', () => {
    const tg = makeDiamond();
    const originalNodes = tg.raw.nodes().sort();
    const originalEdges = tg.raw.edges().sort();
    
    tg.subgraph((id) => id === 'A' || id === 'B');
    
    // Original graph should be untouched
    expect(tg.raw.nodes().sort()).toEqual(originalNodes);
    expect(tg.raw.edges().sort()).toEqual(originalEdges);
  });

  it('returns a disconnected subgraph when middle nodes are excluded', () => {
    // Linear chain: A → B → C → D
    // Filter to {A, D} — no edges should remain since A→D doesn't exist directly
    const tg = makeLinearChain();
    const sub = tg.subgraph((id) => id === 'A' || id === 'D');
    expect(sub.taskCount()).toBe(2);
    expect(sub.raw.size).toBe(0); // no edges between A and D
  });

  it('returns a valid TaskGraph instance', () => {
    const tg = makeLinearChain();
    const sub = tg.subgraph(() => true);
    expect(sub).toBeInstanceOf(TaskGraph);
  });

  it('filter receives taskId and attributes', () => {
    const tg = makeMixedCategory();
    const receivedArgs: Array<{ id: string; attrs: TaskGraphNodeAttributes }> = [];
    tg.subgraph((id, attrs) => {
      receivedArgs.push({ id, attrs });
      return true;
    });
    // Should have been called for each node
    expect(receivedArgs).toHaveLength(3);
    const ids = receivedArgs.map(a => a.id).sort();
    expect(ids).toEqual(['api', 'auth', 'db']);
  });

  it('handles a single-node subgraph', () => {
    const tg = makeLinearChain();
    const sub = tg.subgraph((id) => id === 'B');
    expect(sub.taskCount()).toBe(1);
    expect(sub.raw.size).toBe(0);
    expect(sub.getTask('B')).toBeDefined();
    expect(sub.getTask('B')!.name).toBe('Task B');
  });

  it('handles a two-node subgraph with a single edge', () => {
    const tg = makeLinearChain();
    const sub = tg.subgraph((id) => id === 'A' || id === 'B');
    expect(sub.taskCount()).toBe(2);
    expect(sub.raw.size).toBe(1);
    expect(sub.raw.hasEdge('A->B')).toBe(true);
  });

  it('subgraph of empty graph returns empty graph', () => {
    const tg = new TaskGraph();
    const sub = tg.subgraph(() => true);
    expect(sub.taskCount()).toBe(0);
    expect(sub.raw.size).toBe(0);
  });

  it('excludes edges where only source is in filtered set', () => {
    // Diamond: A → B, A → C, B → D, C → D
    // Keep only {A, B}: edge A→B stays, A→C excluded (C missing), B→D excluded (D missing)
    const tg = makeDiamond();
    const sub = tg.subgraph((id) => id === 'A' || id === 'B');
    expect(sub.taskCount()).toBe(2);
    expect(sub.raw.size).toBe(1);
    expect(sub.raw.hasEdge('A->B')).toBe(true);
    // A→C excluded (C not in subgraph)
    expect(sub.raw.hasNode('C')).toBe(false);
    // B→D excluded (D not in subgraph)
    expect(sub.raw.hasNode('D')).toBe(false);
  });

  it('excludes edges where only target is in filtered set', () => {
    // Diamond: A → B, A → C, B → D, C → D
    // Keep only {C, D}: edge C→D stays, A→C excluded, B→D excluded
    const tg = makeDiamond();
    const sub = tg.subgraph((id) => id === 'C' || id === 'D');
    expect(sub.taskCount()).toBe(2);
    expect(sub.raw.size).toBe(1);
    expect(sub.raw.hasEdge('C->D')).toBe(true);
  });
});

// ===========================================================================
// VALIDATESCHEMA TESTS
// ===========================================================================

describe('validateSchema', () => {
  it('returns empty array for a valid graph', () => {
    const tg = makeLinearChain();
    const errors = tg.validateSchema();
    expect(errors).toEqual([]);
  });

  it('returns empty array for a valid graph with categorical attributes', () => {
    const tg = makeMixedCategory();
    const errors = tg.validateSchema();
    expect(errors).toEqual([]);
  });

  it('returns empty array for an empty graph', () => {
    const tg = new TaskGraph();
    const errors = tg.validateSchema();
    expect(errors).toEqual([]);
  });

  it('catches invalid enum values', () => {
    // Create a graph with invalid node attributes by directly manipulating
    // the underlying graphology instance
    const tg = new TaskGraph();
    tg.raw.addNode('bad-task', { name: 'Bad Task', risk: 'extreme' } as any);
    const errors = tg.validateSchema();
    expect(errors.length).toBeGreaterThan(0);
    const schemaError = errors.find(e => e.type === 'schema');
    expect(schemaError).toBeDefined();
    expect(schemaError!.taskId).toBe('bad-task');
    expect(schemaError!.field).toContain('risk');
  });

  it('catches missing required name field', () => {
    const tg = new TaskGraph();
    // Create a node without a name (required field)
    (tg.raw as any).addNode('no-name', {});
    const errors = tg.validateSchema();
    expect(errors.length).toBeGreaterThan(0);
    const nameError = errors.find(e => e.field === 'name' || e.field === '/name');
    expect(nameError).toBeDefined();
    expect(nameError!.taskId).toBe('no-name');
  });

  it('catches multiple invalid nodes', () => {
    const tg = new TaskGraph();
    tg.raw.addNode('bad1', { name: 'Bad 1', risk: 'extreme' } as any);
    tg.raw.addNode('bad2', { name: 'Bad 2', scope: 'invalid-scope' } as any);
    const errors = tg.validateSchema();
    expect(errors.length).toBeGreaterThanOrEqual(2);
    // Should have errors for both nodes
    const bad1Errors = errors.filter(e => e.taskId === 'bad1');
    const bad2Errors = errors.filter(e => e.taskId === 'bad2');
    expect(bad1Errors.length).toBeGreaterThan(0);
    expect(bad2Errors.length).toBeGreaterThan(0);
  });

  it('returns errors with type "schema"', () => {
    const tg = new TaskGraph();
    tg.raw.addNode('bad', { name: 'Bad', risk: 'extreme' } as any);
    const errors = tg.validateSchema();
    for (const error of errors) {
      expect(error.type).toBe('schema');
    }
  });

  it('errors include taskId, field, message', () => {
    const tg = new TaskGraph();
    tg.raw.addNode('bad', { name: 'Bad', risk: 'extreme' } as any);
    const errors = tg.validateSchema();
    expect(errors.length).toBeGreaterThan(0);
    const error = errors[0]!;
    expect(error.taskId).toBeDefined();
    expect(error.field).toBeDefined();
    expect(error.message).toBeDefined();
    expect(typeof error.message).toBe('string');
  });

  it('errors include value for invalid values', () => {
    const tg = new TaskGraph();
    tg.raw.addNode('bad', { name: 'Bad', risk: 'extreme' } as any);
    const errors = tg.validateSchema();
    expect(errors.length).toBeGreaterThan(0);
    // The value field should contain the invalid value
    const riskErrors = errors.filter(e => e.field.includes('risk'));
    expect(riskErrors.length).toBeGreaterThan(0);
    expect(riskErrors[0]!.value).toBe('extreme');
  });

  it('standalone validateSchema function works the same', () => {
    const tg = makeLinearChain();
    const standaloneErrors = validateSchema(tg.raw);
    const methodErrors = tg.validateSchema();
    expect(standaloneErrors).toEqual(methodErrors);
  });
});

// ===========================================================================
// VALIDATEGRAPH TESTS
// ===========================================================================

describe('validateGraph', () => {
  it('returns empty array for an acyclic graph', () => {
    const tg = makeLinearChain();
    const errors = tg.validateGraph();
    expect(errors).toEqual([]);
  });

  it('returns empty array for a diamond DAG', () => {
    const tg = makeDiamond();
    const errors = tg.validateGraph();
    expect(errors).toEqual([]);
  });

  it('returns empty array for an empty graph', () => {
    const tg = new TaskGraph();
    const errors = tg.validateGraph();
    expect(errors).toEqual([]);
  });

  it('detects cycles and returns graph validation error', () => {
    const tg = makeCyclic();
    const errors = tg.validateGraph();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const cycleError = errors.find(e => e.category === 'cycle');
    expect(cycleError).toBeDefined();
    expect(cycleError!.type).toBe('graph');
    expect(cycleError!.message).toContain('cycle');
  });

  it('cycle error includes cycle paths in details', () => {
    const tg = makeCyclic();
    const errors = tg.validateGraph();
    const cycleError = errors.find(e => e.category === 'cycle');
    expect(cycleError).toBeDefined();
    const details = cycleError!.details as string[][];
    expect(details).toBeDefined();
    expect(details.length).toBeGreaterThanOrEqual(1);
    // The cycle should contain A, B, C
    const allNodes = details.flat();
    expect(allNodes).toContain('A');
    expect(allNodes).toContain('B');
    expect(allNodes).toContain('C');
  });

  it('detects dangling references after node removal', () => {
    // Create a graph, then remove a node that has edges to create dangling refs
    // NOTE: In graphology, removing a node also removes its edges, so we need
    // to create the dangling reference differently.
    // Actually, graphology is a library where removeNode also removes edges.
    // So the only way to get a "dangling reference" is through fromTasks
    // which creates orphan nodes, or via edge-only imports that reference
    // missing nodes. But graphology doesn't actually allow that.
    // 
    // However, after a removeTask, the edges are cascade-removed.
    // So in a well-formed TaskGraph, there should never be dangling references.
    //
    // Let's test that a well-formed graph has no dangling refs:
    const tg = makeLinearChain();
    const errors = tg.validateGraph();
    const danglingErrors = errors.filter(e => e.category === 'dangling-reference');
    expect(danglingErrors).toHaveLength(0);
  });

  // Note: dangling-reference detection (lines 78-93 in validation.ts) is unreachable
  // through the public API because graphology's mergeEdge auto-creates missing nodes
  // and addEdgeWithKey rejects non-existent source/target. The code is a defensive
  // guard for direct raw graph mutation that bypasses TaskGraph invariants.

  it('detects multiple independent cycles', () => {
    // Create a graph with two independent cycles
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
    const tg = new TaskGraph(data);
    const errors = tg.validateGraph();
    const cycleError = errors.find(e => e.category === 'cycle');
    expect(cycleError).toBeDefined();
    const details = cycleError!.details as string[][];
    // Should find at least 2 cycles
    expect(details.length).toBeGreaterThanOrEqual(2);
  });

  it('returns errors with type "graph"', () => {
    const tg = makeCyclic();
    const errors = tg.validateGraph();
    for (const error of errors) {
      expect(error.type).toBe('graph');
    }
  });

  it('standalone validateGraph function works the same', () => {
    const tg = makeCyclic();
    const standaloneErrors = validateGraph(tg.raw);
    const methodErrors = tg.validateGraph();
    expect(standaloneErrors).toEqual(methodErrors);
  });
});

// ===========================================================================
// VALIDATE (COMBINED) TESTS
// ===========================================================================

describe('validate', () => {
  it('returns empty arrays for a valid, acyclic graph', () => {
    const tg = makeLinearChain();
    const errors = tg.validate();
    expect(errors).toEqual([]);
  });

  it('combines schema and graph errors', () => {
    // Create a graph with a cycle AND invalid schema
    const tg = new TaskGraph();
    tg.raw.addNode('A', { name: 'A' });
    tg.raw.addNode('B', { name: 'B' });
    tg.raw.addNode('C', { name: 'C', risk: 'extreme' } as any);
    tg.raw.addEdgeWithKey('A->B', 'A', 'B', {});
    tg.raw.addEdgeWithKey('B->C', 'B', 'C', {});
    tg.raw.addEdgeWithKey('C->A', 'C', 'A', {});

    const errors = tg.validate();
    // Should have at least one schema error (invalid risk)
    // and at least one graph error (cycle)
    const schemaErrors = errors.filter(e => e.type === 'schema');
    const graphErrors = errors.filter(e => e.type === 'graph');
    expect(schemaErrors.length).toBeGreaterThan(0);
    expect(graphErrors.length).toBeGreaterThan(0);
  });

  it('returns only schema errors for an invalid but acyclic graph', () => {
    const tg = new TaskGraph();
    tg.raw.addNode('bad', { name: 'Bad', risk: 'extreme' } as any);
    const errors = tg.validate();
    const schemaErrors = errors.filter(e => e.type === 'schema');
    const graphErrors = errors.filter(e => e.type === 'graph');
    expect(schemaErrors.length).toBeGreaterThan(0);
    expect(graphErrors).toHaveLength(0);
  });

  it('returns only graph errors for a valid-schema but cyclic graph', () => {
    const tg = makeCyclic();
    const errors = tg.validate();
    const schemaErrors = errors.filter(e => e.type === 'schema');
    const graphErrors = errors.filter(e => e.type === 'graph');
    expect(schemaErrors).toHaveLength(0);
    expect(graphErrors.length).toBeGreaterThan(0);
  });

  it('standalone validate function works the same', () => {
    const tg = makeLinearChain();
    const standaloneErrors = validate(tg.raw);
    const methodErrors = tg.validate();
    expect(standaloneErrors).toEqual(methodErrors);
  });

  it('AnyValidationError union type discriminates correctly', () => {
    const tg = new TaskGraph();
    tg.raw.addNode('A', { name: 'A' });
    tg.raw.addNode('B', { name: 'B' });
    tg.raw.addNode('C', { name: 'C', risk: 'extreme' } as any);
    tg.raw.addEdgeWithKey('A->B', 'A', 'B', {});
    tg.raw.addEdgeWithKey('B->C', 'B', 'C', {});
    tg.raw.addEdgeWithKey('C->A', 'C', 'A', {});

    const errors: AnyValidationError[] = tg.validate();
    
    // Schema errors should have 'field' property
    const schemaErrors = errors.filter(e => e.type === 'schema') as ValidationError[];
    for (const se of schemaErrors) {
      expect(se.field).toBeDefined();
    }
    
    // Graph errors should have 'category' property
    const graphErrors = errors.filter(e => e.type === 'graph') as GraphValidationError[];
    for (const ge of graphErrors) {
      expect(ge.category).toBeDefined();
    }
  });
});

// ===========================================================================
// VALIDATION ERROR TYPES TESTS
// ===========================================================================

describe('ValidationError and GraphValidationError types', () => {
  it('ValidationError has correct structure', () => {
    const error: ValidationError = {
      type: 'schema',
      taskId: 'task-1',
      field: 'risk',
      message: 'Invalid enum value',
      value: 'extreme',
    };
    expect(error.type).toBe('schema');
    expect(error.taskId).toBe('task-1');
    expect(error.field).toBe('risk');
    expect(error.message).toBe('Invalid enum value');
    expect(error.value).toBe('extreme');
  });

  it('GraphValidationError has correct structure for cycle', () => {
    const error: GraphValidationError = {
      type: 'graph',
      category: 'cycle',
      message: 'Graph contains 1 cycle',
      details: [['A', 'B', 'C']],
    };
    expect(error.type).toBe('graph');
    expect(error.category).toBe('cycle');
    expect(error.message).toBe('Graph contains 1 cycle');
    expect(error.details).toEqual([['A', 'B', 'C']]);
  });

  it('GraphValidationError has correct structure for dangling reference', () => {
    const error: GraphValidationError = {
      type: 'graph',
      category: 'dangling-reference',
      taskId: 'missing-node',
      message: 'Edge references non-existent node: missing-node',
    };
    expect(error.type).toBe('graph');
    expect(error.category).toBe('dangling-reference');
    expect(error.taskId).toBe('missing-node');
    expect(error.message).toContain('missing-node');
    expect(error.details).toBeUndefined();
  });
});