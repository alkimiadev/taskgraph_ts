---
id: schema/input-schemas
name: Define TaskInput, DependencyEdge, and Nullable helper
status: completed
depends_on:
  - schema/enums
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Define the `TaskInput` and `DependencyEdge` input schemas in `src/schema/task.ts`, plus the `Nullable` generic helper. `TaskInput` uses `Type.Optional(Nullable(...))` for categorical fields to support both absent and explicitly-null values (YAML frontmatter distinction).

## Acceptance Criteria

- [x] `src/schema/task.ts` exports `Nullable` helper: `const Nullable = <T extends TSchema>(T: T) => Type.Union([T, Type.Null()])` — Re-exported from enums.ts
- [x] `TaskInput` schema defined with all fields per [schemas.md](../../../docs/architecture/schemas.md):
  - `id: Type.String()`, `name: Type.String()`, `dependsOn: Type.Array(Type.String())`
  - Categorical fields: `Type.Optional(Nullable(TaskXxxEnum))` for status, scope, risk, impact, level, priority
  - Metadata fields: `tags`, `assignee`, `due`, `created`, `modified`
- [x] `DependencyEdge` schema: `from: Type.String()`, `to: Type.String()`, `qualityRetention: Type.Optional(Type.Number({ default: 0.9 }))`
- [x] Type aliases derived: `type TaskInput = Static<typeof TaskInput>`, `type DependencyEdge = Static<typeof DependencyEdge>`
- [x] Re-exported from `src/schema/index.ts`

## References

- docs/architecture/schemas.md — TaskInput, DependencyEdge, Nullable definitions
- docs/research/typebox-patterns.md — section 6 (Nullable helper pattern)

## Notes

`Nullable` was already defined in `src/schema/enums.ts` by the `schema/enums` task. It is re-exported from `src/schema/task.ts` for convenience, satisfying the acceptance criteria. All other schemas (`TaskInput`, `DependencyEdge`) are brand new.

## Summary

Implemented TaskInput and DependencyEdge input schemas in `src/schema/task.ts`, plus re-exported Nullable helper.
- Modified: `src/schema/task.ts` (implemented TaskInput, DependencyEdge schemas with type aliases)
- Modified: `test/schema.test.ts` (added 49 tests for TaskInput, DependencyEdge, Nullable re-export, type alias verification)
- All 126 tests passing, lint clean.