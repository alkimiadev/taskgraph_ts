---
id: schema/enums
name: Define TypeBox categorical enum schemas and type aliases
status: completed
depends_on:
  - setup/project-init
scope: narrow
risk: trivial
impact: component
level: implementation
---

## Description

Define all categorical enum schemas using `Type.Union([Type.Literal(...)])` pattern per [schemas.md](../../../docs/architecture/schemas.md). Each enum gets a schema constant (PascalCase + `Enum` suffix) and a `Static<typeof>` type alias (PascalCase, no suffix).

The six enums: `TaskScopeEnum`, `TaskRiskEnum`, `TaskImpactEnum`, `TaskLevelEnum`, `TaskPriorityEnum`, `TaskStatusEnum`.

## Acceptance Criteria

- [x] `src/schema/enums.ts` exports all six enum schemas and their type aliases
- [x] Each enum uses `Type.Union([Type.Literal("value"), ...])` pattern per [typebox-patterns.md](../../../docs/research/typebox-patterns.md)
- [x] `TaskScopeEnum`: `"single" | "narrow" | "moderate" | "broad" | "system"`
- [x] `TaskRiskEnum`: `"trivial" | "low" | "medium" | "high" | "critical"`
- [x] `TaskImpactEnum`: `"isolated" | "component" | "phase" | "project"`
- [x] `TaskLevelEnum`: `"planning" | "decomposition" | "implementation" | "review" | "research"`
- [x] `TaskPriorityEnum`: `"low" | "medium" | "high" | "critical"`
- [x] `TaskStatusEnum`: `"pending" | "in-progress" | "completed" | "failed" | "blocked"`
- [x] Type aliases derived via `Static<typeof>`: `TaskScope`, `TaskRisk`, `TaskImpact`, `TaskLevel`, `TaskPriority`, `TaskStatus`
- [x] Naming convention matches spec: `Enum` suffix on schema constants only, never on type aliases
- [x] `src/schema/index.ts` re-exports all schemas and types

## References

- docs/architecture/schemas.md — enum definitions, naming convention
- docs/research/typebox-patterns.md — TypeBox enum patterns, naming convention

## Notes

Also exported the `Nullable` helper generic (used by downstream schemas) and added JSDoc comments on each type alias.

## Summary

Implemented all six categorical enum schemas using `Type.Union([Type.Literal(...)])` pattern with `Static<typeof>` type aliases.
- Created: `src/schema/enums.ts` (6 enum schemas + 6 type aliases + Nullable helper)
- Modified: `test/schema.test.ts` (21 enum-specific tests: Value.Check validation, Nullable helper, compile-time type alias verification)
- Tests: 21 enum tests + 4 placeholders, all passing; `tsc --noEmit` clean