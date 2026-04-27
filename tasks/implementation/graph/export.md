---
id: graph/export
name: Implement TaskGraph export methods (export, toJSON)
status: pending
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

- [ ] `export(): TaskGraphSerialized` — wraps `graph.export()` and validates the output conforms to the `TaskGraphSerialized` schema
- [ ] `toJSON(): TaskGraphSerialized` — alias for `export()` (enables `JSON.stringify(graph)` to work)
- [ ] Exported data includes all node attributes and edge attributes (including `qualityRetention`)
- [ ] Round-trip: `TaskGraph.fromJSON(graph.export())` produces an equivalent graph
- [ ] Unit test: create graph, add tasks/edges, export, round-trip through fromJSON, verify equivalence

## References

- docs/architecture/api-surface.md — export/toJSON methods
- docs/architecture/schemas.md — TaskGraphSerialized schema

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion