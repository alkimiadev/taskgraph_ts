---
id: analysis/critical-path
name: Implement criticalPath and weightedCriticalPath functions
status: pending
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

> To be filled by implementation agent

## Summary

> To be filled on completion