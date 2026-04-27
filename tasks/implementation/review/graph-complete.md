---
id: review/graph-complete
name: Review TaskGraph class implementation for correctness and API compliance
status: pending
depends_on:
  - graph/construction
  - graph/mutation
  - graph/queries
  - graph/subgraph-and-validation
  - graph/export
  - review/schemas-and-errors
scope: moderate
risk: medium
impact: phase
level: review
---

## Description

Review the TaskGraph class implementation before building analysis functions on top of it. The graph layer is the foundation for all analysis — incorrect behavior here propagates everywhere.

## Acceptance Criteria

- [ ] Construction methods match [graph-model.md](../../../docs/architecture/graph-model.md) error handling table exactly:
  - `fromTasks`: silent orphan nodes, `DuplicateNodeError`, idempotent duplicate edges
  - `fromRecords`: `TaskNotFoundError` for dangling edges, `DuplicateNodeError`, `DuplicateEdgeError`
  - `fromJSON`: validated against schema, orphans preserved
  - `addTask`: `DuplicateNodeError`
  - `addDependency`: `TaskNotFoundError`, `DuplicateEdgeError`
- [ ] Edge direction is prerequisite→dependent throughout (matches Rust CLI convention)
- [ ] Deterministic edge keys `${source}->${target}` used via `addEdgeWithKey` (ADR-006)
- [ ] `topologicalOrder` throws `CircularDependencyError` with `cycles` populated (ADR-003)
- [ ] `findCycles` returns actual cycle paths (not just SCCs)
- [ ] `subgraph` returns internal-only edges (ADR-007)
- [ ] Validation methods return arrays, never throw
- [ ] Mutation error semantics match [errors-validation.md](../../../docs/architecture/errors-validation.md) table (no-op for remove, throws for update on nonexistent)
- [ ] `export()`/`toJSON()` round-trips correctly
- [ ] `raw` getter exposed, warning about direct mutation documented in code comments
- [ ] All tests pass, including edge cases (empty graphs, single-node, cyclic graphs, disconnected components)

## References

- docs/architecture/graph-model.md
- docs/architecture/api-surface.md
- docs/architecture/errors-validation.md

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion