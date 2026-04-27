---
id: graph/taskgraph-class
name: Implement TaskGraph class skeleton with graphology DirectedGraph
status: pending
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

- [ ] `src/graph/index.ts` exports `TaskGraph` class
- [ ] Constructor creates an internal `graphology.DirectedGraph` with options `{ type: 'directed', multi: false, allowSelfLoops: false }`
- [ ] `get raw(): Graph` returns the underlying graphology instance
- [ ] Constructor accepts optional `TaskGraphSerialized` for initializing from serialized data (delegates to `fromJSON` pattern)
- [ ] Class stores edge key format: `${source}->${target}` (per ADR-006)
- [ ] No parallel edges constraint enforced by `multi: false` graph option
- [ ] No self-loops constraint enforced by `allowSelfLoops: false` graph option
- [ ] Internal `_edgeKey(source, target): string` method producing deterministic keys
- [ ] Re-exported from `src/index.ts`

## References

- docs/architecture/api-surface.md — TaskGraph class API
- docs/architecture/graph-model.md — construction paths, edge direction, constraints
- docs/architecture/decisions/006-deterministic-edge-keys.md — edge key format

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion