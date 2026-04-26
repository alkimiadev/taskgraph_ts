---
status: draft
last_updated: 2026-04-26
---

# Incremental Update Architecture Notes

**Draft exploration** — not yet a decision. This document explores whether incremental updates (via TypeBox Diff/Patch → graphology mutation mapping) could replace or complement the current "rebuild on change" approach. If this exploration leads to a decision, it will become ADR-008.

## Current Approach: Rebuild on Change

ADR-002 decided that `TaskGraph` rebuilds from source data on every change. For our graph sizes (10–200 nodes), `graph.import()` from a serialized blob is sub-millisecond.

**Why rebuild was chosen:**
- No change-detection layer needed
- Simpler codebase
- Always consistent — the graph exactly matches the source data

**Why rebuild was questioned:**
- If a single task's risk changes from "medium" to "high", we rebuild the entire graph
- Both consumers (alkhub, OpenCode plugin) would benefit from not having to rebuild for small changes

## The Idea: Diff-Based Incremental Updates

### Core Concept

1. Keep the previous state (serialized `TaskGraphSerialized` or equivalent)
2. When source data changes, produce new state
3. Diff old vs new using TypeBox `Value.Diff()`
4. Map diff edits to graphology mutation methods
5. Apply minimal mutations to the existing graph

### TypeBox Diff/Patch

`Value.Diff(oldValue, newValue)` produces structured edits:

```typescript
const edits = Value.Diff(oldSerialized, newSerialized);
// [
//   { type: 'update', path: '/nodes/2/attributes/risk', value: 'high' },
//   { type: 'insert', path: '/nodes/5', value: { key: 'task-f', attributes: {...} } },
//   { type: 'delete', path: '/nodes/3' },
//   { type: 'update', path: '/edges/0/attributes/qualityRetention', value: 0.8 },
// ]
```

### Graphology Mutation Mapping

| Diff Type | Path Pattern | Graphology Method |
|-----------|-------------|-------------------|
| `update` | `/nodes/{i}/attributes/{field}` | `setNodeAttribute(key, field, value)` |
| `insert` | `/nodes/{i}` with `key` | `mergeNode(key, attributes)` |
| `delete` | `/nodes/{i}` with `key` | `dropNode(key)` — cascades to edges |
| `update` | `/edges/{i}/attributes/{field}` | `setEdgeAttribute(key, field, value)` |
| `insert` | `/edges/{i}` with `source`/`target` | `addEdgeWithKey(key, source, target, attrs)` |
| `delete` | `/edges/{i}` with `key` | `dropEdge(key)` |

Graphology also provides:
- `mergeNodeAttributes(key, partialAttrs)` — shallow merge, perfect for attribute patches
- `replaceNodeAttributes(key, newAttrs)` — full replacement
- `mergeEdgeAttributes(key, partialAttrs)` — shallow merge for edge patches

### The Source-Level Problem

TypeBox `Value.Diff()` operates on the **serialized graph representation**. If we diff at the **input source level** (TaskInput[]→graph construction), the diff paths don't directly correspond to graph mutations because:

1. `TaskInput.dependsOn` is a flat string array → maps to multiple edges, not a single field update
2. A new `dependsOn` entry means "add edge", a removed entry means "drop edge" — this requires understanding the semantics, not just the data shape
3. Task index position isn't stable — removing task at index 2 shifts all subsequent indices

**The diff must happen at the graph level, not the source level.** This means the consumer needs to produce the new serialized form first, then the library diffs old vs new and applies mutations.

### Hybrid Approach: Diff with Rebuild Threshold

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│ Old state   │     │ New source    │     │ Diff threshold  │
│ (serialized)│────►│ → serialized  │────►│ check           │
└─────────────┘     └──────────────┘     └────────┬───────┘
                                                   │
                                          ┌────────┴────────┐
                                          │                  │
                                    Small diff          Large diff
                                          │                  │
                                          ▼                  ▼
                                   Apply mutations    Rebuild from
                                   to existing        new serialized
                                   graph               (graph.import)
```

The threshold check could be:
- **Edit count**: If `edits.length > graph.order * 0.5` (more than half the nodes changed), rebuild
- **Structural changes**: If any node additions/deletions, rebuild (ID tracking for edge cascades is complex)
- **Always rebuild for structural changes, diff for attribute-only changes**

### What Graphology's `import(data, true)` Gives Us

Graphology's `import(data, {merge: true})` already does incremental merging — it calls `mergeNode` and `mergeEdge` for each element. This is:
- **Idempotent**: adding a node that already exists merges attributes
- **Incremental**: adds/merges only the elements in the data
- **O(n+m)**: iterates nodes and edges in the data

But it **does not handle deletions** — if a node was in the old data but not in the new, `import(... true)` won't remove it.

### Where This Helps vs. Doesn't Help

**Helps:**
- alkhub: DB rows change → produce new serialized form → diff applies minimal updates. Graph event listeners (`nodeAttributesUpdated`, `edgeAdded`, etc.) fire for actual changes, enabling reactive UI updates without a full rebuild event.
- OpenCode plugin: File changes → produce new serialized form → diff applies minimal updates. Again, event listeners get fine-grained notifications.

**Doesn't help:**
- For the cost-benefit analysis functions (topo sort, critical path, workflow cost), they recompute from scratch anyway. The graph being incrementally updated doesn't make these faster.
- For initial graph construction, `fromTasks`/`fromRecords` build the serialized form and call `graph.import()` — this is already fast.

**The real win is reactivity, not performance.** alkhub's coordinator wants to know when a task's status changes, not when the entire graph is rebuilt. Fine-grained events enable:
- Selective UI updates
- Targeted notifications to agents watching specific tasks
- Incremental DB updates (only write changed rows)

## Open Questions

1. **Should the library keep the "old state" or should the consumer?** If the library keeps it, that's stateful — the current design is stateless (rebuild from source each time). If the consumer keeps it, the library needs a `diffAndUpdate(oldSerialized, newSerialized, graph)` function.

2. **Is the complexity worth it for <200 node graphs?** Rebuild is always sub-millisecond. The diff approach adds significant implementation complexity for marginal performance gain. The reactivity gain is real but can be achieved by the consumer comparing old vs new themselves.

3. **Edge deletion cascading**: When a node is deleted, all its edges must be removed. `Value.Diff()` doesn't know about this structural constraint — it reports node deletion as one edit, but the graph semantics require N edge deletions too. The mapping layer needs to understand the graph model, not just the data shape.

4. **How does this interact with the consumer's change detection?** alkhub gets DB change events; the OpenCode plugin gets file watcher events. Both already know *what* changed. Should we map their change events directly to graph mutations instead of running a full diff?

## Potential Architecture

If we pursue this, the pattern would be:

```typescript
// Current (rebuild):
const graph = TaskGraph.fromRecords(tasks, edges);

// Proposed (incremental):
const graph = TaskGraph.fromRecords(tasks, edges); // initial build
// ... later, when source changes ...
const changes = TaskGraph.diff(oldSerialized, newSerialized);
TaskGraph.applyDiff(graph, changes); // mutate existing graph

// Or with threshold:
TaskGraph.updateFromSerialized(graph, oldSerialized, newSerialized, {
  rebuildThreshold: 0.5 // rebuild if >50% of nodes changed
});
```

The `applyDiff` function would map each edit to the appropriate graphology mutation:
- `type: 'update', path: '/nodes/{i}/attributes/{field}'` → `graph.setNodeAttribute(key, field, value)`
- `type: 'insert', path: '/nodes/{i}'` → `graph.mergeNode(key, attributes)`
- `type: 'delete', path: '/nodes/{i}'` → `graph.dropNode(key)` (plus cascading edge deletions)
- And equivalent edge operations.

## Decision

**Not yet.** This exploration is valuable for a potential v2, but for v1:

- Rebuild remains the default approach (ADR-002)
- The architectural space is documented here for future reference
- Graphology's `import()` and mutation methods provide the building blocks
- TypeBox's `Value.Diff()` provides the diffing primitive
- The mapping layer (diff edit → graph mutation) is the missing piece that would need implementation and testing

The key insight is that **the win is reactivity, not performance**. For <200 node graphs, performance is a non-issue. If a consumer needs fine-grained reactivity, they should use graphology's event system directly via `graph.raw` and implement their own change detection at the consumer layer.

## References

- ADR-002: Rebuild vs Incremental → [decisions/002-rebuild-vs-incremental.md](decisions/002-rebuild-vs-incremental.md)
- TypeBox Diff/Patch: [../../node_modules/@alkdev/typebox/docs/values/diff-patch.md](../../node_modules/@alkdev/typebox/docs/values/diff-patch.md) (monorepo: `@alkdev/typebox/docs/values/diff-patch.md`)
- Graphology mutation API: [Graphology docs on GitHub](https://graphology.github.io/standard-library/mutation.html)
- Graphology serialization (import/export): [Graphology docs on GitHub](https://graphology.github.github.io/serialization.html)
- POC: `lbug_test/convert_graphology.ts` (monorepo-internal)