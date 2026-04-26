# ADR-007: Subgraph returns internal-only edges

**Status**: Accepted

## Context

When filtering a graph to a subset of nodes, what happens to edges where only one endpoint is in the filtered set? Options: include cross-boundary edges (external dependencies visible), or strict internal-only (only edges where both endpoints are in the filtered set).

## Decision

**Strict internal-only.** `subgraph(filter)` returns a new `TaskGraph` with matching nodes and only edges where both endpoints are in the filtered set. This matches `graphology-operators` `subgraph` behavior and produces valid subgraphs for all algorithms (topo sort, betweenness, etc.).

## Consequences

### Positive
- Result is always a valid (potentially disconnected) subgraph — all algorithms work correctly
- Matches graphology's built-in subgraph behavior
- No surprise external references in analysis results

### Negative
- External dependency information is lost — you can't see "what does this subgraph depend on outside itself" from the subgraph alone

### Mitigation

External dependency information is available on the original graph via `dependencies()`/`dependents()`. A separate `externalDependencies(filter)` utility can be added later if consumers need "show me what this subgraph depends on outside itself."