---
id: analysis/parallel-groups
name: Implement parallelGroups analysis function
status: completed
depends_on:
  - graph/construction
  - graph/queries
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Implement `parallelGroups(graph: TaskGraph): string[][]` in `src/analysis/index.ts` or a dedicated module. This returns groups of tasks that can be executed concurrently — tasks at the same topological depth. Uses `graphology-dag.topologicalGenerations`.

## Acceptance Criteria

- [x] `parallelGroups` returns `string[][]` where each inner array is a generation of tasks at the same depth from sources
- [x] Uses `graphology-dag.topologicalGenerations()` for the generation computation
- [x] Tasks with zero prerequisites are in the first group
- [x] Throws `CircularDependencyError` if the graph is cyclic (delegated to `topologicalGenerations` behavior)
- [x] Works on disconnected graphs (each connected component sorted independently, then merged by depth)
- [x] Unit tests: linear chain (each group size 1), diamond graph, disconnected components

## References

- docs/architecture/api-surface.md — parallelGroups signature
- docs/architecture/graph-model.md — parallel groups definition

## Notes

Implementation uses `topologicalGenerations` from `graphology-dag` which internally uses Kahn's algorithm. It naturally handles disconnected graphs by grouping source nodes (zero in-degree) from all components into the same first generation. On cyclic graphs, `topologicalGenerations` throws and we catch it to re-throw `CircularDependencyError` with cycle information (same pattern as `topologicalOrder` in queries.ts).

## Summary

Implemented `parallelGroups(graph: TaskGraph): string[][]` in a dedicated module.
- Created: `src/analysis/parallel-groups.ts`, `test/parallel-groups.test.ts`
- Modified: `src/analysis/index.ts` (added re-export)
- Tests: 14, all passing (full suite: 457 tests passing, lint clean)