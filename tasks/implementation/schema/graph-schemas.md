---
id: schema/graph-schemas
name: Define TaskGraphNodeAttributes, TaskGraphEdgeAttributes, and SerializedGraph
status: pending
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

- [ ] `src/schema/graph.ts` exports:
  - `TaskGraphNodeAttributes` schema: `name: Type.String()`, optional categorical enums (scope, risk, impact, level, priority, status) — **not** nullable on the graph (absent = not stored)
  - `type TaskGraphNodeAttributes` derived
  - `TaskGraphNodeAttributesUpdate = Type.Partial(TaskGraphNodeAttributes)` and type alias
  - `TaskGraphEdgeAttributes` schema: `qualityRetention: Type.Optional(Type.Number())`
  - `type TaskGraphEdgeAttributes` derived
  - `SerializedGraph` generic factory parameterized with `<N extends TSchema, E extends TSchema, G extends TSchema>`
  - `TaskGraphSerialized = SerializedGraph(TaskGraphNodeAttributes, TaskGraphEdgeAttributes, Type.Object({}))` and type alias
- [ ] `SerializedGraph` generic follows graphology JSON format: `attributes`, `options: { type: "directed", multi: false, allowSelfLoops: false }`, `nodes: [{ key, attributes }]`, `edges: [{ key, source, target, attributes }]`
- [ ] No schema version field on `TaskGraphSerialized` per spec
- [ ] Re-exported from `src/schema/index.ts`

## References

- docs/architecture/schemas.md — graph attribute schemas, SerializedGraph
- docs/research/typebox-patterns.md — section 6 (generic schema factories)

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion