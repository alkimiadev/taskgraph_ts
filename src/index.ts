// @alkdev/taskgraph — Public API surface
//
// This is the main entry point for consumers. Everything they need should be
// importable from `@alkdev/taskgraph`. Internal implementation details (types
// and functions that operate on the raw graphology instance) are intentionally
// NOT re-exported here to maintain a clean public API boundary.

// ---------------------------------------------------------------------------
// TaskGraph class (the primary data structure)
// ---------------------------------------------------------------------------

export { TaskGraph } from './graph/construction.js';

// ---------------------------------------------------------------------------
// Analysis functions (standalone, composable)
// ---------------------------------------------------------------------------

// Graph analysis
export { parallelGroups } from './analysis/parallel-groups.js';
export { criticalPath, weightedCriticalPath } from './analysis/critical-path.js';
export { bottlenecks } from './analysis/bottleneck.js';
export type { BottleneckResult } from './analysis/bottleneck.js';

// Cost-benefit analysis
export { riskPath, riskDistribution } from './analysis/risk.js';
export { calculateTaskEv, workflowCost } from './analysis/cost-benefit.js';
export { shouldDecomposeTask } from './analysis/decompose.js';

// Categorical numeric methods
export {
  scopeCostEstimate,
  scopeTokenEstimate,
  riskSuccessProbability,
  riskWeight,
  impactWeight,
  resolveDefaults,
} from './analysis/defaults.js';

// ---------------------------------------------------------------------------
// Frontmatter functions
// ---------------------------------------------------------------------------

export { parseFrontmatter } from './frontmatter/parse.js';
export { serializeFrontmatter } from './frontmatter/serialize.js';
export { parseTaskFile, parseTaskDirectory } from './frontmatter/file-io.js';

// ---------------------------------------------------------------------------
// Schemas and types
// ---------------------------------------------------------------------------

// Enum schemas + types (const+type pairs with same name: export by value, TS includes type)
export {
  TaskScopeEnum,
  TaskRiskEnum,
  TaskImpactEnum,
  TaskLevelEnum,
  TaskPriorityEnum,
  TaskStatusEnum,
} from './schema/enums.js';

export type {
  TaskScope,
  TaskRisk,
  TaskImpact,
  TaskLevel,
  TaskPriority,
  TaskStatus,
} from './schema/enums.js';

// Input schemas + types
export { TaskInput, DependencyEdge } from './schema/task.js';

// Graph schemas + types (exclude SerializedGraph generic factory and TaskGraphNodeAttributesUpdate)
export {
  TaskGraphNodeAttributes,
  TaskGraphEdgeAttributes,
  TaskGraphSerialized,
} from './schema/graph.js';

// Result schemas + types
export {
  RiskPathResult,
  DecomposeResult,
  WorkflowCostOptions,
  WorkflowCostResult,
  EvConfig,
  EvResult,
  RiskDistributionResult,
  ResolvedTaskAttributes,
} from './schema/results.js';

// ---------------------------------------------------------------------------
// Error classes + validation error types
// ---------------------------------------------------------------------------

export {
  TaskgraphError,
  TaskNotFoundError,
  CircularDependencyError,
  InvalidInputError,
  DuplicateNodeError,
  DuplicateEdgeError,
} from './error/index.js';

export type {
  ValidationError,
  GraphValidationError,
  AnyValidationError,
} from './error/index.js';