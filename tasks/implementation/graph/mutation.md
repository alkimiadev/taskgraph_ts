---
id: graph/mutation
name: Implement TaskGraph mutation methods (remove, update, updateEdgeAttributes)
status: pending
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

- [ ] `removeTask(id: string): void` — No-op if node doesn't exist. Removes node and cascades edge removal (graphology handles this automatically).
- [ ] `removeDependency(prerequisite: string, dependent: string): void` — No-op if edge doesn't exist. Uses deterministic edge key `${prerequisite}->${dependent}` to identify the edge.
- [ ] `updateTask(id: string, attributes: Partial<TaskGraphNodeAttributes>): void` — Throws `TaskNotFoundError` if ID doesn't exist. Uses `mergeNodeAttributes` for shallow merge of provided attributes.
- [ ] `updateEdgeAttributes(prerequisite: string, dependent: string, attrs: Partial<TaskGraphEdgeAttributes>): void` — Throws `TaskNotFoundError` (actually `TaskNotFoundError` for the edge itself, but per the spec, edge attributes need both endpoints to exist) if the edge doesn't exist. Uses `mergeEdgeAttributes` for shallow merge.
- [ ] All mutations maintain the deterministic edge key format
- [ ] Unit tests: remove nonexistent node/edge is no-op, update nonexistent throws, partial updates merge correctly

## References

- docs/architecture/api-surface.md — mutation methods
- docs/architecture/errors-validation.md — mutation operation behavior table
- docs/architecture/graph-model.md — edge attributes, mutation semantics

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion