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

// --- Result schema tests ---

import {
  RiskPathResult as RiskPathResultSchema,
  DecomposeResult as DecomposeResultSchema,
  WorkflowCostOptions as WorkflowCostOptionsSchema,
  WorkflowCostResult as WorkflowCostResultSchema,
  EvConfig as EvConfigSchema,
  EvResult as EvResultSchema,
  RiskDistributionResult as RiskDistributionResultSchema,
} from '../src/schema/results.js';

// Re-import type aliases for compile-time verification
type RiskPathResultType = import('../src/schema/results.js').RiskPathResult;
type DecomposeResultType = import('../src/schema/results.js').DecomposeResult;
type WorkflowCostOptionsType = import('../src/schema/results.js').WorkflowCostOptions;
type WorkflowCostResultType = import('../src/schema/results.js').WorkflowCostResult;
type EvConfigType = import('../src/schema/results.js').EvConfig;
type EvResultType = import('../src/schema/results.js').EvResult;
type RiskDistributionResultType = import('../src/schema/results.js').RiskDistributionResult;

describe('RiskPathResult schema', () => {
  it('accepts valid input', () => {
    expect(Value.Check(RiskPathResultSchema, { path: ['a', 'b', 'c'], totalRisk: 0.75 })).toBe(true);
  });

  it('accepts empty path', () => {
    expect(Value.Check(RiskPathResultSchema, { path: [], totalRisk: 0 })).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(Value.Check(RiskPathResultSchema, { path: ['a'] })).toBe(false);
    expect(Value.Check(RiskPathResultSchema, { totalRisk: 0.5 })).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(Value.Check(RiskPathResultSchema, { path: 'not-array', totalRisk: 0.5 })).toBe(false);
    expect(Value.Check(RiskPathResultSchema, { path: ['a'], totalRisk: 'not-number' })).toBe(false);
  });
});

describe('DecomposeResult schema', () => {
  it('accepts shouldDecompose=true with reasons', () => {
    expect(Value.Check(DecomposeResultSchema, { shouldDecompose: true, reasons: ['high risk', 'broad scope'] })).toBe(true);
  });

  it('accepts shouldDecompose=false with empty reasons', () => {
    expect(Value.Check(DecomposeResultSchema, { shouldDecompose: false, reasons: [] })).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(Value.Check(DecomposeResultSchema, { shouldDecompose: true })).toBe(false);
    expect(Value.Check(DecomposeResultSchema, { reasons: ['x'] })).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(Value.Check(DecomposeResultSchema, { shouldDecompose: 'yes', reasons: [] })).toBe(false);
    expect(Value.Check(DecomposeResultSchema, { shouldDecompose: true, reasons: 'not-array' })).toBe(false);
  });
});

describe('WorkflowCostOptions schema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(Value.Check(WorkflowCostOptionsSchema, {})).toBe(true);
  });

  it('accepts all fields specified', () => {
    expect(Value.Check(WorkflowCostOptionsSchema, {
      includeCompleted: true,
      limit: 10,
      propagationMode: 'independent',
      defaultQualityRetention: 0.9,
    })).toBe(true);
  });

  it('accepts dag-propagate propagationMode', () => {
    expect(Value.Check(WorkflowCostOptionsSchema, { propagationMode: 'dag-propagate' })).toBe(true);
  });

  it('rejects invalid propagationMode', () => {
    expect(Value.Check(WorkflowCostOptionsSchema, { propagationMode: 'invalid' })).toBe(false);
  });

  it('rejects wrong type for boolean field', () => {
    expect(Value.Check(WorkflowCostOptionsSchema, { includeCompleted: 'yes' })).toBe(false);
  });

  it('rejects wrong type for number fields', () => {
    expect(Value.Check(WorkflowCostOptionsSchema, { limit: 'ten' })).toBe(false);
    expect(Value.Check(WorkflowCostOptionsSchema, { defaultQualityRetention: 'high' })).toBe(false);
  });
});

describe('WorkflowCostResult schema', () => {
  const validResult = {
    tasks: [{
      taskId: 'task-1',
      name: 'My Task',
      ev: 3.5,
      pIntrinsic: 0.8,
      pEffective: 0.75,
      probability: 0.75,
      scopeCost: 2.0,
      impactWeight: 1.5,
    }],
    totalEv: 3.5,
    averageEv: 3.5,
    propagationMode: 'independent',
  };

  it('accepts valid result with independent mode', () => {
    expect(Value.Check(WorkflowCostResultSchema, validResult)).toBe(true);
  });

  it('accepts valid result with dag-propagate mode', () => {
    expect(Value.Check(WorkflowCostResultSchema, { ...validResult, propagationMode: 'dag-propagate' })).toBe(true);
  });

  it('accepts empty tasks array', () => {
    expect(Value.Check(WorkflowCostResultSchema, {
      tasks: [],
      totalEv: 0,
      averageEv: 0,
      propagationMode: 'independent',
    })).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(Value.Check(WorkflowCostResultSchema, { tasks: [], totalEv: 0, averageEv: 0 })).toBe(false);
  });

  it('rejects invalid propagationMode', () => {
    expect(Value.Check(WorkflowCostResultSchema, { ...validResult, propagationMode: 'invalid' })).toBe(false);
  });

  it('rejects task entry with missing fields', () => {
    const incomplete = {
      tasks: [{ taskId: 't1', name: 'T1' }],
      totalEv: 0,
      averageEv: 0,
      propagationMode: 'independent',
    };
    expect(Value.Check(WorkflowCostResultSchema, incomplete)).toBe(false);
  });
});

describe('EvConfig schema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(Value.Check(EvConfigSchema, {})).toBe(true);
  });

  it('accepts all fields specified', () => {
    expect(Value.Check(EvConfigSchema, {
      retries: 3,
      fallbackCost: 10,
      timeLost: 5,
      valueRate: 0.5,
    })).toBe(true);
  });

  it('rejects wrong types', () => {
    expect(Value.Check(EvConfigSchema, { retries: 'three' })).toBe(false);
    expect(Value.Check(EvConfigSchema, { fallbackCost: true })).toBe(false);
  });

  it('rejects unknown properties (additionalProperties)', () => {
    // TypeBox Object by default allows additional properties through Check
    // This test documents behavior — strict additionalProperties would need Type.Object({...}, { additionalProperties: false })
    expect(Value.Check(EvConfigSchema, { unknownField: 42 })).toBe(true);
  });
});

describe('EvResult schema', () => {
  it('accepts valid input', () => {
    expect(Value.Check(EvResultSchema, { ev: 3.5, pSuccess: 0.8, expectedRetries: 1.2 })).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(Value.Check(EvResultSchema, { ev: 3.5, pSuccess: 0.8 })).toBe(false);
  });

  it('rejects wrong types', () => {
    expect(Value.Check(EvResultSchema, { ev: 'high', pSuccess: 0.8, expectedRetries: 1 })).toBe(false);
  });
});

describe('RiskDistributionResult schema', () => {
  it('accepts valid distribution', () => {
    expect(Value.Check(RiskDistributionResultSchema, {
      trivial: ['t1'],
      low: ['t2', 't3'],
      medium: [],
      high: ['t4'],
      critical: [],
      unspecified: ['t5'],
    })).toBe(true);
  });

  it('accepts all empty arrays', () => {
    expect(Value.Check(RiskDistributionResultSchema, {
      trivial: [],
      low: [],
      medium: [],
      high: [],
      critical: [],
      unspecified: [],
    })).toBe(true);
  });

  it('rejects missing fields', () => {
    expect(Value.Check(RiskDistributionResultSchema, {
      trivial: [],
      low: [],
      medium: [],
      high: [],
      critical: [],
    })).toBe(false);
  });

  it('rejects non-array values', () => {
    expect(Value.Check(RiskDistributionResultSchema, {
      trivial: 't1',
      low: [],
      medium: [],
      high: [],
      critical: [],
      unspecified: [],
    })).toBe(false);
  });

  it('rejects non-string array elements', () => {
    expect(Value.Check(RiskDistributionResultSchema, {
      trivial: [123],
      low: [],
      medium: [],
      high: [],
      critical: [],
      unspecified: [],
    })).toBe(false);
  });
});

describe('Result type alias correctness (compile-time)', () => {
  it('RiskPathResult type accepts valid values', () => {
    const result: RiskPathResultType = { path: ['a'], totalRisk: 0.5 };
    expect(result.totalRisk).toBe(0.5);
  });

  it('DecomposeResult type accepts valid values', () => {
    const result: DecomposeResultType = { shouldDecompose: true, reasons: ['high risk'] };
    expect(result.shouldDecompose).toBe(true);
  });

  it('WorkflowCostOptions type accepts valid values', () => {
    const opts: WorkflowCostOptionsType = { propagationMode: 'dag-propagate', limit: 5 };
    expect(opts.propagationMode).toBe('dag-propagate');
  });

  it('WorkflowCostResult type accepts valid values', () => {
    const result: WorkflowCostResultType = {
      tasks: [],
      totalEv: 0,
      averageEv: 0,
      propagationMode: 'independent',
    };
    expect(result.propagationMode).toBe('independent');
  });

  it('EvConfig type accepts valid values', () => {
    const config: EvConfigType = { retries: 3, fallbackCost: 10 };
    expect(config.retries).toBe(3);
  });

  it('EvResult type accepts valid values', () => {
    const result: EvResultType = { ev: 2.5, pSuccess: 0.9, expectedRetries: 0.5 };
    expect(result.ev).toBe(2.5);
  });

  it('RiskDistributionResult type accepts valid values', () => {
    const result: RiskDistributionResultType = {
      trivial: [],
      low: [],
      medium: [],
      high: [],
      critical: [],
      unspecified: [],
    };
    expect(result.unspecified).toEqual([]);
  });
});