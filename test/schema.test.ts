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

// Intentionally import type aliases to verify they exist at compile time
type TaskScope = import('../src/schema/enums.js').TaskScope;
type TaskRisk = import('../src/schema/enums.js').TaskRisk;
type TaskImpact = import('../src/schema/enums.js').TaskImpact;
type TaskLevel = import('../src/schema/enums.js').TaskLevel;
type TaskPriority = import('../src/schema/enums.js').TaskPriority;
type TaskStatus = import('../src/schema/enums.js').TaskStatus;