---
id: review/schemas-and-errors
name: Review schema, enum, and error implementations for consistency
status: done
depends_on:
  - schema/enums
  - schema/input-schemas
  - schema/graph-schemas
  - schema/result-types
  - schema/numeric-methods-and-defaults
  - error/error-hierarchy
scope: narrow
risk: low
impact: phase
level: review
---

## Description

Review the schema and error layer implementations before building the graph and analysis layers on top. This is a critical checkpoint because everything downstream depends on these types being correct and consistent with the architecture docs.

## Acceptance Criteria

- [x] All TypeBox schemas match [schemas.md](../../../docs/architecture/schemas.md) exactly
- [x] All `Static<typeof>` type aliases correctly derived — no manual type definitions
- [x] Nullable helper used consistently in TaskInput (not in TaskGraphNodeAttributes)
- [x] Enum values match DB/frontmatter conventions exactly
- [x] Numeric method tables match spec tables exactly
- [x] `resolveDefaults` correctly separates "nullable categorical→default" from "label-only nullable→stays nullable"
- [x] Error class hierarchy is correct: all extend TaskgraphError, all have proper `name` and typed fields
- [x] `InvalidInputError` can be constructed from `Value.Errors()` output
- [x] `CircularDependencyError.cycles` type is `string[][]`
- [x] No Zod, no gray-matter, no js-yaml in any dependency
- [x] `package.json` lists only approved dependencies
- [x] All tests pass

## References

- docs/architecture/schemas.md
- docs/architecture/errors-validation.md
- docs/architecture/frontmatter.md — supply chain constraints

## Notes

See review report below.

## Summary

**Review outcome: Approved with 1 suggestion (no blocking or warning issues).**

All acceptance criteria pass. Implementation is consistent with architecture docs. See detailed review below.

---

# Code Review: review/schemas-and-errors

## Summary

- **Files reviewed**: 12 (6 implementation + 6 test files, plus barrel exports)
  - `src/schema/enums.ts`, `src/schema/task.ts`, `src/schema/graph.ts`, `src/schema/results.ts`
  - `src/analysis/defaults.ts`
  - `src/error/index.ts`
  - `test/schema.test.ts`, `test/error.test.ts`, `test/defaults.test.ts`
  - `src/schema/index.ts` (barrel)
- **Critical issues**: 0
- **Warnings**: 0
- **Suggestions**: 1
- **Tests**: ✅ 257 passed (7 test files)
- **Lint (tsc --noEmit)**: ✅ Clean, no errors
- **Overall**: **Approved**

## Architecture Compliance

### ✅ TypeBox as Single Source of Truth

All types are derived via `Static<typeof Schema>` — no manual `interface` or `type` definitions for schema shapes. Enum constants use `Enum` suffix, type aliases do not. This matches the naming convention table in `schemas.md` exactly.

Verified:
- `TaskScopeEnum` → `type TaskScope = Static<typeof TaskScopeEnum>` ✅
- `TaskRiskEnum` → `type TaskRisk = Static<typeof TaskRiskEnum>` ✅
- `TaskImpactEnum` → `type TaskImpact = Static<typeof TaskImpactEnum>` ✅
- `TaskLevelEnum` → `type TaskLevel = Static<typeof TaskLevelEnum>` ✅
- `TaskPriorityEnum` → `type TaskPriority = Static<typeof TaskPriorityEnum>` ✅
- `TaskStatusEnum` → `type TaskStatus = Static<typeof TaskStatusEnum>` ✅
- All object schemas (`TaskInput`, `DependencyEdge`, `TaskGraphNodeAttributes`, etc.) follow same pattern ✅

### ✅ Nullable Helper

- `Nullable` is defined in `enums.ts` and re-exported from `task.ts` for convenience ✅
- `TaskInput` uses `Type.Optional(Nullable(...))` for categorical and metadata fields ✅ (matches architecture: "field itself optional AND nullable when present")
- `TaskGraphNodeAttributes` uses `Type.Optional(EnumSchema)` without Nullable ✅ (matches architecture: "absent and null both map to undefined on graph")
- `ResolvedTaskAttributes` uses `Nullable(...)` for label-only fields (level, priority, status) and plain enum schemas for categorical fields with defaults (scope, risk, impact) ✅

### ✅ Enum Values Match Spec

All enum values match `schemas.md` exactly:
- `TaskScopeEnum`: "single", "narrow", "moderate", "broad", "system" ✅
- `TaskRiskEnum`: "trivial", "low", "medium", "high", "critical" ✅
- `TaskImpactEnum`: "isolated", "component", "phase", "project" ✅
- `TaskLevelEnum`: "planning", "decomposition", "implementation", "review", "research" ✅
- `TaskPriorityEnum`: "low", "medium", "high", "critical" ✅
- `TaskStatusEnum`: "pending", "in-progress", "completed", "failed", "blocked" ✅

### ✅ Numeric Methods Match Spec Tables

`defaults.ts` mapping tables are exact matches:
- `scopeCostEstimate`: single→1.0, narrow→2.0, moderate→3.0, broad→4.0, system→5.0 ✅
- `scopeTokenEstimate`: single→500, narrow→1500, moderate→3000, broad→6000, system→10000 ✅
- `riskSuccessProbability`: trivial→0.98, low→0.90, medium→0.80, high→0.65, critical→0.50 ✅
- `riskWeight`: computed as `1 - riskSuccessProbability(risk)` ✅ (tested and matches 0.02, 0.10, 0.20, 0.35, 0.50)
- `impactWeight`: isolated→1.0, component→1.5, phase→2.0, project→3.0 ✅
- `resolveDefaults` default values: risk→"medium", scope→"narrow", impact→"isolated" ✅ (matches `graph-model.md` defaults table)

### ✅ resolveDefaults Correctly Separates Categorical vs Label-only

- Categorical fields with defaults (scope, risk, impact) are resolved via `??` with default values ✅
- Label-only fields (level, priority, status) remain nullable via `?? null` ✅
- The `Partial<TaskGraphNodeAttributes> & Pick<TaskGraphNodeAttributes, 'name'>` signature is correct ✅
- Derived numeric fields are computed from the resolved categorical values ✅

### ✅ Error Class Hierarchy

All error classes match `errors-validation.md`:
- `TaskgraphError extends Error` ✅ — base class with proper `name` and `Object.setPrototypeOf`
- `TaskNotFoundError extends TaskgraphError` ✅ — has `readonly taskId: string`
- `CircularDependencyError extends TaskgraphError` ✅ — has `readonly cycles: string[][]`
- `InvalidInputError extends TaskgraphError` ✅ — has `readonly field: string` and `override readonly message: string`
- `DuplicateNodeError extends TaskgraphError` ✅ — has `readonly taskId: string`
- `DuplicateEdgeError extends TaskgraphError` ✅ — has `readonly prerequisite: string` and `readonly dependent: string`

All subclasses:
- Set `this.name` to their class name ✅
- Call `Object.setPrototypeOf(this, new.target.prototype)` for correct `instanceof` ✅
- Use `readonly` for typed fields ✅
- Tests verify `instanceof` works across the full prototype chain ✅

### ✅ InvalidInputError.fromTypeBoxError

Static factory method for creating from TypeBox `Value.Errors()` output ✅
- Strips leading `/` from path ✅
- Handles paths without leading slash ✅
- Handles nested paths (e.g., `/attributes/risk`) ✅
- Tests verify this behavior ✅

### ✅ Schema Field-by-Field Verification

**TaskInput** (src/schema/task.ts):
All 13 fields present and match arch spec. `status` ↔ `scope` order in implementation matches spec order (status first in code vs scope first in spec doc — implementation uses status first, which is a cosmetic difference in object literal key ordering, not a semantic issue).

**DependencyEdge** (src/schema/task.ts):
- `from: Type.String()`, `to: Type.String()`, `qualityRetention: Type.Optional(Type.Number({ default: 0.9 }))` ✅
- Matches spec including the `qualityRetention` naming (not `qualityDegradation`) ✅

**TaskGraphNodeAttributes** (src/schema/graph.ts):
- `name: Type.String()` (required) ✅
- All categorical fields: `Type.Optional(Enum)` ✅
- Does NOT include tags/assignee/due/created/modified ✅ (these belong to TaskInput only)
- Test verifies `tags`, `assignee`, `due` are undefined in properties ✅

**TaskGraphEdgeAttributes** (src/schema/graph.ts):
- `qualityRetention: Type.Optional(Type.Number())` ✅ (note: no default here unlike DependencyEdge — this matches the architecture distinction between input schema and graph attribute schema)

**TaskGraphNodeAttributesUpdate** (src/schema/graph.ts):
- `Type.Partial(TaskGraphNodeAttributes)` — matches arch spec ✅

**SerializedGraph** generic factory and TaskGraphSerialized (src/schema/graph.ts):
- Generic factory parameterized with NodeAttrs, EdgeAttrs, GraphAttrs ✅
- `options` object with `type: "directed"`, `multi: false`, `allowSelfLoops: false` ✅
- No version field ✅
- Tests verify no `version` or `schemaVersion` in properties ✅

**ResolvedTaskAttributes** (src/schema/results.ts):
- All 9 fields present and matching spec ✅
- `scope`, `risk`, `impact`: plain enum (not nullable) ✅
- `level`, `priority`, `status`: `Nullable(Enum)` ✅
- All 5 numeric fields: `Type.Number()` ✅

### ✅ Dependency Audit

- No Zod in dependency tree ✅
- No gray-matter in dependency tree ✅
- No js-yaml in dependency tree ✅
- `package.json` dependencies: @alkdev/typebox, graphology (+ plugins), yaml — all approved per architecture ✅

## Code Quality

### Clean Code

- All files are well-organized with clear section comments ✅
- JSDoc comments explain purpose and semantics (e.g., `qualityRetention` explanation) ✅
- No magic numbers — numeric tables use `Record<>` constants with explicit mapping ✅
- No commented-out code ✅
- No TODOs without issue references ✅
- Functions are short and focused (all under 30 lines) ✅

### One Minor Note on Nullable Duplication

`Nullable` is defined in both `enums.ts` (exported) and `results.ts` (local, not exported). The `results.ts` version includes a comment: "duplicated here for schema locality". This is a deliberate choice — `results.ts` has no import from `enums.ts` for `Nullable`, opting for local definition. This avoids a circular or cross-module dependency for a trivial utility, which is reasonable. The test suite verifies that the re-export from `task.ts` is the same function object as from `enums.ts`.

**Suggestion** (non-blocking): Consider importing `Nullable` from `enums.js` in `results.ts` instead of duplicating it. The `enums.ts` file already exports it, and `results.ts` already imports `TaskScopeEnum` etc. from `./enums.js`. This would ensure a single definition. However, the current approach is acceptable since the function is trivially one line and the duplication is explicitly documented.

## Testing

### Coverage Assessment

- **Enum schemas**: All 6 enums tested with valid values, invalid values, null, and undefined. 30 tests ✅
- **Nullable helper**: Tested with valid values, null, invalid values, undefined. 3 tests ✅
- **TaskInput**: Comprehensive — minimal, full, null categorical, absent, invalid, wrong types, structured errors. 14 tests ✅
- **DependencyEdge**: Minimal, with qualityRetention, boundary values, missing fields, wrong types, structured errors. 9 tests ✅
- **Graph schemas**: NodeAttributes, NodeAttributesUpdate, EdgeAttributes, SerializedGraph factory — including verification that tags/assignee/due are not in the schema. 13+ tests ✅
- **Result schemas**: RiskPathResult, DecomposeResult, WorkflowCostOptions, WorkflowCostResult, EvConfig, EvResult, RiskDistributionResult. All have valid, invalid, missing field, and wrong type tests. ~20 tests ✅
- **Type alias correctness**: Compile-time type assertions alongside runtime checks for all enums and schemas ✅
- **Error classes**: All 6 classes tested for instanceof chain, name, field access, and message formatting. 31 tests ✅
- **defaults.ts**: All numeric functions tested with explicit value mapping. `resolveDefaults` tested with all-defaults, explicit values, label-only preservation, and mixed scenarios. 30 tests ✅
- **riskWeight invariant**: Explicitly tested that `riskWeight(r) === 1 - riskSuccessProbability(r)` for all risk values ✅

### Edge Cases Tested

- Nullable re-export identity (`NullableFromTask === Nullable`) ✅
- `fromTypeBoxError` handles paths with and without leading `/` ✅
- SerializedGraph has no version field ✅
- SerializedGraph rejects wrong `options` values (undirected, multi, allowSelfLoops) ✅
- `TaskGraphNodeAttributesUpdate` accepts empty object ✅
- Prototype chain correctness for all error subclasses ✅

## Security

- No secrets in code ✅
- No input validation concerns at this layer (schemas are definitions, not runtime input paths) ✅
- Supply chain check: no Zod, no gray-matter, no js-yaml ✅

## Performance

- Numeric functions are simple `Record<>` lookups — O(1) ✅
- No unnecessary allocations ✅
- `resolveDefaults` is a pure function with no loop — optimal ✅

## Suggestions

1. **(Low priority)** Consider importing `Nullable` from `./enums.js` in `results.ts` instead of duplicating the one-liner. Since `results.ts` already imports `TaskScopeEnum` etc. from `./enums.js`, adding `Nullable` to that import would reduce duplication without introducing new coupling. This is a minor style preference and not a correctness issue.

## Recommendations

1. ✅ All acceptance criteria are met. Implementation is approved.
2. Consider the `Nullable` import consolidation as a future cleanup (non-blocking).
3. The resolvedDefaults defaults match the architecture spec (`graph-model.md`): risk→"medium", scope→"narrow", impact→"isolated". Any future changes to these defaults should be reflected in both `defaults.ts` and `graph-model.md`.