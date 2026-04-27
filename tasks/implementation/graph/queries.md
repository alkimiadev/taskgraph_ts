---
id: graph/queries
name: Implement TaskGraph query methods (hasCycles, findCycles, topologicalOrder, dependencies, dependents, taskCount, getTask)
status: completed
depends_on:
  - graph/taskgraph-class
scope: moderate
risk: medium
impact: component
level: implementation
---

## Description

Implement query methods in `src/graph/queries.ts` and integrate on `TaskGraph`. The `findCycles` implementation requires a custom 3-color DFS since `graphology-components` only gives SCCs, not cycle paths.

Per [errors-validation.md](../../../docs/architecture/errors-validation.md):
- `hasCycles()` returns boolean (uses `graphology-dag` or `graphology-components` for fast check)
- `findCycles()` returns `string[][]` — each inner array is an ordered cycle path
- `topologicalOrder()` throws `CircularDependencyError` with `cycles` populated when graph is cyclic (per ADR-003)

## Acceptance Criteria

- [x] `hasCycles(): boolean` — uses `graphology-dag.hasCycle()` or `graphology-components` SCC check as fast pre-check
- [x] `findCycles(): string[][]`:
  - Uses `stronglyConnectedComponents()` as pre-check: if zero multi-node SCCs and no self-loops, skip DFS
  - Custom 3-color DFS (WHITE/GREY/BLACK) to extract cycle paths
  - Returns one representative cycle per back edge, not exhaustive enumeration
  - Each inner array is an ordered node sequence where last node has edge back to first
- [x] `topologicalOrder(): string[]`:
  - Uses `graphology-dag.topologicalSort()` for the actual sort
  - **Throws `CircularDependencyError`** (with `cycles` from `findCycles()`) when graph is cyclic
  - Returns `string[]` of task IDs in prerequisite→dependent order
- [x] `dependencies(taskId: string): string[]` — returns prerequisite task IDs (inNeighbors). Throws `TaskNotFoundError` if ID doesn't exist.
- [x] `dependents(taskId: string): string[]` — returns dependent task IDs (outNeighbors). Throws `TaskNotFoundError` if ID doesn't exist.
- [x] `taskCount(): number` — returns number of nodes
- [x] `getTask(taskId: string): TaskGraphNodeAttributes | undefined` — returns node attributes or undefined
- [x] Unit tests: cycle detection on known cyclic/acyclic graphs, topologicalOrder on DAG, topologicalOrder throws on cyclic graph, dependency/dependent queries

## References

- docs/architecture/api-surface.md — query methods
- docs/architecture/errors-validation.md — cycle handling, CircularDependencyError
- docs/architecture/cost-benefit.md — findCycles algorithm description
- docs/architecture/decisions/003-topo-order-throws-on-cycle.md — ADR-003

## Notes

findCycles uses a custom 3-color DFS (WHITE/GREY/BLACK) as specified — graphology-components only gives SCCs, not cycle paths. The DFS traces the recursion stack on back edges to extract ordered cycle paths.

## Summary

Implemented all 7 query methods in `src/graph/queries.ts` as free functions operating on the inner graphology graph, and integrated them as instance methods on `TaskGraph`.
- Created: `src/graph/queries.ts`, `test/queries.test.ts`
- Modified: `src/graph/construction.ts` (added query method imports and 7 instance methods)
- Tests: 45, all passing (full suite: 302 passing)