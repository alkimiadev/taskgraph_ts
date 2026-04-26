# Research: TypeBox Patterns for TaskGraph Schema Design

**Date**: 2026-04-26
**Source**: @alkdev/typebox (0.x fork) documentation
**Purpose**: Evaluate TypeBox patterns for use in taskgraph_ts schema design, informing architecture decisions for enums, input validation, defaults, generics, and runtime operations.

---

## 1. `Static<typeof Schema>` Pattern

### How It Works

TypeBox schemas are JavaScript objects constructed at runtime via `Type.*` builder functions. Each builder returns a JSON Schema object with a TypeBox-specific type brand (e.g., `TObject`, `TString`, `TUnion`). The `Static<T>` mapped type takes the TypeBox internal type brand and resolves it to the equivalent TypeScript type.

```typescript
import { Type, type Static } from "@alkdev/typebox";

// Define a schema at runtime
const TaskStatusEnum = Type.Union([
  Type.Literal("pending"),
  Type.Literal("in-progress"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("blocked"),
]);

// Infer the TypeScript type from the schema
type TaskStatus = Static<typeof TaskStatusEnum>;
// Resolves to: "pending" | "in-progress" | "completed" | "failed" | "blocked"
```

### Key Points

- `Static<typeof X>` is the idiomatic way to derive types — **never define the type separately and the schema separately**.
- The `typeof` operator is required because TypeBox schemas are `const` declarations; `typeof` gives you the branded type, and `Static<>` resolves it.
- For objects, `Static<typeof Schema>` produces the full type with required/optional modifiers matching the JSON Schema `required` array.

### Naming Convention Recommendation

Our current convention is correct and should be maintained:

| Pattern | Example | Purpose |
|---------|---------|---------|
| Schema constant | `TaskStatusEnum` | Runtime value — the JSON Schema object |
| Type alias | `type TaskStatus = Static<typeof TaskStatusEnum>` | Compile-time type |
| Function signatures | Use `TaskStatus` | Never use the `Enum` suffix in signatures |

**Rule**: `Enum` suffix = schema constant (runtime); bare name = type alias (compile-time).

---

## 2. Value Namespace: Check, Assert, Cast, Default

### `Value.Check(schema, value) → boolean`

Returns `true` if the value conforms to the schema, `false` otherwise. Does not throw.

**Relevance**: This is our primary **input validation** mechanism. Whenever we need to validate frontmatter data, JSON imports, or API inputs, `Value.Check()` is the first gate. Returns a boolean, which lets us collect errors ourselves or proceed conditionally.

```typescript
// Input validation — check before constructing graph
if (!Value.Check(TaskInput, parsed)) {
  const errors = [...Value.Errors(TaskInput, parsed)];
  throw new InvalidInputError(errors);
}
```

### `Value.Assert(schema, value) → void`

Throws `AssertError` if the value doesn't conform. Equivalent to `if (!Value.Check(...)) throw`.

**Relevance**: Useful for **graph construction guards** — throwing immediately if input is invalid. However, for our library's error-handling pattern (which collects validation errors into structured `ValidationError[]`), `Value.Check()` + `Value.Errors()` is more appropriate since we need field-level detail, not just a thrown exception.

### `Value.Cast(schema, value) → unknown`

Upcast a value into a target type, retaining as much info as possible and filling missing properties with type defaults (0 for numbers, "" for strings, false for booleans, {} for objects, [] for arrays). Intended for **data migration** scenarios.

**Relevance**: **Skip for now.** `Cast` fills missing fields with zero-values, which is not what we want for our categorical enums. NULL/"not yet assessed" is semantically different from a zero-value. `Cast` would set `risk: ""` (empty string) for missing fields rather than leaving them absent. `Value.Default()` is the right tool for our use case.

### `Value.Default(schema, value) → unknown`

Fills missing properties using the `default` option annotations on the schema. Returns the modified value (mutable operation — clone first if needed).

**Relevance**: **Directly applicable.** This is exactly what our `resolveDefaults` function does manually. See section 8 for detailed analysis.

---

## 3. `Value.Convert()` — Transforming Frontmatter Input

### How It Works

`Value.Convert(schema, value)` attempts to coerce values into the schema's target types:

```typescript
const T = Type.Object({ x: Type.Number() });
Value.Convert(T, { x: "3.14" });    // { x: 3.14 } — string → number
Value.Convert(T, { x: "not a number" }); // { x: "not a number" } — no conversion if unreasonable
```

**Returns `unknown`** — the caller MUST check the result before using it, since conversion may fail silently.

### Relevance for Nullable Categorical Fields

**Limited usefulness.** Here's why:

1. **Our enums are string unions, not numeric types.** `Value.Convert` shines when coercing `"3.14"` → `3.14` (string → number). For string enums like `"pending" | "in-progress" | "completed"`, there's nothing to convert — they're already strings.

2. **YAML 1.2 already handles type coercion.** Our YAML parser (eemeli's `yaml` package) parses YAML 1.2, which is a superset of JSON. Boolean and number coercion from YAML happens at parse time. By the time TypeBox sees the data, the values are already the right JavaScript types (or they're wrong and need to be rejected, not coerced).

3. **The one scenario where it helps**: If frontmatter had numeric codes that should map to enum strings (e.g., `status: 0` → `status: "pending"`), `Convert` wouldn't help because it doesn't do lookup-table transformations. That's a `Transform` use case, not a `Convert` use case.

### Recommendation

**Skip `Value.Convert()` for now.** If we ever need value coercion (e.g., accepting `true`/`false` YAML booleans where we expect string enums), it would be more robust to define `Transform` types or handle it in the YAML parsing layer.

---

## 4. `Value.Pointer` — Accessing Nested Graph Data

### How It Works

`ValuePointer` provides mutable updates on values using RFC 6901 JSON Pointers:

```typescript
import { ValuePointer } from "@alkdev/typebox/value";

const A = { x: 0, y: 0, z: 0 };
ValuePointer.Set(A, "/x", 1);  // A' = { x: 1, y: 0, z: 0 }
ValuePointer.Set(A, "/y", 1);  // A' = { x: 1, y: 1, z: 0 }
```

**Operations**: `Get`, `Set`, `Delete`, `Has` — all using `/path/to/property` pointer strings.

### Relevance for TaskGraph

**Skip.** Here's why:

1. **graphology already provides attribute access.** `graph.getNodeAttribute(nodeId, 'risk')` and `graph.setNodeAttribute(nodeId, 'risk', 'high')` are the idiomatic way to read/write node attributes. ValuePointer adds a JSON Pointer abstraction layer on top of what graphology already does better.

2. **Our data lives in graphology, not in plain objects.** ValuePointer operates on plain JS objects. Graphology nodes store attributes internally — we'd need to serialize/extract them first to use ValuePointer, which defeats the purpose.

3. **No nested path access needed.** Our `TaskGraphNodeAttributes` is a flat object with no nesting beyond optional fields. JSON Pointer shines for deep paths like `/tasks/0/metadata/risk`, but our attributes are `/{taskId}/risk`.

### If we ever need this

If we add deeply nested configuration objects (e.g., plugin configs), ValuePointer could be useful for patch operations. Not needed now.

---

## 5. Template Literal Types

### How They Work

TypeBox supports `Type.TemplateLiteral(...)` which creates a template literal type analogous to TypeScript's `` `prefix${A|B|C}` ``:

```typescript
const K = Type.TemplateLiteral("prop${A|B|C}");
// TypeScript: 'propA' | 'propB' | 'propC'

const R = Type.Record(K, Type.String());
// TypeScript: { propA: string; propB: string; propC: string }
```

These encode as regular expressions in JSON Schema (`pattern: '^prop(A|B|C)$'`).

### Relevance for Our Enum Definitions

**Skip for enums.** Our enums are finite, fixed sets of string literals. `Type.Union(Type.Literal(...))` is more explicit and self-documenting for this case. Template literals are designed for **generative** types — combinatorial explosion of string patterns like event names (`on${Action}`) — not finite enumerated sets.

**Potential future use**: If we ever define event names or hook patterns (e.g., `"on:${TaskStatus}"` for reactive graph events), template literals would be the right tool. Not needed now.

### The `Type.Enum([...])` Alternative

TypeBox also supports `Type.Enum([...])` which takes a string array:

```typescript
const T = Type.Enum(['A', 'B', 'C']);
// TypeScript: type T = 'A' | 'B' | 'C'
// JSON Schema: { enum: ['A', 'B', 'C'] }
```

This is more concise than our current `Type.Union([Type.Literal(...)])` pattern. However, there's a trade-off:

| Approach | JSON Schema Output | Pros | Cons |
|----------|-------------------|------|------|
| `Type.Union([Type.Literal(...)])` | `{ anyOf: [{ const: 'pending' }, ...] }` | Explicit, composable, IDE-friendly autocompletion | Verbose |
| `Type.Enum(FooEnum)` (TS enum) | `{ anyOf: [{ const: 0, type: 'number' }, ...] }` | Leverages existing TS enums | Only works with TS `enum`, not string unions |
| `Type.Enum(['A','B','C'])` (string array) | `{ enum: ['A', 'B', 'C'] }` | Concise, standard JSON Schema `enum` | Less compositional flexibility |

### Recommendation

**Keep `Type.Union([Type.Literal(...)])` for our enums.** Reasons:

1. **Composability**: Our enums appear in `Type.Optional(TaskStatusEnum)` and other compositions. Union-of-literals composes cleanly with `Type.Optional`, `Type.Union([..., Type.Null()])`, etc.
2. **Consistency**: All TypeBox examples and best practices use this pattern.
3. **JSON Schema portability**: The `anyOf` + `const` output is well-supported by all JSON Schema validators. The `enum` keyword has subtle behavioral differences across validators.
4. **Future flexibility**: If we need to add numeric mappings or Transform types, the literal-based pattern extends naturally.

---

## 6. Generic Types — Parameterizing SerializedGraph

### How Generics Work in TypeBox

TypeBox generics are JavaScript functions that accept `TSchema` parameters and return composed schemas:

```typescript
const Nullable = <T extends TSchema>(T: T) => {
  return Type.Union([T, Type.Null()]);
};

const T = Nullable(Type.String()); // type T = string | null
```

### Application to SerializedGraph

The graphology native JSON format has this structure:

```typescript
{
  attributes: { ... },      // graph-level attributes
  options: { ... },          // graph options
  nodes: [{ key: "...", attributes: { ... } }],
  edges: [{ key: "...", source: "...", target: "...", attributes: { ... } }]
}
```

We can parameterize this with generic functions:

```typescript
import { Type, type Static, type TSchema } from "@alkdev/typebox";

const SerializedGraph = <N extends TSchema, E extends TSchema, G extends TSchema>(
  NodeAttrs: N,
  EdgeAttrs: E,
  GraphAttrs: G
) =>
  Type.Object({
    attributes: GraphAttrs,
    options: Type.Object({
      type: Type.Literal("directed"),
      multi: Type.Literal(false),
      allowSelfLoops: Type.Literal(false),
    }),
    nodes: Type.Array(
      Type.Object({
        key: Type.String(),
        attributes: NodeAttrs,
      })
    ),
    edges: Type.Array(
      Type.Object({
        key: Type.String(),
        source: Type.String(),
        target: Type.String(),
        attributes: EdgeAttrs,
      })
    ),
  });

// Usage:
const TaskGraphSerialized = SerializedGraph(
  TaskGraphNodeAttributes,
  TaskGraphEdgeAttributes,
  Type.Object({})  // empty graph-level attributes
);

type TaskGraphSerialized = Static<typeof TaskGraphSerialized>;
```

### Key Benefit

This gives us **type-safe serialization** with zero duplication. The node/edge attribute types flow through the generic, so `Static<typeof TaskGraphSerialized>` automatically includes the correct attribute types.

### Naming Convention for Generic Schema Functions

Use **PascalCase** (matching TypeBox's `Type.*` convention) and make them clearly generic by the parameter names:

```typescript
// Good — clearly a factory function, PascalCase matching TypeBox convention
const SerializedGraph = <N extends TSchema, E extends TSchema, G extends TSchema>(...) => ...

// Good — utility generic
const Nullable = <T extends TSchema>(T: T) => Type.Union([T, Type.Null()]);
```

---

## 7. `Type.Union(Type.Literal(...))` vs. Alternatives for Enums

### Current Pattern (Adopt This)

```typescript
const TaskStatusEnum = Type.Union([
  Type.Literal("pending"),
  Type.Literal("in-progress"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("blocked"),
]);
type TaskStatus = Static<typeof TaskStatusEnum>;
// type TaskStatus = "pending" | "in-progress" | "completed" | "failed" | "blocked"
```

This is the **idiomatic TypeBox approach** for string literal unions. It:

- Produces correct JSON Schema (`anyOf` + `const` per value)
- Infers correctly to TypeScript union types
- Composes well with `Type.Optional()`, `Type.Union([..., Type.Null()])`, etc.
- Is fully understood by JSON Schema validators (Ajv, typecompiler)

### Why Not `Type.Enum()`?

`Type.Enum()` requires a TypeScript `enum` declaration (numeric enums produce `{ anyOf: [{ type: 'number', const: 0 }, ...] }`), or a string array (produces `{ enum: [...] }`). The string array form is concise but:
- Doesn't compose as well with `Type.Optional()` and `Type.Union`
- The `enum` JSON Schema keyword has different validation semantics in some edge cases
- Our existing pattern is already idiomatic

### Why Not `Type.Const()`?

`Type.Const()` creates literal types from values, but it's designed for single-value inference, not enum sets. It would require extra steps to extract just the union type.

### Why Not Template Literals?

Template literals are for pattern-based types (`prop${A|B|C}`), not finite enumerated sets. Overkill and less readable.

### Recommendation

**Stick with `Type.Union([Type.Literal(...)])`.** This is the consensus best practice in the TypeBox ecosystem for string-based categorical enums.

---

## 8. Default Values — `Type.Default()` and `{ default: ... }` Option

### How `{ default: ... }` Works

Any TypeBox type accepts a `default` option in its options bag:

```typescript
const T = Type.Object({
  x: Type.Number({ default: 0 }),
  y: Type.Number({ default: 0 }),
});
```

This adds a `default` key to the JSON Schema for that property:

```json
{
  "type": "object",
  "properties": {
    "x": { "type": "number", "default": 0 },
    "y": { "type": "number", "default": 0 }
  },
  "required": ["x", "y"]
}
```

### How `Value.Default()` Works

`Value.Default(schema, value)` fills in missing properties using the `default` annotations:

```typescript
const Y = Value.Default(T, {});            // { x: 0, y: 0 } — both defaults applied
const Z = Value.Default(T, { x: 1 });      // { x: 1, y: 0 } — only y defaulted
const X = Value.Default(T, null);          // null — non-enumerable, returns null
```

**Important caveats**:
- Returns `unknown` — must be checked with `Value.Check()` afterward
- **Mutable operation** — modifies the input value. Clone first if immutability matters.
- Does NOT validate — only fills defaults. Must validate separately.

### How `Value.Create()` Works

`Value.Create(schema)` creates a fresh value from a schema, using defaults:

```typescript
const T = Type.Object({ x: Type.Number(), y: Type.Number({ default: 42 }) });
const A = Value.Create(T);  // { x: 0, y: 42 }
```

### Applying to Our `resolveDefaults` Logic

Currently our architecture defines `resolveDefaults(attrs: Partial<TaskGraphNodeAttributes>): ResolvedTaskAttributes` as a manual function. With `Value.Default()`, we can define defaults directly in the schema:

```typescript
const TaskGraphNodeAttributes = Type.Object({
  name: Type.String(),
  scope: Type.Optional(TaskScopeEnum),
  risk: Type.Optional(TaskRiskEnum),
  impact: Type.Optional(TaskImpactEnum),
  level: Type.Optional(TaskLevelEnum),
  priority: Type.Optional(TaskPriorityEnum),
  status: Type.Optional(TaskStatusEnum),
});

// A separate "resolved" schema with defaults for the numeric analysis:
const ResolvedTaskAttributes = Type.Object({
  name: Type.String(),
  scope: TaskScopeEnum,                      // no longer optional
  risk: TaskRiskEnum,                         // no longer optional
  impact: TaskImpactEnum,                     // no longer optional
  level: Type.Union([TaskLevelEnum, Type.Null()]), // nullable
  priority: Type.Union([TaskPriorityEnum, Type.Null()]),
  status: Type.Union([TaskStatusEnum, Type.Null()]),
  costEstimate: Type.Number(),                // derived
  tokenEstimate: Type.Number(),               // derived
  successProbability: Type.Number(),          // derived
  riskWeight: Type.Number(),                  // derived
  impactWeight: Type.Number(),                 // derived
});
```

**However**, there's a fundamental mismatch:

1. **Our defaults are not simple value defaults.** `resolveDefaults` doesn't just fill in `scope: "narrow"` when `scope` is missing — it also *computes* `costEstimate: 2.0` from the resolved scope. `Value.Default()` can only fill in static default values, not compute derived values.

2. **The categorical fields themselves don't have simple defaults in the schema.** Our design explicitly treats NULL as "not yet assessed" — different from a real value. Adding `{ default: "narrow" }` to `scope` would conflate "missing" with "narrow" at the schema level, which breaks our semantic distinction.

3. **`Value.Default()` returns `unknown` and is mutable**, requiring post-default validation.

### Recommendation: Hybrid Approach

Use `Value.Default()` for **simple value defaults** on result types where there's no semantic distinction between "missing" and "default":

```typescript
// Good use of Value.Default — on resolved/derived types where defaults make sense
const EvConfig = Type.Object({
  retries: Type.Optional(Type.Number({ default: 0 })),
  fallbackCost: Type.Optional(Type.Number({ default: 0 })),
  timeLost: Type.Optional(Type.Number({ default: 0 })),
  valueRate: Type.Optional(Type.Number({ default: 0 })),
});
```

**Do NOT use `Value.Default()` on input schemas** (`TaskInput`, `TaskGraphNodeAttributes`) where NULL ≠ default value:

```typescript
// BAD — would conflate "not assessed" with "medium"
const TaskGraphNodeAttributes = Type.Object({
  risk: Type.Optional(Type.Union([TaskRiskEnum, Type.Null()])),  // correct: nullable
  // risk: TaskRiskEnum({ default: "medium" }),  // WRONG: loses "not assessed" semantic
});
```

Keep `resolveDefaults()` as a **separate function** that handles the logic of:
1. Filling in categorical defaults (risk → medium, scope → narrow, impact → isolated)
2. Computing derived numeric values (scope → costEstimate, risk → successProbability, etc.)

This function can internally use `Value.Default()` for the simple cases while handling the derived computations separately.

---

## 9. Additional Patterns Worth Adopting

### `Value.Parse()` — Full Pipeline

`Value.Parse(schema, value)` runs the full pipeline: `Clone → Clean → Default → Convert → Assert → Decode`. This is the "just make it work" function for input processing.

**Relevance**: Could replace our manual validation + sanitization pipeline in `parseFrontmatter`:

```typescript
// Instead of:
//   const parsed = yaml.parse(frontmatter);
//   Value.Assert(TaskInput, parsed);

// Consider:
const taskInput = Value.Parse(TaskInput, yaml.parse(frontmatter));
// This clones, cleans extra properties, fills defaults, converts types, asserts validity, and decodes transforms.
```

**However**, we need to be deliberate about which steps we want:
- `Clone`: Safe, but unnecessary if we're not mutating
- `Clean`: Strips extra properties — useful for safety
- `Default`: Fills defaults — see caveats above
- `Convert`: Type coercion — we may not want this for strict enum validation
- `Assert`: Throws on invalid — we want structured errors, not throws
- `Decode`: Runs transforms — only if we have Transform types

**Recommendation**: Use `Value.Parse` with a **custom pipeline** `[Clean, Assert]` to strip extra properties and validate. Don't use the full default pipeline since we don't want auto-conversion of enum values:

```typescript
// Strips unknown properties and validates
const cleaned = Value.Parse(["Clean", "Assert"], TaskInput, data);
```

### `Value.Errors()` — Structured Error Details

```typescript
const R = [...Value.Errors(T, { x: "42" })];
// [{ schema: { type: 'number' }, path: '/x', value: '42', message: 'Expected number' }]
```

**Relevance**: This is exactly what we need for our `InvalidInputError` with field-level details. Use this instead of `Value.Assert()` inside `parseFrontmatter` and `TaskGraph.fromTasks()`:

```typescript
function validateTaskInput(data: unknown): TaskInput {
  const errors = [...Value.Errors(TaskInput, data)];
  if (errors.length > 0) {
    throw new InvalidInputError(errors.map(e => ({
      path: e.path,
      message: e.message,
      value: e.value,
    })));
  }
  return data as TaskInput;
}
```

### `Value.Clean()` — Stripping Extra Properties

```typescript
const Z = Value.Clean(T, { x: 1, y: 2, z: 3 });  // { x: 1, y: 2 } — z removed
```

**Relevance**: Useful for sanitizing frontmatter data where users may have extra YAML keys that aren't in our schema. Prevents unexpected data from flowing through the system.

### `Value.Clone()` — Defensive Copies

`Value.Clone(value)` performs a deep clone. Useful before `Value.Default()` since that function mutates its input.

### `Type.Partial()` and `Type.Required()`

```typescript
const PartialTaskAttributes = Type.Partial(TaskGraphNodeAttributes);
// All fields become optional

const RequiredTaskAttributes = Type.Required(PartialTaskAttributes);
// All fields become required again
```

**Relevance**: Could be useful for defining `Partial<TaskGraphNodeAttributes>` for our `updateTask(id, attributes: Partial<...>)` method signature. Instead of a separate manual type, we can derive it from the full schema:

```typescript
// Instead of manually defining the partial type
const TaskGraphNodeAttributesUpdate = Type.Partial(TaskGraphNodeAttributes);
type TaskGraphNodeAttributesUpdate = Static<typeof TaskGraphNodeAttributesUpdate>;
```

### `Type.Pick()` and `Type.Omit()`

```typescript
const TaskCoreAttrs = Type.Pick(TaskGraphNodeAttributes, ['name', 'status']);
const TaskNonNumericAttrs = Type.Omit(ResolvedTaskAttributes, ['costEstimate', 'successProbability', 'riskWeight', 'impactWeight']);
```

**Relevance**: Useful for deriving focused sub-schemas from the main schema rather than re-declaring them.

### `Type.Module()` — Namespace for Recursive/Cross-Referencing Types

```typescript
const Module = Type.Module({
  PartialUser: Type.Partial(Type.Ref("User")),
  User: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String(),
  }),
});
const User = Module.Import("User");
type User = Static<typeof User>;
```

**Relevance**: **Consider for future use** if we need recursive types or cross-referencing schemas. Currently not needed — our schemas are flat and don't reference each other. But if we add `Type.Ref()` patterns for forward references in complex schemas, Module is the way to do it.

---

## 10. `Transform` Types — Decode/Encode

### How They Work

`Type.Transform()` creates types with separate decode and encode functions:

```typescript
const T = Type.Transform(Type.Number())
  .Decode((value) => new Date(value))    // number → Date (decode from wire)
  .Encode((value) => value.getTime());   // Date → number (encode to wire)

const D = Value.Decode(T, 0);  // Date(1970-01-01)
const E = Value.Encode(T, D); // 0

type DecodeType = StaticDecode<typeof T>;  // Date
type EncodeType = StaticEncode<typeof T>;  // number
```

### Relevance

**Potential future use for frontmatter parsing.** If we ever need to:
- Convert string dates (`"2026-04-26"`) to/from `Date` objects
- Transform numeric risk codes to string enums at the boundary
- Handle any wire-format ↔ internal-format divergence

Transform types handle this elegantly at the schema level, keeping decode/encode logic co-located with the type definition.

**Skip for now.** Our current string enum values are identical on wire and in memory. Date handling for `due`/`created`/`modified` fields could benefit from Transform, but those fields are currently `Type.String()` — we'd add Transform only if we switch to `Date` internally.

---

## 11. Summary: Pattern Adoption Guide

### ✅ Adopt Directly

| Pattern | Use Case | How |
|---------|----------|-----|
| `Static<typeof Schema>` | All type derivations | Already using; ensure no manual type duplication |
| `Value.Check()` | Input validation | Replace any ad-hoc validation |
| `Value.Errors()` | Structured error reporting | Use in `parseFrontmatter` and graph construction |
| `Value.Clean()` | Strip unknown properties | Sanitize frontmatter input |
| `Type.Partial()` | Derive update types from full schemas | `TaskGraphNodeAttributesUpdate` |
| `Type.Pick()` / `Type.Omit()` | Derive focused sub-types | Core attrs, non-numeric attrs |
| Generic schema functions | `SerializedGraph<N, E, G>` | Parameterized schema factory |
| `Type.Union([Type.Literal(...)])` | Enum definitions | Already using; keep this pattern |
| `{ default: value }` option | Simple defaults on result/config schemas | `EvConfig` defaults |
| Naming convention (`Enum` suffix) | Schema constants vs type aliases | `TaskStatusEnum` → `TaskStatus` |

### ⏳ Consider for Future

| Pattern | When to Adopt | Why Wait |
|---------|---------------|----------|
| `Transform` types | Date fields, wire-format encoding | Not needed until we have format divergence |
| `Type.Module()` | Cross-referencing or recursive schemas | Our schemas are flat; add when complexity warrants |
| `Value.Parse()` custom pipeline | Comprehensive input processing | Need to carefully select which steps to include |
| `Type.Optional()` modifier | Making specific fields optional in composed schemas | Using `Type.Optional()` already on input schemas |
| Template Literal types | Event name patterns (`on:${Action}`) | Only if we add reactive event types |

### ❌ Skip

| Pattern | Why Skip |
|---------|----------|
| `Value.Convert()` | Our enums are strings; YAML parser handles coercion; no numeric→enum conversion needed |
| `Value.Cast()` | Fills missing fields with zero-values (not semantically correct for "not assessed"); `resolveDefaults()` handles our case better |
| `Value.Default()` on input schemas | Conflates NULL/missing with default values; our design treats them differently |
| `Value.Pointer` | graphology provides attribute access; our data is flat, not deeply nested |
| `Type.Enum()` for string enums | Less compositional; `Type.Union([Type.Literal(...)])` is the established pattern |
| Template Literal types for finite enums | Overkill; less readable for fixed enum sets |
| `Type.Const()` for enums | Designed for single-value inference, not enum sets |

---

## 12. Concrete Schema Definitions

Based on the analysis above, here are the recommended concrete implementations:

### Enum Definitions

```typescript
import { Type, type Static } from "@alkdev/typebox";

// --- Enum schemas (runtime) and type aliases (compile-time) ---

const TaskScopeEnum = Type.Union([
  Type.Literal("single"),
  Type.Literal("narrow"),
  Type.Literal("moderate"),
  Type.Literal("broad"),
  Type.Literal("system"),
]);
type TaskScope = Static<typeof TaskScopeEnum>;

const TaskRiskEnum = Type.Union([
  Type.Literal("trivial"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("critical"),
]);
type TaskRisk = Static<typeof TaskRiskEnum>;

const TaskImpactEnum = Type.Union([
  Type.Literal("isolated"),
  Type.Literal("component"),
  Type.Literal("phase"),
  Type.Literal("project"),
]);
type TaskImpact = Static<typeof TaskImpactEnum>;

const TaskLevelEnum = Type.Union([
  Type.Literal("planning"),
  Type.Literal("decomposition"),
  Type.Literal("implementation"),
  Type.Literal("review"),
  Type.Literal("research"),
]);
type TaskLevel = Static<typeof TaskLevelEnum>;

const TaskPriorityEnum = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("critical"),
]);
type TaskPriority = Static<typeof TaskPriorityEnum>;

const TaskStatusEnum = Type.Union([
  Type.Literal("pending"),
  Type.Literal("in-progress"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("blocked"),
]);
type TaskStatus = Static<typeof TaskStatusEnum>;
```

### Nullable Helper

```typescript
const Nullable = <T extends TSchema>(T: T) => Type.Union([T, Type.Null()]);
```

### Input Schema

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
});
type TaskInput = Static<typeof TaskInput>;
```

> **Note on `Type.Optional(Nullable(...))`**: This makes the field itself optional at the object level AND nullable when present. Without `Nullable`, a field like `risk: Type.Optional(TaskRiskEnum)` would accept `undefined` (missing) but not `null` (explicitly set to null). Since YAML frontmatter distinguishes between "key absent" and "key set to null", we need both. Alternatively, we could use `Type.Optional(TaskRiskEnum)` alone if we normalize `null` → `undefined` at the YAML parsing layer.

### Graph Attribute Schemas

```typescript
const TaskGraphNodeAttributes = Type.Object({
  name: Type.String(),
  scope: Type.Optional(TaskScopeEnum),   // NULL = not stored on graph
  risk: Type.Optional(TaskRiskEnum),
  impact: Type.Optional(TaskImpactEnum),
  level: Type.Optional(TaskLevelEnum),
  priority: Type.Optional(TaskPriorityEnum),
  status: Type.Optional(TaskStatusEnum),
});
type TaskGraphNodeAttributes = Static<typeof TaskGraphNodeAttributes>;

