---
id: graph/mutation
name: Implement TaskGraph mutation methods (remove, update, updateEdgeAttributes)
status: completed
depends_on:
  - graph/taskgraph-class
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Implement mutation methods in `src/graph/mutation.ts` and integrate on `TaskGraph`. These methods modify the graph in-place.

## Acceptance Criteria

- [x] `removeTask(id: string): void` — No-op if node doesn't exist. Removes node and cascades edge removal (graphology handles this automatically).
- [x] `removeDependency(prerequisite: string, dependent: string): void` — No-op if edge doesn't exist. Uses deterministic edge key `${prerequisite}->${dependent}` to identify the edge.
- [x] `updateTask(id: string, attributes: Partial<TaskGraphNodeAttributes>): void` — Throws `TaskNotFoundError` if ID doesn't exist. Uses `mergeNodeAttributes` for shallow merge of provided attributes.
- [x] `updateEdgeAttributes(prerequisite: string, dependent: string, attrs: Partial<TaskGraphEdgeAttributes>): void` — Throws `TaskNotFoundError` (actually `TaskNotFoundError` for the edge itself, but per the spec, edge attributes need both endpoints to exist) if the edge doesn't exist. Uses `mergeEdgeAttributes` for shallow merge.
- [x] All mutations maintain the deterministic edge key format
- [x] Unit tests: remove nonexistent node/edge is no-op, update nonexistent throws, partial updates merge correctly

## References

- docs/architecture/api-surface.md — mutation methods
- docs/architecture/errors-validation.md — mutation operation behavior table
- docs/architecture/graph-model.md — edge attributes, mutation semantics

## Notes

Implementation follows the architecture spec precisely:
- Standalone functions in `mutation.ts` take `TaskGraphInner` as first arg
- TaskGraph class methods delegate to standalone functions
- `removeTask`/`removeDependency` are no-ops on missing targets (idempotent removal)
- `updateTask`/`updateEdgeAttributes` throw `TaskNotFoundError` on missing targets
- Deterministic edge key format `${prerequisite}->${dependent}` used throughout

## Summary

Implemented all four TaskGraph mutation methods with standalone functions and class integration.
- Created: `test/mutation.test.ts` (27 tests)
- Modified: `src/graph/mutation.ts`, `src/graph/construction.ts`
- Tests: 284 total, all passing (27 new mutation tests)