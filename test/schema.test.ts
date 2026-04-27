import { describe, it, expect } from 'vitest';
import { Value } from '@alkdev/typebox/value';
import {
  TaskScopeEnum,
  TaskRiskEnum,
  TaskImpactEnum,
  TaskLevelEnum,
  TaskPriorityEnum,
  TaskStatusEnum,
  Nullable,
} from '../src/schema/enums.js';
import {
  TaskGraphNodeAttributes,
  TaskGraphNodeAttributesUpdate,
  TaskGraphEdgeAttributes,
  TaskGraphSerialized,
  SerializedGraph,
} from '../src/schema/graph.js';

describe('Enum schemas', () => {
  // --- TaskScopeEnum ---
  describe('TaskScopeEnum', () => {
    const validValues = ['single', 'narrow', 'moderate', 'broad', 'system'] as const;

    it('accepts each valid literal', () => {
      for (const value of validValues) {
        expect(Value.Check(TaskScopeEnum, value)).toBe(true);
      }
    });

    it('rejects invalid values', () => {
      expect(Value.Check(TaskScopeEnum, 'unknown')).toBe(false);
      expect(Value.Check(TaskScopeEnum, '')).toBe(false);
      expect(Value.Check(TaskScopeEnum, 42)).toBe(false);
      expect(Value.Check(TaskScopeEnum, null)).toBe(false);
    });
  });

  // --- TaskRiskEnum ---
  describe('TaskRiskEnum', () => {
    const validValues = ['trivial', 'low', 'medium', 'high', 'critical'] as const;

    it('accepts each valid literal', () => {
      for (const value of validValues) {
        expect(Value.Check(TaskRiskEnum, value)).toBe(true);
      }
    });

    it('rejects invalid values', () => {
      expect(Value.Check(TaskRiskEnum, 'unknown')).toBe(false);
      expect(Value.Check(TaskRiskEnum, '')).toBe(false);
      expect(Value.Check(TaskRiskEnum, 42)).toBe(false);
      expect(Value.Check(TaskRiskEnum, null)).toBe(false);
    });
  });

  // --- TaskImpactEnum ---
  describe('TaskImpactEnum', () => {
    const validValues = ['isolated', 'component', 'phase', 'project'] as const;

    it('accepts each valid literal', () => {
      for (const value of validValues) {
        expect(Value.Check(TaskImpactEnum, value)).toBe(true);
      }
    });

    it('rejects invalid values', () => {
      expect(Value.Check(TaskImpactEnum, 'unknown')).toBe(false);
      expect(Value.Check(TaskImpactEnum, '')).toBe(false);
      expect(Value.Check(TaskImpactEnum, 42)).toBe(false);
      expect(Value.Check(TaskImpactEnum, null)).toBe(false);
    });
  });

  // --- TaskLevelEnum ---
  describe('TaskLevelEnum', () => {
    const validValues = ['planning', 'decomposition', 'implementation', 'review', 'research'] as const;

    it('accepts each valid literal', () => {
      for (const value of validValues) {
        expect(Value.Check(TaskLevelEnum, value)).toBe(true);
      }
    });

    it('rejects invalid values', () => {
      expect(Value.Check(TaskLevelEnum, 'unknown')).toBe(false);
      expect(Value.Check(TaskLevelEnum, '')).toBe(false);
      expect(Value.Check(TaskLevelEnum, 42)).toBe(false);
      expect(Value.Check(TaskLevelEnum, null)).toBe(false);
    });
  });

  // --- TaskPriorityEnum ---
  describe('TaskPriorityEnum', () => {
    const validValues = ['low', 'medium', 'high', 'critical'] as const;

    it('accepts each valid literal', () => {
      for (const value of validValues) {
        expect(Value.Check(TaskPriorityEnum, value)).toBe(true);
      }
    });

    it('rejects invalid values', () => {
      expect(Value.Check(TaskPriorityEnum, 'unknown')).toBe(false);
      expect(Value.Check(TaskPriorityEnum, '')).toBe(false);
      expect(Value.Check(TaskPriorityEnum, 42)).toBe(false);
      expect(Value.Check(TaskPriorityEnum, null)).toBe(false);
    });
  });

  // --- TaskStatusEnum ---
  describe('TaskStatusEnum', () => {
    const validValues = ['pending', 'in-progress', 'completed', 'failed', 'blocked'] as const;

    it('accepts each valid literal', () => {
      for (const value of validValues) {
        expect(Value.Check(TaskStatusEnum, value)).toBe(true);
      }
    });

    it('rejects invalid values', () => {
      expect(Value.Check(TaskStatusEnum, 'unknown')).toBe(false);
      expect(Value.Check(TaskStatusEnum, '')).toBe(false);
      expect(Value.Check(TaskStatusEnum, 42)).toBe(false);
      expect(Value.Check(TaskStatusEnum, null)).toBe(false);
    });
  });
});

describe('Nullable helper', () => {
  it('accepts valid enum values', () => {
    const NullableScope = Nullable(TaskScopeEnum);
    expect(Value.Check(NullableScope, 'single')).toBe(true);
    expect(Value.Check(NullableScope, 'system')).toBe(true);
  });

  it('accepts null', () => {
    const NullableScope = Nullable(TaskScopeEnum);
    expect(Value.Check(NullableScope, null)).toBe(true);
  });

  it('rejects undefined and invalid strings', () => {
    const NullableScope = Nullable(TaskScopeEnum);
    expect(Value.Check(NullableScope, 'invalid')).toBe(false);
    expect(Value.Check(NullableScope, undefined)).toBe(false);
    expect(Value.Check(NullableScope, 42)).toBe(false);
  });
});

describe('Type alias correctness (compile-time)', () => {
  // These tests verify that the type aliases resolve to the expected union types.
  // We use type assertions to confirm the types are what we expect.
  // If the types are wrong, TypeScript would fail to compile this file.

  it('TaskScope type accepts valid values', () => {
    const scope: TaskScope = 'single';
    expect(scope).toBe('single');
  });

  it('TaskRisk type accepts valid values', () => {
    const risk: TaskRisk = 'critical';
    expect(risk).toBe('critical');
  });

  it('TaskImpact type accepts valid values', () => {
    const impact: TaskImpact = 'project';
    expect(impact).toBe('project');
  });

  it('TaskLevel type accepts valid values', () => {
    const level: TaskLevel = 'implementation';
    expect(level).toBe('implementation');
  });

  it('TaskPriority type accepts valid values', () => {
    const priority: TaskPriority = 'high';
    expect(priority).toBe('high');
  });

  it('TaskStatus type accepts valid values', () => {
    const status: TaskStatus = 'in-progress';
    expect(status).toBe('in-progress');
  });
});

// Intentionally import type aliases to verify they exist at compile time
type TaskScope = import('../src/schema/enums.js').TaskScope;
type TaskRisk = import('../src/schema/enums.js').TaskRisk;
type TaskImpact = import('../src/schema/enums.js').TaskImpact;
type TaskLevel = import('../src/schema/enums.js').TaskLevel;
type TaskPriority = import('../src/schema/enums.js').TaskPriority;
type TaskStatus = import('../src/schema/enums.js').TaskStatus;

// ---------------------------------------------------------------------------
// Graph schema tests
// ---------------------------------------------------------------------------

describe('TaskGraphNodeAttributes', () => {
  it('accepts a valid node with only required fields', () => {
    const node = { name: 'my-task' };
    expect(Value.Check(TaskGraphNodeAttributes, node)).toBe(true);
  });

  it('accepts a node with all optional categorical enum fields', () => {
    const node = {
      name: 'my-task',
      scope: 'narrow',
      risk: 'high',
      impact: 'component',
      level: 'implementation',
      priority: 'critical',
      status: 'in-progress',
    };
    expect(Value.Check(TaskGraphNodeAttributes, node)).toBe(true);
  });

  it('rejects a node missing the required name field', () => {
    const node = { scope: 'narrow' };
    expect(Value.Check(TaskGraphNodeAttributes, node)).toBe(false);
  });

  it('rejects invalid categorical enum values', () => {
    expect(Value.Check(TaskGraphNodeAttributes, { name: 't', scope: 'invalid' })).toBe(false);
    expect(Value.Check(TaskGraphNodeAttributes, { name: 't', risk: 'unknown' })).toBe(false);
    expect(Value.Check(TaskGraphNodeAttributes, { name: 't', status: 'done' })).toBe(false);
  });

  it('rejects non-object values', () => {
    expect(Value.Check(TaskGraphNodeAttributes, null)).toBe(false);
    expect(Value.Check(TaskGraphNodeAttributes, 'string')).toBe(false);
    expect(Value.Check(TaskGraphNodeAttributes, 42)).toBe(false);
  });

  it('does NOT carry tags/assignee/due fields (analysis-only)', () => {
    // Extra properties are ignored by Value.Check (JSON Schema allows them by default)
    // but the schema itself should not define those fields
    const schema = TaskGraphNodeAttributes as any;
    const props = schema?.properties;
    expect(props).toBeDefined();
    expect(props.tags).toBeUndefined();
    expect(props.assignee).toBeUndefined();
    expect(props.due).toBeUndefined();
  });
});

describe('TaskGraphNodeAttributesUpdate', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(Value.Check(TaskGraphNodeAttributesUpdate, {})).toBe(true);
  });

  it('accepts a partial object with only name', () => {
    expect(Value.Check(TaskGraphNodeAttributesUpdate, { name: 't' })).toBe(true);
  });

  it('accepts a partial object with only optional categorical fields', () => {
    expect(Value.Check(TaskGraphNodeAttributesUpdate, { risk: 'low', status: 'pending' })).toBe(true);
  });

  it('rejects invalid categorical enum values in partial', () => {
    expect(Value.Check(TaskGraphNodeAttributesUpdate, { risk: 'invalid' })).toBe(false);
  });
});

describe('TaskGraphEdgeAttributes', () => {
  it('accepts an empty object (qualityRetention is optional)', () => {
    expect(Value.Check(TaskGraphEdgeAttributes, {})).toBe(true);
  });

  it('accepts a valid qualityRetention number', () => {
    expect(Value.Check(TaskGraphEdgeAttributes, { qualityRetention: 0.9 })).toBe(true);
    expect(Value.Check(TaskGraphEdgeAttributes, { qualityRetention: 0.0 })).toBe(true);
    expect(Value.Check(TaskGraphEdgeAttributes, { qualityRetention: 1.0 })).toBe(true);
  });

  it('rejects non-number qualityRetention', () => {
    expect(Value.Check(TaskGraphEdgeAttributes, { qualityRetention: 'high' })).toBe(false);
    expect(Value.Check(TaskGraphEdgeAttributes, { qualityRetention: null })).toBe(false);
    expect(Value.Check(TaskGraphEdgeAttributes, { qualityRetention: true })).toBe(false);
  });
});

describe('SerializedGraph generic factory', () => {
  it('produces a schema that validates graphology JSON format', () => {
    const graph = {
      attributes: {},
      options: { type: 'directed' as const, multi: false, allowSelfLoops: false },
      nodes: [
        { key: 'task-a', attributes: { name: 'Task A' } },
        { key: 'task-b', attributes: { name: 'Task B', scope: 'narrow' as const } },
      ],
      edges: [
        { key: 'edge-1', source: 'task-a', target: 'task-b', attributes: { qualityRetention: 0.9 } },
      ],
    };
    expect(Value.Check(TaskGraphSerialized, graph)).toBe(true);
  });

  it('accepts empty nodes and edges arrays', () => {
    const graph = {
      attributes: {},
      options: { type: 'directed' as const, multi: false, allowSelfLoops: false },
      nodes: [],
      edges: [],
    };
    expect(Value.Check(TaskGraphSerialized, graph)).toBe(true);
  });

  it('rejects wrong options.type', () => {
    const graph = {
      attributes: {},
      options: { type: 'undirected', multi: false, allowSelfLoops: false },
      nodes: [],
      edges: [],
    };
    expect(Value.Check(TaskGraphSerialized, graph)).toBe(false);
  });

  it('rejects wrong options.multi', () => {
    const graph = {
      attributes: {},
      options: { type: 'directed' as const, multi: true, allowSelfLoops: false },
      nodes: [],
      edges: [],
    };
    expect(Value.Check(TaskGraphSerialized, graph)).toBe(false);
  });

  it('rejects wrong options.allowSelfLoops', () => {
    const graph = {
      attributes: {},
      options: { type: 'directed' as const, multi: false, allowSelfLoops: true },
      nodes: [],
      edges: [],
    };
    expect(Value.Check(TaskGraphSerialized, graph)).toBe(false);
  });

  it('rejects node with invalid attributes', () => {
    const graph = {
      attributes: {},
      options: { type: 'directed' as const, multi: false, allowSelfLoops: false },
      nodes: [{ key: 'bad', attributes: { scope: 'invalid' } }],  // missing name
      edges: [],
    };
    expect(Value.Check(TaskGraphSerialized, graph)).toBe(false);
  });

  it('rejects edge with invalid source/target', () => {
    const graph = {
      attributes: {},
      options: { type: 'directed' as const, multi: false, allowSelfLoops: false },
      nodes: [],
      edges: [{ key: 'e1', source: 42, target: 'b', attributes: {} }],
    };
    expect(Value.Check(TaskGraphSerialized, graph)).toBe(false);
  });

  it('has no schema version field', () => {
    const schema = TaskGraphSerialized as any;
    const props = schema?.properties;
    expect(props).toBeDefined();
    expect(props.version).toBeUndefined();
    expect(props.schemaVersion).toBeUndefined();
  });

  it('can be composed with different attribute schemas (is generic)', () => {
    // Verify SerializedGraph is callable as a factory with different schemas
    const CustomGraph = SerializedGraph(
      TaskGraphNodeAttributes,
      TaskGraphEdgeAttributes,
      // Use a non-empty graph attributes schema to verify genericity
      { type: 'object', properties: { label: { type: 'string' } } } as any,
    );
    expect(CustomGraph).toBeDefined();
    expect((CustomGraph as any).properties).toBeDefined();
  });
});

describe('TaskGraphSerialized type alias (compile-time)', () => {
  it('type alias resolves correctly for a valid graph', () => {
    // This verifies the type alias exists and is usable at compile time
    const graph: TaskGraphSerialized = {
      attributes: {},
      options: { type: 'directed', multi: false, allowSelfLoops: false },
      nodes: [{ key: 'a', attributes: { name: 'A' } }],
      edges: [],
    };
    expect(graph.options.type).toBe('directed');
  });
});

// Import graph type aliases for compile-time verification
type TaskGraphNodeAttributes = import('../src/schema/graph.js').TaskGraphNodeAttributes;
type TaskGraphNodeAttributesUpdate = import('../src/schema/graph.js').TaskGraphNodeAttributesUpdate;
type TaskGraphEdgeAttributes = import('../src/schema/graph.js').TaskGraphEdgeAttributes;
type TaskGraphSerialized = import('../src/schema/graph.js').TaskGraphSerialized;