// For update operations — all fields optional
const TaskGraphNodeAttributesUpdate = Type.Partial(TaskGraphNodeAttributes);
type TaskGraphNodeAttributesUpdate = Static<typeof TaskGraphNodeAttributesUpdate>;

const TaskGraphEdgeAttributes = Type.Object({
  qualityRetention: Type.Optional(Type.Number()),
});
type TaskGraphEdgeAttributes = Static<typeof TaskGraphEdgeAttributes>;
```

### Resolved Attributes Schema

```typescript
const ResolvedTaskAttributes = Type.Object({
  name: Type.String(),
  scope: TaskScopeEnum,                            // resolved from default
  risk: TaskRiskEnum,                              // resolved from default
  impact: TaskImpactEnum,                          // resolved from default
  level: Nullable(TaskLevelEnum),                   // nullable — label-only
  priority: Nullable(TaskPriorityEnum),             // nullable — label-only
  status: Nullable(TaskStatusEnum),                 // nullable — label-only
  costEstimate: Type.Number(),                      // derived from scope
  tokenEstimate: Type.Number(),                     // derived from scope
  successProbability: Type.Number(),                 // derived from risk
  riskWeight: Type.Number(),                        // derived from risk
  impactWeight: Type.Number(),                      // derived from impact
});
type ResolvedTaskAttributes = Static<typeof ResolvedTaskAttributes>;
```

### SerializedGraph Generic

```typescript
import { type TSchema } from "@alkdev/typebox";

const SerializedGraph = <N extends TSchema, E extends TSchema, G extends TSchema>(
  NodeAttrs: N,
  EdgeAttrs: E,
  GraphAttrs: G,
) =>
  Type.Object({
    attributes: GraphAttrs,
    options: Type.Object({
      type: Type.Literal("directed"),
      multi: Type.Literal(false),
      allowSelfLoops: Type.Literal(false),
    }),
    nodes: Type.Array(
      Type.Object({
        key: Type.String(),
        attributes: NodeAttrs,
      })
    ),
    edges: Type.Array(
      Type.Object({
        key: Type.String(),
        source: Type.String(),
        target: Type.String(),
        attributes: EdgeAttrs,
      })
    ),
  });

const TaskGraphSerialized = SerializedGraph(
  TaskGraphNodeAttributes,
  TaskGraphEdgeAttributes,
  Type.Object({}),
);
type TaskGraphSerialized = Static<typeof TaskGraphSerialized>;
```

### Result Types

```typescript
const RiskPathResult = Type.Object({
  path: Type.Array(Type.String()),
  totalRisk: Type.Number(),
});
type RiskPathResult = Static<typeof RiskPathResult>;

const DecomposeResult = Type.Object({
  shouldDecompose: Type.Boolean(),
  reasons: Type.Array(Type.String()),
});
type DecomposeResult = Static<typeof DecomposeResult>;

const WorkflowCostOptions = Type.Object({
  includeCompleted: Type.Optional(Type.Boolean({ default: false })),
  limit: Type.Optional(Type.Number()),
  propagationMode: Type.Optional(
    Type.Union([Type.Literal("independent"), Type.Literal("dag-propagate")])
  ),
  defaultQualityRetention: Type.Optional(Type.Number({ default: 0.9 })),
});
type WorkflowCostOptions = Static<typeof WorkflowCostOptions>;

const EvConfig = Type.Object({
  retries: Type.Optional(Type.Number({ default: 0 })),
  fallbackCost: Type.Optional(Type.Number({ default: 0 })),
  timeLost: Type.Optional(Type.Number({ default: 0 })),
  valueRate: Type.Optional(Type.Number({ default: 0 })),
});
type EvConfig = Static<typeof EvConfig>;

const EvResult = Type.Object({
  ev: Type.Number(),
  pSuccess: Type.Number(),
  expectedRetries: Type.Number(),
});
type EvResult = Static<typeof EvResult>;

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
});
type WorkflowCostResult = Static<typeof WorkflowCostResult>;

const RiskDistributionResult = Type.Object({
  trivial: Type.Array(Type.String()),
  low: Type.Array(Type.String()),
  medium: Type.Array(Type.String()),
  high: Type.Array(Type.String()),
  critical: Type.Array(Type.String()),
  unspecified: Type.Array(Type.String()),
});
type RiskDistributionResult = Static<typeof RiskDistributionResult>;

const DependencyEdge = Type.Object({
  from: Type.String(),
  to: Type.String(),
  qualityRetention: Type.Optional(Type.Number({ default: 0.9 })),
});
type DependencyEdge = Static<typeof DependencyEdge>;
```

### Validation Pipeline

```typescript
import { Value } from "@alkdev/typebox/value";

function validateTaskInput(data: unknown): TaskInput {
  // Clean strips unknown properties, Assert validates and throws
  // Using Check + Errors for structured error handling
  const errors = [...Value.Errors(TaskInput, data)];
  if (errors.length > 0) {
    throw new InvalidInputError(
      errors.map(e => ({
        path: e.path,
        message: e.message,
        value: e.value,
      }))
    );
  }
  return data as TaskInput;
}

// For graph import validation:
function validateSerializedGraph(data: unknown): TaskGraphSerialized {
  // Clean first, then validate — strips extra props from unknown JSON sources
  const cleaned = Value.Clean(TaskGraphSerialized, data);
  const errors = [...Value.Errors(TaskGraphSerialized, cleaned)];
  if (errors.length > 0) {
    throw new InvalidInputError(
      errors.map(e => ({
        path: e.path,
        message: e.message,
        value: e.value,
      }))
    );
  }
  return cleaned as TaskGraphSerialized;
}
```

---

## 13. Naming Convention Summary

| Category | Convention | Example |
|----------|-----------|---------|
| Enum schema constant | PascalCase + `Enum` suffix | `TaskStatusEnum` |
| Enum type alias | PascalCase, no suffix | `type TaskStatus` |
| Object schema constant | PascalCase, no suffix | `TaskInput`, `ResolvedTaskAttributes` |
| Object type alias | Same as schema constant | `type TaskInput = Static<typeof TaskInput>` |
| Generic schema factory | PascalCase, same as type | `SerializedGraph` |
| Nullable helper | PascalCase function | `Nullable` |
| Value namespace import | `import { Value } from "@alkdev/typebox/value"` | — |
| Type namespace import | `import { Type, type Static } from "@alkdev/typebox"` | — |

**Rule of thumb**: If a schema constant and its type alias have the same name (which is typical for object schemas), the type alias shadows the `const` in type position. TypeScript resolves `TaskInput` as a type in type position and as a value in value position — this is safe and idiomatic.

---

## 14. Key Takeaways

1. **`Type.Union([Type.Literal(...)])` is the right pattern for our enums** — idiomatic, composable, well-supported.
2. **`Value.Check()` + `Value.Errors()` is our validation backbone** — prefer over `Assert()` for structured error reporting.
3. **`Value.Default()` is useful only for simple defaults on result/config types** — not for input schemas where NULL ≠ default.
4. **`resolveDefaults()` is still needed** — it handles derived numeric computation, which `Value.Default()` cannot do.
5. **Generic schema factories (`SerializedGraph<N, E, G>`) enable DRY type-safe schemas** — parameterize once, reuse everywhere.
6. **`Value.Clean()` is useful for sanitizing unknown input** — strips extra properties before validation.
7. **`Value.Convert()` and `Value.Pointer()` are not needed** — our data model doesn't benefit from them.
8. **Template Literals and `Type.Enum()` are not the right fit** — our enums are finite string unions, best expressed as `Type.Union([Type.Literal(...)])`.
9. **Consider `Transform` types only if we add date or format boundaries** — currently our data is string-identical on wire and in memory.
10. **`Type.Partial()`, `Type.Pick()`, `Type.Omit()` should be used to derive sub-schemas** — eliminate manual duplication of focused sub-types.

---

## References

- @alkdev/typebox docs: `/workspace/@alkdev/typebox/docs/`
  - [usage.md](file:///workspace/@alkdev/typebox/docs/usage.md) — Static<typeof> pattern
  - [types/generics.md](file:///workspace/@alkdev/typebox/docs/types/generics.md) — Generic type factories
  - [types/options.md](file:///workspace/@alkdev/typebox/docs/types/options.md) — Schema options including `{ default }`
  - [types/properties.md](file:///workspace/@alkdev/typebox/docs/types/properties.md) — Readonly, Optional modifiers
  - [types/template-literal.md](file:///workspace/@alkdev/typebox/docs/types/template-literal.md) — Template literal types
  - [types/modules.md](file:///workspace/@alkdev/typebox/docs/types/modules.md) — Module/namespace types
  - [types/json.md](file:///workspace/@alkdev/typebox/docs/types/json.md) — Full JSON type reference
  - [types/transform.md](file:///workspace/@alkdev/typebox/docs/types/transform.md) — Transform/Decode/Encode
  - [types/indexed.md](file:///workspace/@alkdev/typebox/docs/types/indexed.md) — Indexed access types
  - [types/mapped.md](file:///workspace/@alkdev/typebox/docs/types/mapped.md) — Mapped types
  - [types/conditional.md](file:///workspace/@alkdev/typebox/docs/types/conditional.md) — Conditional types
  - [values/check.md](file:///workspace/@alkdev/typebox/docs/values/check.md) — Value.Check
  - [values/assert.md](file:///workspace/@alkdev/typebox/docs/values/assert.md) — Value.Assert
  - [values/convert.md](file:///workspace/@alkdev/typebox/docs/values/convert.md) — Value.Convert
  - [values/default.md](file:///workspace/@alkdev/typebox/docs/values/default.md) — Value.Default
  - [values/cast.md](file:///workspace/@alkdev/typebox/docs/values/cast.md) — Value.Cast
  - [values/pointer.md](file:///workspace/@alkdev/typebox/docs/values/pointer.md) — ValuePointer
  - [values/create.md](file:///workspace/@alkdev/typebox/docs/values/create.md) — Value.Create
  - [values/clean.md](file:///workspace/@alkdev/typebox/docs/values/clean.md) — Value.Clean
  - [values/parse.md](file:///workspace/@alkdev/typebox/docs/values/parse.md) — Value.Parse pipeline
  - [values/errors.md](file:///workspace/@alkdev/typebox/docs/values/errors.md) — Value.Errors
  - [values/mutate.md](file:///workspace/@alkdev/typebox/docs/values/mutate.md) — Value.Mutate
  - [values/clone.md](file:///workspace/@alkdev/typebox/docs/values/clone.md) — Value.Clone
- TaskGraph architecture: `/workspace/@alkdev/taskgraph_ts/docs/architecture/schemas.md`
- TaskGraph API: `/workspace/@alkdev/taskgraph_ts/docs/architecture/api-surface.md`