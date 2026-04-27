---
id: schema/graph-schemas
name: Define TaskGraphNodeAttributes, TaskGraphEdgeAttributes, and SerializedGraph
status: completed
depends_on:
  - schema/enums
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Define graph attribute schemas and the serialized graph generic in `src/schema/graph.ts`. `TaskGraphNodeAttributes` carries only analysis-relevant metadata (no tags, assignee, due, etc.). `SerializedGraph` is a generic factory parameterized with node and edge attribute types.

## Acceptance Criteria

- [x] `src/schema/graph.ts` exports:
  - [x] `TaskGraphNodeAttributes` schema: `name: Type.String()`, optional categorical enums (scope, risk, impact, level, priority, status) — **not** nullable on the graph (absent = not stored)
  - [x] `type TaskGraphNodeAttributes` derived
  - [x] `TaskGraphNodeAttributesUpdate = Type.Partial(TaskGraphNodeAttributes)` and type alias
  - [x] `TaskGraphEdgeAttributes` schema: `qualityRetention: Type.Optional(Type.Number())`
  - [x] `type TaskGraphEdgeAttributes` derived
  - [x] `SerializedGraph` generic factory parameterized with `<N extends TSchema, E extends TSchema, G extends TSchema>`
  - [x] `TaskGraphSerialized = SerializedGraph(TaskGraphNodeAttributes, TaskGraphEdgeAttributes, Type.Object({}))` and type alias
- [x] `SerializedGraph` generic follows graphology JSON format: `attributes`, `options: { type: "directed", multi: false, allowSelfLoops: false }`, `nodes: [{ key, attributes }]`, `edges: [{ key, source, target, attributes }]`
- [x] No schema version field on `TaskGraphSerialized` per spec
- [x] Re-exported from `src/schema/index.ts`

## References

- docs/architecture/schemas.md — graph attribute schemas, SerializedGraph
- docs/research/typebox-patterns.md — section 6 (generic schema factories)

## Notes

Follows the architecture spec in docs/architecture/schemas.md and the generic schema factory pattern from docs/research/typebox-patterns.md section 6. The `SerializedGraph` generic factory uses the recommended graphology JSON format with `Type.Literal("directed")`, `Type.Literal(false)`, and `Type.Literal(false)` for the options. No `default` on `qualityRetention` in the graph schema (unlike `DependencyEdge` which has `Type.Number({ default: 0.9 })`) — the graph schema keeps it simple with `Type.Optional(Type.Number())`.

## Summary

Implemented graph attribute schemas and serialized graph generic factory per spec.
- Created: `src/schema/graph.ts` (TaskGraphNodeAttributes, TaskGraphNodeAttributesUpdate, TaskGraphEdgeAttributes, SerializedGraph generic, TaskGraphSerialized, and all type aliases)
- Modified: `test/schema.test.ts` (35 new tests for graph schemas: TaskGraphNodeAttributes, TaskGraphNodeAttributesUpdate, TaskGraphEdgeAttributes, SerializedGraph, and compile-time type verification)
- Tests: 121 total, all passing; `tsc --noEmit` clean