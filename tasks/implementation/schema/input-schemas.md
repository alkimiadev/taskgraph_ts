---
id: schema/input-schemas
name: Define TaskInput, DependencyEdge, and Nullable helper
status: pending
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

- [ ] `src/schema/task.ts` exports `Nullable` helper: `const Nullable = <T extends TSchema>(T: T) => Type.Union([T, Type.Null()])`
- [ ] `TaskInput` schema defined with all fields per [schemas.md](../../../docs/architecture/schemas.md):
  - `id: Type.String()`, `name: Type.String()`, `dependsOn: Type.Array(Type.String())`
  - Categorical fields: `Type.Optional(Nullable(TaskXxxEnum))` for status, scope, risk, impact, level, priority
  - Metadata fields: `tags`, `assignee`, `due`, `created`, `modified`
- [ ] `DependencyEdge` schema: `from: Type.String()`, `to: Type.String()`, `qualityRetention: Type.Optional(Type.Number({ default: 0.9 }))`
- [ ] Type aliases derived: `type TaskInput = Static<typeof TaskInput>`, `type DependencyEdge = Static<typeof DependencyEdge>`
- [ ] Re-exported from `src/schema/index.ts`

## References

- docs/architecture/schemas.md — TaskInput, DependencyEdge, Nullable definitions
- docs/research/typebox-patterns.md — section 6 (Nullable helper pattern)

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion