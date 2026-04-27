---
id: analysis/bottlenecks
name: Implement bottlenecks analysis function
status: completed
depends_on:
  - graph/construction
  - graph/queries
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Implement `bottlenecks(graph: TaskGraph): Array<{ taskId: string; score: number }>` using `graphology-metrics` betweenness centrality. Bottleneck tasks are those on the most shortest paths between other nodes.

## Acceptance Criteria

- [x] `bottlenecks` returns array of `{ taskId, score }` objects sorted by score descending
- [x] Uses `graphology-metrics` betweenness centrality computation
- [x] Normalized scores (0.0–1.0 range)
- [x] Tasks with score 0 are still included (they're not bottlenecks)
- [x] Works on disconnected graphs (betweenness is 0 for disconnected components)
- [x] Unit tests: linear chain (middle node has highest betweenness), star graph (center has highest), independent nodes (all zero)

## References

- docs/architecture/api-surface.md — bottlenecks signature
- docs/architecture/build-distribution.md — graphology-metrics dependency

## Notes

Graphology-metrics betweenness centrality throws on empty graphs (mnemonist FixedStack requires positive capacity). Handled by returning empty array when `graph.raw.order === 0`.

## Summary

Implemented `bottlenecks(graph: TaskGraph): BottleneckResult[]` using `graphology-metrics` betweenness centrality with `normalized: true`.
- Created: `src/analysis/bottleneck.ts` (bottlenecks function + BottleneckResult interface)
- Modified: `test/analysis.test.ts` (replaced placeholder with 20 tests covering all acceptance criteria)
- Tests: 20, all passing (linear chain, star graph, independent nodes, disconnected graph, diamond, empty graph, single node, sorted output, normalized scores)