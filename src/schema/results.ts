import { Type, type Static } from "@alkdev/typebox";

// --- RiskPathResult ---

/** Result of finding the highest-risk path through the graph. */
export const RiskPathResult = Type.Object({
  path: Type.Array(Type.String()),
  totalRisk: Type.Number(),
});
/** { path: string[], totalRisk: number } */
export type RiskPathResult = Static<typeof RiskPathResult>;

// --- DecomposeResult ---

/** Result of decomposing whether a task should be split. */
export const DecomposeResult = Type.Object({
  shouldDecompose: Type.Boolean(),
  reasons: Type.Array(Type.String()),
});
/** { shouldDecompose: boolean, reasons: string[] } */
export type DecomposeResult = Static<typeof DecomposeResult>;

// --- WorkflowCostOptions ---

/** Options for the workflowCost analysis function. */
export const WorkflowCostOptions = Type.Object({
  includeCompleted: Type.Optional(Type.Boolean()),
  limit: Type.Optional(Type.Number()),
  propagationMode: Type.Optional(
    Type.Union([Type.Literal("independent"), Type.Literal("dag-propagate")])
  ),
  defaultQualityRetention: Type.Optional(Type.Number()),
});
/** Options for workflowCost analysis */
export type WorkflowCostOptions = Static<typeof WorkflowCostOptions>;

// --- WorkflowCostResult ---

/** Per-task entry within WorkflowCostResult.tasks */
const WorkflowCostTaskEntry = Type.Object({
  taskId: Type.String(),
  name: Type.String(),
  ev: Type.Number(),
  pIntrinsic: Type.Number(),
  pEffective: Type.Number(),
  probability: Type.Number(),
  scopeCost: Type.Number(),
  impactWeight: Type.Number(),
});

/** Result of the workflowCost analysis function. */
export const WorkflowCostResult = Type.Object({
  tasks: Type.Array(WorkflowCostTaskEntry),
  totalEv: Type.Number(),
  averageEv: Type.Number(),
  propagationMode: Type.Union([
    Type.Literal("independent"),
    Type.Literal("dag-propagate"),
  ]),
});
/** Result of workflowCost analysis */
export type WorkflowCostResult = Static<typeof WorkflowCostResult>;

// --- EvConfig ---

/** Configuration for calculateTaskEv with sensible defaults. */
export const EvConfig = Type.Object({
  retries: Type.Optional(Type.Number({ default: 0 })),
  fallbackCost: Type.Optional(Type.Number({ default: 0 })),
  timeLost: Type.Optional(Type.Number({ default: 0 })),
  valueRate: Type.Optional(Type.Number({ default: 0 })),
});
/** Configuration for expected value calculation */
export type EvConfig = Static<typeof EvConfig>;

// --- EvResult ---

/** Result of the calculateTaskEv function. */
export const EvResult = Type.Object({
  ev: Type.Number(),
  pSuccess: Type.Number(),
  expectedRetries: Type.Number(),
});
/** { ev: number, pSuccess: number, expectedRetries: number } */
export type EvResult = Static<typeof EvResult>;

// --- RiskDistributionResult ---

/** Distribution of tasks by risk level. */
export const RiskDistributionResult = Type.Object({
  trivial: Type.Array(Type.String()),
  low: Type.Array(Type.String()),
  medium: Type.Array(Type.String()),
  high: Type.Array(Type.String()),
  critical: Type.Array(Type.String()),
  unspecified: Type.Array(Type.String()),
});
/** Distribution of tasks by risk level */
export type RiskDistributionResult = Static<typeof RiskDistributionResult>;