---
id: graph/taskgraph-class
name: Implement TaskGraph class skeleton with graphology DirectedGraph
status: completed
depends_on:
  - schema/enums
  - schema/input-schemas
  - schema/graph-schemas
  - error/error-hierarchy
  - setup/project-init
scope: moderate
risk: medium
impact: phase
level: implementation
---

## Description

Create the `TaskGraph` class in `src/graph/index.ts` that wraps `graphology.DirectedGraph`. This is the data class that holds the graph instance and provides the foundation for construction, mutation, and query methods. At this stage, implement the constructor, `raw` getter, and the overall class structure. Actual construction and analysis methods come in dependent tasks.

## Acceptance Criteria

- [x] `src/graph/index.ts` exports `TaskGraph` class
- [x] Constructor creates an internal `graphology.DirectedGraph` with options `{ type: 'directed', multi: false, allowSelfLoops: false }`
- [x] `get raw(): Graph` returns the underlying graphology instance
- [x] Constructor accepts optional `TaskGraphSerialized` for initializing from serialized data (delegates to `fromJSON` pattern)
- [x] Class stores edge key format: `${source}->${target}` (per ADR-006)
- [x] No parallel edges constraint enforced by `multi: false` graph option
- [x] No self-loops constraint enforced by `allowSelfLoops: false` graph option
- [x] Internal `_edgeKey(source, target): string` method producing deterministic keys
- [x] Re-exported from `src/index.ts`

## References

- docs/architecture/api-surface.md — TaskGraph class API
- docs/architecture/graph-model.md — construction paths, edge direction, constraints
- docs/architecture/decisions/006-deterministic-edge-keys.md — edge key format

## Notes

Implementation placed in `src/graph/construction.ts` (as per existing module structure). The class is re-exported via `src/graph/index.ts` and `src/index.ts`. Static methods `fromTasks` and `fromRecords` are stubs (throw) pending dependent task implementation. `fromJSON` is fully implemented since the constructor needs it for deserialization.

## Summary

Implemented TaskGraph class skeleton wrapping graphology DirectedGraph.
- Modified: `src/graph/construction.ts` (full class with constructor, raw getter, _edgeKey, fromJSON, stubs for fromTasks/fromRecords)
- Modified: `src/graph/index.ts` (added TaskGraphInner type export)
- Modified: `test/graph.test.ts` (added 20 new tests for class skeleton, preserved 22 existing fixture tests)
- Tests: 42 in graph.test.ts (all passing), 204 total across suite (all passing)