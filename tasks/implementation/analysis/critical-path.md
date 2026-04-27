---
id: analysis/critical-path
name: Implement criticalPath and weightedCriticalPath functions
status: completed
depends_on:
  - graph/construction
  - graph/queries
scope: moderate
risk: medium
impact: component
level: implementation
---

## Description

Implement `criticalPath` and `weightedCriticalPath` as standalone functions. `criticalPath` finds the longest path from sources to sinks using default edge weighting. `weightedCriticalPath` accepts a custom weight function for per-node weighting.

`criticalPath` can be implemented via topological order + dynamic programming (longest path in DAG). For unweighted, each edge has weight 1; for weighted, each node contributes a weight.

## Acceptance Criteria

- [ ] `criticalPath(graph: TaskGraph): string[]` — returns the longest path as an ordered array of task IDs
- [ ] `weightedCriticalPath(graph: TaskGraph, weightFn: (taskId: string, attrs: TaskGraphNodeAttributes) => number): string[]` — returns the path with the highest cumulative weight
- [ ] Both functions throw `CircularDependencyError` if graph is cyclic
- [ ] When multiple paths tie, returns any one of them (deterministic order preferred)
- [ ] Empty graph returns `[]`; single-node graph returns `[nodeId]`
- [ ] Unit tests: linear chain (the chain itself is critical path), diamond graph (tests path selection), weighted variant with diverse scope values

## References

- docs/architecture/api-surface.md — criticalPath, weightedCriticalPath signatures
- docs/architecture/graph-model.md — edge direction (prerequisite→dependent determines source→sink)

## Notes

Implementation uses topological order + dynamic programming (longest path in DAG).
Both functions delegate to a shared `computeLongestPath` helper that:
1. Gets topological order (throws CircularDependencyError via `graph.topologicalOrder()`)
2. Initializes source nodes with their weight
3. Relaxes edges in topological order (DP: dist[v] = max(dist[u] + weight(v)))
4. Backtracks from the node with maximum distance to reconstruct the path

`criticalPath` uses `weightFn = () => 1` (unweighted).
`weightedCriticalPath` accepts a custom weight function on `(taskId, attrs)`.

## Summary

Implemented `criticalPath` and `weightedCriticalPath` as standalone functions using topological-order DP.
- Modified: `src/analysis/critical-path.ts` (full implementation, 161 lines)
- Modified: `test/analysis.test.ts` (20 tests covering all acceptance criteria)
- Tests: 20, all passing (462 total passing)

## Summary

> To be filled on completion