---
status: draft
last_updated: 2026-04-26
---

# Schemas

TypeBox schema definitions, categorical enums, and their numeric methods.

## Design Decision: TypeBox as Single Source of Truth

All data shapes are defined as TypeBox schemas. This gives us:

1. **Static TypeScript types** via `Static<typeof Schema>` — every schema constant has a corresponding `type X = Static<typeof X>` alias. The schema is the source of truth; the type is derived from it. No separate `interface` or `type` definitions outside of `Static<typeof>`.
2. **Runtime validation** via `Value.Check()` / `Value.Errors()` — structured field-level error reporting with path, message, and value. Used for input validation before graph construction.
3. **JSON Schema** for free — can be used by consumers for their own validation, API contracts, etc.

The TypeBox schemas serve as the single source of truth for both types and validation. No separate type definitions, no Zod, no ad-hoc validation logic. Consumers with Zod in their stack can convert at their boundary.

### Naming Convention

| Category | Convention | Example |
|----------|-----------|---------|
| Enum schema constant | PascalCase + `Enum` suffix | `TaskStatusEnum` |
| Enum type alias | PascalCase, no suffix | `type TaskStatus = Static<typeof TaskStatusEnum>` |
| Object schema constant | PascalCase, no suffix | `TaskInput`, `ResolvedTaskAttributes` |
| Object type alias | Same name as schema constant (TypeScript resolves by context) | `type TaskInput = Static<typeof TaskInput>` |
| Function signatures | Use compile-time type aliases | `function riskSuccessProbability(risk: TaskRisk): number` |

**Rule**: Schema constant = runtime value (has `Enum` suffix only for enums). Type alias = compile-time type (never has `Enum` suffix). Function signatures always use the type alias.

### TypeBox Patterns Used

- `Type.Union([Type.Literal(...)])` for categorical enums — the idiomatic pattern for finite string unions
- `Type.Optional()` for nullable-optional fields
- `Static<typeof Schema>` for deriving all TypeScript types — never hand-write `interface` or `type` for schemas
- `Value.Check()` + `Value.Errors()` for structured validation (not `Value.Assert()` which throws without field-level detail)
- `Value.Clean()` for sanitizing untrusted input (strips unknown properties)
- `Type.Partial()` for deriving update types (e.g., `TaskGraphNodeAttributesUpdate = Type.Partial(TaskGraphNodeAttributes)`)

> See [docs/research/typebox-patterns.md](../research/typebox-patterns.md) for the full analysis of TypeBox patterns evaluated and adoption/skip decisions.

## Input Schemas

### TaskInput

The universal input shape for a task, matching the Rust `TaskFrontmatter` field set. Note the use of `Type.Optional(Nullable(...))` for categorical fields — this makes the field itself optional at the object level AND nullable when present. YAML frontmatter distinguishes between "key absent" and "key set to null" (e.g., `risk:` with no value), so we need both.

```typescript
const TaskInput = Type.Object({
  id: Type.String(),
  name: Type.String(),
  dependsOn: Type.Array(Type.String()),
  status: Type.Optional(Nullable(TaskStatusEnum)),
  scope: Type.Optional(Nullable(TaskScopeEnum)),
  risk: Type.Optional(Nullable(TaskRiskEnum)),
  impact: Type.Optional(Nullable(TaskImpactEnum)),
  level: Type.Optional(Nullable(TaskLevelEnum)),
  priority: Type.Optional(Nullable(TaskPriorityEnum)),
  tags: Type.Optional(Type.Array(Type.String())),
  assignee: Type.Optional(Nullable(Type.String())),
  due: Type.Optional(Nullable(Type.String())),
  created: Type.Optional(Nullable(Type.String())),
  modified: Type.Optional(Nullable(Type.String())),
})
```

Where `Nullable = <T extends TSchema>(T: T) => Type.Union([T, Type.Null()])`.

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

```typescript
const TaskScopeEnum = Type.Union([
  Type.Literal("single"), Type.Literal("narrow"),
  Type.Literal("moderate"), Type.Literal("broad"), Type.Literal("system"),
])
type TaskScope = Static<typeof TaskScopeEnum>

const TaskRiskEnum = Type.Union([
  Type.Literal("trivial"), Type.Literal("low"),
  Type.Literal("medium"), Type.Literal("high"), Type.Literal("critical"),
])
type TaskRisk = Static<typeof TaskRiskEnum>

// ... same pattern for TaskImpact, TaskLevel, TaskPriority, TaskStatus
```

See the naming convention table in "Design Decision: TypeBox as Single Source of Truth" above for the `Enum` suffix rule.

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

The output of `resolveDefaults` — all categorical fields resolved to their numeric equivalents for use in analysis. Defined as a TypeBox schema (not a raw `interface`) so that `Static<typeof ResolvedTaskAttributes>` derives the TypeScript type:

```typescript
const ResolvedTaskAttributes = Type.Object({
  name: Type.String(),
  scope: TaskScopeEnum,                            // resolved from default
  risk: TaskRiskEnum,                              // resolved from default
  impact: TaskImpactEnum,                          // resolved from default
  level: Nullable(TaskLevelEnum),                  // nullable — label-only
  priority: Nullable(TaskPriorityEnum),             // nullable — label-only
  status: Nullable(TaskStatusEnum),                // nullable — label-only
  // Numeric equivalents (always present after resolution):
  costEstimate: Type.Number(),
  tokenEstimate: Type.Number(),
  successProbability: Type.Number(),
  riskWeight: Type.Number(),
  impactWeight: Type.Number(),
})
type ResolvedTaskAttributes = Static<typeof ResolvedTaskAttributes>
```

Where `Nullable` is a generic helper: `const Nullable = <T extends TSchema>(T: T) => Type.Union([T, Type.Null()])`

Note how categorical fields that have defaults (`scope`, `risk`, `impact`) are no longer optional — `resolveDefaults` fills them in. Label-only fields (`level`, `priority`, `status`) remain nullable since they have no meaningful default.

**Why `level`, `priority`, and `status` remain nullable**: These three fields are label-only enums with no numeric methods (see "Label-only enums" above). They are used for filtering and labeling, not for cost calculations. A task with `level: null` simply hasn't been categorized — the analysis functions don't need a numeric value for it. `risk`, `scope`, and `impact` are the only fields that feed into EV and risk calculations, so they're the only ones that need default resolution.

> **Note on `level`**: While the cost-benefit framework shows that "risk: critical at planning level > risk: critical at implementation level" (upstream failures multiply), this is captured by the DAG-propagation model's topology-aware cost computation, not by a numeric value on `level` itself. The `level` field serves as metadata for filtering and display, not as a cost input.

## Constraints

- **Nullable categorical fields are meaningful** — NULL means "not yet assessed," not "use default." The `resolveDefaults` helper makes this explicit. See [graph-model.md](graph-model.md) for the default mappings.
- **No Zod bridge** — Consumers with Zod in their stack can convert at their boundary. The library does not provide a Zod interop layer.
- **Enum values match DB and frontmatter conventions** — The string values are identical to the Rust `TaskFrontmatter` field values and the alkhub `pgEnum` definitions.