---
status: draft
last_updated: 2026-04-26
---

# Schemas

TypeBox schema definitions, categorical enums, and their numeric methods.

## Design Decision: TypeBox as Single Source of Truth

All data shapes are defined as TypeBox schemas. This gives us:

1. **Static TypeScript types** via `Static<typeof Schema>` — compile-time safety
2. **Runtime validation** via `Value.Check()` / `Value.Assert()` — reject bad input before it hits the graph
3. **JSON Schema** for free — can be used by consumers for their own validation, API contracts, etc.

The TypeBox schemas serve as the single source of truth for both types and validation. No separate type definitions, no Zod, no ad-hoc validation logic. Consumers with Zod in their stack can convert at their boundary.

## Input Schemas

### TaskInput

The universal input shape for a task, matching the Rust `TaskFrontmatter` field set:

```typescript
const TaskInput = Type.Object({
  id: Type.String(),
  name: Type.String(),
  dependsOn: Type.Array(Type.String()),
  status: Type.Optional(TaskStatusEnum),
  scope: Type.Optional(TaskScopeEnum),
  risk: Type.Optional(TaskRiskEnum),
  impact: Type.Optional(TaskImpactEnum),
  level: Type.Optional(TaskLevelEnum),
  priority: Type.Optional(TaskPriorityEnum),
  tags: Type.Optional(Type.Array(Type.String())),
  assignee: Type.Optional(Type.String()),
  due: Type.Optional(Type.String()),
  created: Type.Optional(Type.String()),
  modified: Type.Optional(Type.String()),
})
```

### DependencyEdge

```typescript
const DependencyEdge = Type.Object({
  from: Type.String(),              // prerequisite task id
  to: Type.String(),                // dependent task id
  qualityDegradation: Type.Optional(Type.Number()),  // 0.0–1.0, default 0.9
})
```

The `qualityDegradation` field models how much upstream failure bleeds through to the dependent task. Value of 0.0 means no propagation (independent model), 1.0 means full propagation. Default is 0.9 following the Python research model. Only used by `workflowCost` in DAG-propagation mode; ignored by all other algorithms.

## Graph Attribute Schemas

### TaskGraphNodeAttributes

Node attributes stored on the graphology graph. The node key is the task `id` (slug). Attributes carry only the metadata needed for graph analysis — no body/content:

```typescript
const TaskGraphNodeAttributes = Type.Object({
  name: Type.String(),
  scope: Type.Optional(TaskScopeEnum),
  risk: Type.Optional(TaskRiskEnum),
  impact: Type.Optional(TaskImpactEnum),
  level: Type.Optional(TaskLevelEnum),
  priority: Type.Optional(TaskPriorityEnum),
  status: Type.Optional(TaskStatusEnum),
})
```

### TaskGraphEdgeAttributes

```typescript
const TaskGraphEdgeAttributes = Type.Object({
  qualityDegradation: Type.Optional(Type.Number()),
})
```

### SerializedGraph

Following the graphology native JSON format, parameterized with our attribute types:

```typescript
const TaskGraphSerialized = SerializedGraph(
  TaskGraphNodeAttributes,
  TaskGraphEdgeAttributes,
  Type.Object({})
)
```

This validates the graphology `export()` output and enables `import()` from validated JSON blobs.

**No schema version field**: The serialized format follows graphology's native JSON format and does not include a version field. Serialized graphs are not a persistence format with backward-compatibility guarantees. They serve as an intermediate transport format (e.g., for caching, IPC, or test fixtures). Consumers that need persistence should wrap the serialized output in their own versioned envelope.

## Categorical Enums

### Enum Definitions

Categorical enums are defined with `Type.Union(Type.Literal(...))` — string values matching the DB and frontmatter conventions.

**Naming convention**: The TypeBox schema constants use an `Enum` suffix (e.g., `TaskScopeEnum`, `TaskRiskEnum`). The corresponding TypeScript type aliases drop the suffix (e.g., `type TaskScope = Static<typeof TaskScopeEnum>`). The schema constant is the runtime value; the type alias is the compile-time type. All function signatures use the compile-time type names.

| Enum Schema Constant | TypeScript Type | Values |
|----------------------|-----------------|--------|
| `TaskScopeEnum` | `TaskScope` | single, narrow, moderate, broad, system |
| `TaskRiskEnum` | `TaskRisk` | trivial, low, medium, high, critical |
| `TaskImpactEnum` | `TaskImpact` | isolated, component, phase, project |
| `TaskLevelEnum` | `TaskLevel` | planning, decomposition, implementation, review, research |
| `TaskPriorityEnum` | `TaskPriority` | low, medium, high, critical |
| `TaskStatusEnum` | `TaskStatus` | pending, in-progress, completed, failed, blocked |

### Numeric Methods

#### TaskScope → cost/token estimates

| TaskScope | costEstimate | tokenEstimate |
|-----------|-------------|---------------|
| single | 1.0 | 500 |
| narrow | 2.0 | 1500 |
| moderate | 3.0 | 3000 |
| broad | 4.0 | 6000 |
| system | 5.0 | 10000 |

#### TaskRisk → probability/weight

| TaskRisk | successProbability | riskWeight (1-p) |
|----------|--------------------|--------------------|
| trivial | 0.98 | 0.02 |
| low | 0.90 | 0.10 |
| medium | 0.80 | 0.20 |
| high | 0.65 | 0.35 |
| critical | 0.50 | 0.50 |

#### TaskImpact → weight

| TaskImpact | weight |
|-----------|--------|
| isolated | 1.0 |
| component | 1.5 |
| phase | 2.0 |
| project | 3.0 |

#### Label-only enums

`TaskLevel` and `TaskPriority` have no numeric methods — they are for labeling/filtering only.

### Standalone Numeric Functions

These are standalone functions (not methods on enum objects) for maximum composability:

```typescript
function scopeCostEstimate(scope: TaskScope): number       // 1.0–5.0
function scopeTokenEstimate(scope: TaskScope): number      // 500–10000
function riskSuccessProbability(risk: TaskRisk): number    // 0.50–0.98
function riskWeight(risk: TaskRisk): number                // 0.02–0.50
function impactWeight(impact: TaskImpact): number          // 1.0–3.0
function resolveDefaults(attrs: Partial<TaskGraphNodeAttributes>): ResolvedTaskAttributes
```

## ResolvedTaskAttributes

The output of `resolveDefaults` — all categorical fields resolved to their numeric equivalents for use in analysis:

```typescript
interface ResolvedTaskAttributes {
  name: string
  scope: TaskScope
  risk: TaskRisk
  impact: TaskImpact
  level: TaskLevel | null
  priority: TaskPriority | null
  status: TaskStatus | null
  // Numeric equivalents (always present after resolution):
  costEstimate: number
  tokenEstimate: number
  successProbability: number
  riskWeight: number
  impactWeight: number
}
```

**Why `level`, `priority`, and `status` remain nullable**: These three fields are label-only enums with no numeric methods (see "Label-only enums" above). They are used for filtering and labeling, not for cost calculations. A task with `level: null` simply hasn't been categorized — the analysis functions don't need a numeric value for it. `risk`, `scope`, and `impact` are the only fields that feed into EV and risk calculations, so they're the only ones that need default resolution.

> **Note on `level`**: While the cost-benefit framework shows that "risk: critical at planning level > risk: critical at implementation level" (upstream failures multiply), this is captured by the DAG-propagation model's topology-aware cost computation, not by a numeric value on `level` itself. The `level` field serves as metadata for filtering and display, not as a cost input.

## Constraints

- **Nullable categorical fields are meaningful** — NULL means "not yet assessed," not "use default." The `resolveDefaults` helper makes this explicit. See [graph-model.md](graph-model.md) for the default mappings.
- **No Zod bridge** — Consumers with Zod in their stack can convert at their boundary. The library does not provide a Zod interop layer.
- **Enum values match DB and frontmatter conventions** — The string values are identical to the Rust `TaskFrontmatter` field values and the alkhub `pgEnum` definitions.