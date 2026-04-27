---
id: schema/enums
name: Define TypeBox categorical enum schemas and type aliases
status: pending
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

- [ ] `src/schema/enums.ts` exports all six enum schemas and their type aliases
- [ ] Each enum uses `Type.Union([Type.Literal("value"), ...])` pattern per [typebox-patterns.md](../../../docs/research/typebox-patterns.md)
- [ ] `TaskScopeEnum`: `"single" | "narrow" | "moderate" | "broad" | "system"`
- [ ] `TaskRiskEnum`: `"trivial" | "low" | "medium" | "high" | "critical"`
- [ ] `TaskImpactEnum`: `"isolated" | "component" | "phase" | "project"`
- [ ] `TaskLevelEnum`: `"planning" | "decomposition" | "implementation" | "review" | "research"`
- [ ] `TaskPriorityEnum`: `"low" | "medium" | "high" | "critical"`
- [ ] `TaskStatusEnum`: `"pending" | "in-progress" | "completed" | "failed" | "blocked"`
- [ ] Type aliases derived via `Static<typeof>`: `TaskScope`, `TaskRisk`, `TaskImpact`, `TaskLevel`, `TaskPriority`, `TaskStatus`
- [ ] Naming convention matches spec: `Enum` suffix on schema constants only, never on type aliases
- [ ] `src/schema/index.ts` re-exports all schemas and types

## References

- docs/architecture/schemas.md — enum definitions, naming convention
- docs/research/typebox-patterns.md — TypeBox enum patterns, naming convention

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion