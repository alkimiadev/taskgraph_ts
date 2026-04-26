# ADR-002: Rebuild graph on change, not incremental updates

**Status**: Accepted

## Context

When task data changes (file edits, DB updates), the in-memory graph needs to reflect the new state. Two approaches: incremental updates (add/remove individual nodes/edges) or full rebuild from source data.

## Decision

**Rebuild.** For our graph sizes (10–200 nodes), `graph.import()` from a serialized blob is sub-millisecond. Both consumers (alkhub builds from DB query results; OpenCode plugin rebuilds from directory on file change) are well-served by rebuild.

## Consequences

### Positive
- No change-detection layer needed — no tracking ID renames, dependency removals, edge reconciliation
- Simpler codebase — no diff algorithm, no incremental update logic
- Always consistent — rebuild guarantees the graph matches the source data exactly

### Negative
- Technically wasteful for small changes (rebuilding entire graph when one task changed)
- Not suitable for very large graphs or extremely frequent updates

### Mitigation

If a future use case requires incremental updates, add it as an optimization then. The API surface (construction methods) supports both patterns — incremental construction exists via `addTask`/`addDependency`.

An incremental update architecture has been explored (draft, not yet a decision) in [incremental-update-exploration.md](../incremental-update-exploration.md). The key finding is that **the win is reactivity (fine-grained event notifications), not performance**. For <200 node graphs, rebuild is always sub-millisecond. If a consumer needs reactive updates, they can use graphology's event system directly via `graph.raw` and implement change detection at the consumer layer, without the library taking on the complexity of diff-based updates.