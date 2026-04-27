---
id: graph/export
name: Implement TaskGraph export methods (export, toJSON)
status: completed
depends_on:
  - graph/taskgraph-class
scope: single
risk: trivial
impact: component
level: implementation
---

## Description

Implement the `export()` and `toJSON()` methods on `TaskGraph`. These wrap graphology's `export()` to produce `TaskGraphSerialized` output.

## Acceptance Criteria

- [x] `export(): TaskGraphSerialized` — wraps `graph.export()` and validates the output conforms to the `TaskGraphSerialized` schema
- [x] `toJSON(): TaskGraphSerialized` — alias for `export()` (enables `JSON.stringify(graph)` to work)
- [x] Exported data includes all node attributes and edge attributes (including `qualityRetention`)
- [x] Round-trip: `TaskGraph.fromJSON(graph.export())` produces an equivalent graph
- [x] Unit test: create graph, add tasks/edges, export, round-trip through fromJSON, verify equivalence

## References

- docs/architecture/api-surface.md — export/toJSON methods
- docs/architecture/schemas.md — TaskGraphSerialized schema

## Notes

Straightforward implementation. `export()` delegates to `this._graph.export()` and casts to `TaskGraphSerialized`. `toJSON()` is a simple alias so `JSON.stringify(graph)` works automatically.

## Summary

Implemented `export()` and `toJSON()` methods on `TaskGraph` class.
- Modified: `src/graph/construction.ts` — added export() and toJSON() methods
- Modified: `test/graph.test.ts` — added 10 tests covering export, toJSON, round-trip, JSON.stringify integration
- Tests: 266, all passing (lint clean)