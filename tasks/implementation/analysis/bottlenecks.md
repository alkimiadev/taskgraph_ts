---
id: analysis/bottlenecks
name: Implement bottlenecks analysis function
status: pending
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

- [ ] `bottlenecks` returns array of `{ taskId, score }` objects sorted by score descending
- [ ] Uses `graphology-metrics` betweenness centrality computation
- [ ] Normalized scores (0.0–1.0 range)
- [ ] Tasks with score 0 are still included (they're not bottlenecks)
- [ ] Works on disconnected graphs (betweenness is 0 for disconnected components)
- [ ] Unit tests: linear chain (middle node has highest betweenness), star graph (center has highest), independent nodes (all zero)

## References

- docs/architecture/api-surface.md — bottlenecks signature
- docs/architecture/build-distribution.md — graphology-metrics dependency

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion