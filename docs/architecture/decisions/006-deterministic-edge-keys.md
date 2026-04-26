# ADR-006: Deterministic edge keys via addEdgeWithKey

**Status**: Accepted

## Context

graphology's default `addEdge(source, target)` generates random edge keys (e.g., `ge8kq2`). This makes debugging harder and adds overhead from key generation. For our use case, each source→target pair has at most one edge (no parallel edges in a DAG dependency graph).

## Decision

Use `addEdgeWithKey` with deterministic keys in the format `${source}->${target}` (e.g., `task-a->task-b`). This produces readable, debuggable edge identifiers and skips graphology's key generation overhead.

## Consequences

### Positive
- Debuggable edge identifiers — `task-a->task-b` is immediately understandable
- No random key generation overhead
- Deterministic — exporting and re-importing produces the same graph

### Negative
- Constraint enforced: no parallel edges between the same node pair
- Key format collision if task IDs contain `->` (extremely unlikely with kebab-case slugs)

### Mitigation

Duplicate dependency declarations (same source→target pair declared twice) are a validation error, not a valid use case. The constraint is correct for DAG dependency graphs.