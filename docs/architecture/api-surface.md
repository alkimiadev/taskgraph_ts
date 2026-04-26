---
status: draft
last_updated: 2026-04-26
---

# API Surface

The library's public API: a thin `TaskGraph` data class for graph construction/mutation/basic queries, plus standalone composable analysis functions.

## Design Principle: Decomposition over Monolith

The `TaskGraph` class handles **graph construction, mutation, and basic queries only**. All analysis functions (parallel groups, critical path, cost-benefit, etc.) are standalone functions that take a `TaskGraph` as their first argument.

**Why**: Both consumers (alkhub, OpenCode plugin) need the same analysis functions but through different dispatch mechanisms. The library exports pure functions; each consumer wraps them in its own dispatch. This avoids duplicate work and prevents the class from becoming a 25+ method monolith.

> The operations/dispatch pattern belongs at the consumer layer, not the library layer. The library is a toolkit, not a service.

## TaskGraph Class

```typescript
class TaskGraph {
  // Construction
  static fromTasks(tasks: TaskInput[]): TaskGraph
  static fromRecords(tasks: TaskInput[], edges: DependencyEdge[]): TaskGraph
  static fromJSON(data: TaskGraphSerialized): TaskGraph
  addTask(id: string, attributes: TaskGraphNodeAttributes): void
  addDependency(prerequisite: string, dependent: string): void

  // Mutation
  removeTask(id: string): void
  removeDependency(prerequisite: string, dependent: string): void
  updateTask(id: string, attributes: Partial<TaskGraphNodeAttributes>): void
  updateEdgeAttributes(prerequisite: string, dependent: string, attrs: Partial<TaskGraphEdgeAttributes>): void

  // Queries
  hasCycles(): boolean
  findCycles(): string[][]
  topologicalOrder(): string[]  // throws CircularDependencyError if cyclic
  dependencies(taskId: string): string[]
  dependents(taskId: string): string[]
  taskCount(): number
  getTask(taskId: string): TaskGraphNodeAttributes | undefined

  // Subgraph
  subgraph(filter: (taskId: string, attrs: TaskGraphNodeAttributes) => boolean): TaskGraph

  // Export
  export(): TaskGraphSerialized
  toJSON(): TaskGraphSerialized

  // Reactivity
  get raw(): Graph  // underlying graphology instance for direct event listener attachment
}
```

**Notes**:
- `topologicalOrder()` throws `CircularDependencyError` (with `cycles` populated) when cyclic — see [ADR-003](decisions/003-topo-order-throws-on-cycle.md)
- `subgraph()` returns a new `TaskGraph` with matching nodes and only edges where both endpoints are in the filtered set — see [ADR-007](decisions/007-subgraph-internal-only.md)
- `addDependency` uses `addEdgeWithKey` with deterministic keys (`${source}->${target}`) — see [ADR-006](decisions/006-deterministic-edge-keys.md)
- `addTask` throws `DuplicateNodeError` if the ID already exists, `addDependency` throws `DuplicateEdgeError` if the edge already exists, and `TaskNotFoundError` if either endpoint doesn't exist in the graph — see [errors-validation.md](errors-validation.md)

## Standalone Analysis Functions

All analysis functions take a `TaskGraph` (or its raw graphology `Graph`) as their first argument. They are composable and stateless.

### Graph analysis

```typescript
function parallelGroups(graph: TaskGraph): string[][]
function criticalPath(graph: TaskGraph): string[]
function weightedCriticalPath(graph: TaskGraph, weightFn: (taskId: string, attrs: TaskGraphNodeAttributes) => number): string[]
function bottlenecks(graph: TaskGraph): Array<{ taskId: string; score: number }>
```

### Cost-benefit analysis

```typescript
function riskPath(graph: TaskGraph): RiskPathResult
function shouldDecomposeTask(attrs: TaskGraphNodeAttributes): DecomposeResult
function workflowCost(graph: TaskGraph, options?: WorkflowCostOptions): WorkflowCostResult
function riskDistribution(graph: TaskGraph): RiskDistributionResult
```

> **Note on `shouldDecomposeTask`**: Takes `TaskGraphNodeAttributes` (nullable categorical fields) and internally calls `resolveDefaults` for `risk` and `scope`. Unassessed fields (null) use defaults that are below the decomposition threshold, so only explicitly-assessed high-risk or broad-scope tasks are flagged. See [cost-benefit.md](cost-benefit.md).

> **Note on `workflowCost` vs `calculateTaskEv`**: `calculateTaskEv` is a pure math function (takes numeric inputs, returns `EvResult`). `workflowCost` orchestrates the per-task calls, handles DAG propagation, and enriches results with `taskId` and `name` from the graph's node attributes. The per-task `EvResult` is a subset of `WorkflowCostResult.tasks[i]`.

### Categorical enum numeric methods

```typescript
function scopeCostEstimate(scope: TaskScope): number       // 1.0–5.0
function scopeTokenEstimate(scope: TaskScope): number      // 500–10000
function riskSuccessProbability(risk: TaskRisk): number    // 0.50–0.98
function riskWeight(risk: TaskRisk): number                // 0.02–0.50
function impactWeight(impact: TaskImpact): number          // 1.0–3.0

function resolveDefaults(attrs: Partial<TaskGraphNodeAttributes>): ResolvedTaskAttributes
```

### Cost-benefit core

```typescript
function calculateTaskEv(p: number, scopeCost: number, impactWeight: number, config?: EvConfig): EvResult
```

> See [schemas.md](schemas.md) for the enum definitions and numeric mapping tables.

## Return Types

All return types are defined as TypeBox schemas (for runtime validation + JSON Schema export) with corresponding static TypeScript types.

### RiskPathResult

```typescript
const RiskPathResult = Type.Object({
  path: Type.Array(Type.String()),
  totalRisk: Type.Number(),
})
```

### DecomposeResult

```typescript
const DecomposeResult = Type.Object({
  shouldDecompose: Type.Boolean(),
  reasons: Type.Array(Type.String()),
})
```

### WorkflowCostOptions

```typescript
const WorkflowCostOptions = Type.Object({
  includeCompleted: Type.Optional(Type.Boolean()),
  limit: Type.Optional(Type.Number()),
  propagationMode: Type.Optional(
    Type.Union([Type.Literal("independent"), Type.Literal("dag-propagate")])
  ),
  defaultQualityDegradation: Type.Optional(Type.Number()),
})
```

### WorkflowCostResult

```typescript
const WorkflowCostResult = Type.Object({
  tasks: Type.Array(
    Type.Object({
      taskId: Type.String(),
      name: Type.String(),
      ev: Type.Number(),
      pIntrinsic: Type.Number(),
      pEffective: Type.Number(),
      probability: Type.Number(),
      scopeCost: Type.Number(),
      impactWeight: Type.Number(),
    })
  ),
  totalEv: Type.Number(),
  averageEv: Type.Number(),
  propagationMode: Type.Union([
    Type.Literal("independent"),
    Type.Literal("dag-propagate"),
  ]),
})
```

### EvConfig / EvResult

```typescript
const EvConfig = Type.Object({
  retries: Type.Optional(Type.Number()),
  fallbackCost: Type.Optional(Type.Number()),
  timeLost: Type.Optional(Type.Number()),
  valueRate: Type.Optional(Type.Number()),
})

const EvResult = Type.Object({
  ev: Type.Number(),
  pSuccess: Type.Number(),
  expectedRetries: Type.Number(),
})
```

### RiskDistributionResult

```typescript
const RiskDistributionResult = Type.Object({
  trivial: Type.Array(Type.String()),
  low: Type.Array(Type.String()),
  medium: Type.Array(Type.String()),
  high: Type.Array(Type.String()),
  critical: Type.Array(Type.String()),
  unspecified: Type.Array(Type.String()),
})
```

> Full schema definitions with Static type exports are in [schemas.md](schemas.md).

## Validation API

```typescript
// On TaskGraph instances:
validateSchema(): ValidationError[]    // TypeBox validation on input data
validateGraph(): GraphValidationError[] // Graph-level invariants (cycles, dangling refs)
validate(): ValidationError[]          // Both, for convenience
```

> See [errors-validation.md](errors-validation.md) for error types and validation details.

## Constraints

- **No write actions in analysis functions** — all analysis functions are pure reads. `shouldDecomposeTask` only inspects attributes, it doesn't modify the graph.
- **throw-on-cycle for topo sort** — `topologicalOrder` throws rather than returning a partial result. See [ADR-003](decisions/003-topo-order-throws-on-cycle.md).
- **Analysis functions are independent** — they can be called in any order, without prerequisites beyond a valid graph.