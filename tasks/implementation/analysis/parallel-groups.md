---
id: analysis/parallel-groups
name: Implement parallelGroups analysis function
status: pending
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

- [ ] `parallelGroups` returns `string[][]` where each inner array is a generation of tasks at the same depth from sources
- [ ] Uses `graphology-dag.topologicalGenerations()` for the generation computation
- [ ] Tasks with zero prerequisites are in the first group
- [ ] Throws `CircularDependencyError` if the graph is cyclic (delegated to `topologicalGenerations` behavior)
- [ ] Works on disconnected graphs (each connected component sorted independently, then merged by depth)
- [ ] Unit tests: linear chain (each group size 1), diamond graph, disconnected components

## References

- docs/architecture/api-surface.md — parallelGroups signature
- docs/architecture/graph-model.md — parallel groups definition

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion