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

// --- TaskInput and DependencyEdge tests ---

import { TaskInput as TaskInputSchema, DependencyEdge as DependencyEdgeSchema } from '../src/schema/task.js';

// Type alias imports for compile-time verification
type TaskInputType = import('../src/schema/task.js').TaskInput;
type DependencyEdgeType = import('../src/schema/task.js').DependencyEdge;

describe('TaskInput schema', () => {
  const minimal = { id: 'task-1', name: 'My Task', dependsOn: [] };

  it('accepts minimal valid input (id, name, dependsOn only)', () => {
    expect(Value.Check(TaskInputSchema, minimal)).toBe(true);
  });

  it('accepts dependsOn with multiple strings', () => {
    expect(Value.Check(TaskInputSchema, { ...minimal, dependsOn: ['a', 'b', 'c'] })).toBe(true);
  });

  // --- Categorical fields: Optional + Nullable ---

  it('accepts categorical field set to a valid enum value', () => {
    expect(Value.Check(TaskInputSchema, { ...minimal, status: 'pending' })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, scope: 'narrow' })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, risk: 'medium' })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, impact: 'component' })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, level: 'implementation' })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, priority: 'high' })).toBe(true);
  });

  it('accepts categorical field set to null (explicit null in YAML)', () => {
    expect(Value.Check(TaskInputSchema, { ...minimal, status: null })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, scope: null })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, risk: null })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, impact: null })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, level: null })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, priority: null })).toBe(true);
  });

  it('accepts categorical field absent (undefined / missing key)', () => {
    // minimal has no categorical fields — already tested above
    expect(Value.Check(TaskInputSchema, minimal)).toBe(true);
  });

  it('rejects categorical field with invalid enum value', () => {
    expect(Value.Check(TaskInputSchema, { ...minimal, status: 'unknown' })).toBe(false);
    expect(Value.Check(TaskInputSchema, { ...minimal, scope: 'invalid' })).toBe(false);
    expect(Value.Check(TaskInputSchema, { ...minimal, risk: 'bad' })).toBe(false);
  });

  // --- Metadata fields: Optional + Nullable ---

  it('accepts metadata fields with valid values', () => {
    expect(Value.Check(TaskInputSchema, { ...minimal, tags: ['a', 'b'] })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, assignee: 'alice' })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, due: '2026-05-01' })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, created: '2026-04-20' })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, modified: '2026-04-25' })).toBe(true);
  });

  it('accepts metadata fields set to null', () => {
    expect(Value.Check(TaskInputSchema, { ...minimal, assignee: null })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, due: null })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, created: null })).toBe(true);
    expect(Value.Check(TaskInputSchema, { ...minimal, modified: null })).toBe(true);
  });

  it('accepts tags field absent', () => {
    expect(Value.Check(TaskInputSchema, { ...minimal })).toBe(true);
  });

  // --- Required fields ---

  it('rejects missing id', () => {
    expect(Value.Check(TaskInputSchema, { name: 'X', dependsOn: [] })).toBe(false);
  });

  it('rejects missing name', () => {
    expect(Value.Check(TaskInputSchema, { id: '1', dependsOn: [] })).toBe(false);
  });

  it('rejects missing dependsOn', () => {
    expect(Value.Check(TaskInputSchema, { id: '1', name: 'X' })).toBe(false);
  });

  it('rejects wrong types for required fields', () => {
    expect(Value.Check(TaskInputSchema, { id: 1, name: 'X', dependsOn: [] })).toBe(false);
    expect(Value.Check(TaskInputSchema, { id: '1', name: 2, dependsOn: [] })).toBe(false);
    expect(Value.Check(TaskInputSchema, { id: '1', name: 'X', dependsOn: 'not-array' })).toBe(false);
  });

  // --- Full valid input ---

  it('accepts fully populated valid input', () => {
    const full = {
      id: 'task-1',
      name: 'My Task',
      dependsOn: ['task-0'],
      status: 'in-progress',
      scope: 'narrow',
      risk: 'medium',
      impact: 'component',
      level: 'implementation',
      priority: 'high',
      tags: ['backend', 'api'],
      assignee: 'bob',
      due: '2026-06-01',
      created: '2026-04-01',
      modified: '2026-04-27',
    };
    expect(Value.Check(TaskInputSchema, full)).toBe(true);
  });

  it('produces structured errors for invalid input', () => {
    const errors = [...Value.Errors(TaskInputSchema, { id: 1, name: 2, dependsOn: 'nope' })];
    expect(errors.length).toBeGreaterThan(0);
    const paths = errors.map(e => e.path);
    expect(paths).toContain('/id');
    expect(paths).toContain('/name');
    expect(paths).toContain('/dependsOn');
  });
});

describe('DependencyEdge schema', () => {
  const minimal = { from: 'task-a', to: 'task-b' };

  it('accepts minimal valid edge (from, to only)', () => {
    expect(Value.Check(DependencyEdgeSchema, minimal)).toBe(true);
  });

  it('accepts edge with qualityRetention', () => {
    expect(Value.Check(DependencyEdgeSchema, { ...minimal, qualityRetention: 0.9 })).toBe(true);
  });

  it('accepts qualityRetention at boundary values 0.0 and 1.0', () => {
    expect(Value.Check(DependencyEdgeSchema, { ...minimal, qualityRetention: 0.0 })).toBe(true);
    expect(Value.Check(DependencyEdgeSchema, { ...minimal, qualityRetention: 1.0 })).toBe(true);
  });

  it('rejects missing from field', () => {
    expect(Value.Check(DependencyEdgeSchema, { to: 'task-b' })).toBe(false);
  });

  it('rejects missing to field', () => {
    expect(Value.Check(DependencyEdgeSchema, { from: 'task-a' })).toBe(false);
  });

  it('rejects wrong types for from/to', () => {
    expect(Value.Check(DependencyEdgeSchema, { from: 1, to: 'task-b' })).toBe(false);
    expect(Value.Check(DependencyEdgeSchema, { from: 'task-a', to: 2 })).toBe(false);
  });

  it('rejects wrong type for qualityRetention', () => {
    expect(Value.Check(DependencyEdgeSchema, { ...minimal, qualityRetention: 'high' })).toBe(false);
  });

  it('allows qualityRetention absent (optional)', () => {
    expect(Value.Check(DependencyEdgeSchema, minimal)).toBe(true);
  });

  it('produces structured errors for invalid input', () => {
    const errors = [...Value.Errors(DependencyEdgeSchema, { from: 1, to: 2 })];
    expect(errors.length).toBeGreaterThan(0);
    const paths = errors.map(e => e.path);
    expect(paths).toContain('/from');
    expect(paths).toContain('/to');
  });
});

describe('Type alias correctness — TaskInput and DependencyEdge (compile-time)', () => {
  it('TaskInput type accepts a valid object', () => {
    const input: TaskInputType = { id: 't1', name: 'T', dependsOn: [], risk: null };
    expect(input.id).toBe('t1');
  });

  it('DependencyEdge type accepts a valid object', () => {
    const edge: DependencyEdgeType = { from: 'a', to: 'b', qualityRetention: 0.8 };
    expect(edge.from).toBe('a');
  });

  it('DependencyEdge type works without qualityRetention', () => {
    const edge: DependencyEdgeType = { from: 'a', to: 'b' };
    expect(edge.qualityRetention).toBeUndefined();
  });
});

// Re-export Nullable from task.ts to verify the re-export works
import { Nullable as NullableFromTask } from '../src/schema/task.js';

describe('Nullable re-export from task.ts', () => {
  it('is the same function as from enums.ts', () => {
    expect(NullableFromTask).toBe(Nullable);
  });
});

// Intentionally import type aliases to verify they exist at compile time
type TaskScope = import('../src/schema/enums.js').TaskScope;
type TaskRisk = import('../src/schema/enums.js').TaskRisk;
type TaskImpact = import('../src/schema/enums.js').TaskImpact;
type TaskLevel = import('../src/schema/enums.js').TaskLevel;
type TaskPriority = import('../src/schema/enums.js').TaskPriority;
type TaskStatus = import('../src/schema/enums.js').TaskStatus;