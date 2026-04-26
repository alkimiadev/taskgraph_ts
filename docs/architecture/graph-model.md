---
status: draft
last_updated: 2026-04-26
---

# Graph Model

How task graphs are represented, constructed, and queried within the library.

## Overview

The library uses graphology's `DirectedGraph` as the underlying data structure. Tasks are nodes (keyed by task `id`), dependencies are directed edges, and categorical metadata (scope, risk, impact, etc.) lives on node attributes. The `TaskGraph` class wraps graphology and provides construction, mutation, and basic query operations — see [api-surface.md](api-surface.md) for the full API.

## Edge Direction

**prerequisite → dependent** (matches Rust CLI convention).

If task B has `dependsOn: ["A"]`, the edge is **A → B** (A must complete before B).

In graphology terms:
- `graph.inNeighbors(B)` → prerequisites (what B depends on)
- `graph.outNeighbors(A)` → dependents (what depends on A)
- `graph.addEdge(A, B)` — prerequisite is source, dependent is target

This convention is critical: it determines the semantics of `topologicalOrder` (prerequisites before dependents), `criticalPath` (longest path from source to sink), and `parallelGroups` (generational grouping by depth from sources).

## Construction Paths

The graph must be constructable from multiple sources to serve both consumers:

| Path | Source | Consumer | Edge Attributes |
|------|--------|----------|----------------|
| `fromTasks` | `TaskInput[]` (frontmatter/JSON) | OpenCode plugin, tests | Default `qualityDegradation` (0.9) |
| `fromRecords` | `TaskInput[]` + `DependencyEdge[]` | alkhub (DB query results) | Per-edge `qualityDegradation` |
| `fromJSON` | `TaskGraphSerialized` (graphology export) | Persistence/round-trip | Preserved from source |
| Incremental | `addTask` / `addDependency` calls | Programmatic/testing | Default or explicit |

**Preferred internal approach**: For paths 1 and 2, build a serialized graph JSON blob (nodes array + edges array) and call `graph.import()`. This is faster than N individual `addNode`/`addEdge` calls and avoids the verbose builder API.

### qualityDegradation on Construction

`fromTasks` constructs edges from `dependsOn` arrays in frontmatter, which cannot express per-edge `qualityDegradation`. Those edges get the default (0.9). `fromRecords` and `fromJSON` support per-edge values. Edges can be augmented after construction via `updateEdgeAttributes`.

This distinction exists because the file-based frontmatter model has no syntax for per-edge attributes, while the DB-backed model (alkhub) stores per-edge `qualityDegradation` in the `task_dependencies` table. The library serves both without forcing either into the other's shape.

## Categorical Field Defaults

Categorical fields (`scope`, `risk`, `impact`, `level`) are optional (nullable) — NULL means "not yet assessed." This matches the Rust CLI's `Option<TaskScope>`, `Option<TaskRisk>`, etc. and the alkhub DB schema's nullable columns.

The analysis functions need numeric values, so a `resolveDefaults` helper provides fallbacks:

| Field | When NULL | Fallback |
|-------|-----------|----------|
| risk | not assessed | successProbability 0.80 (medium), riskWeight 0.20 |
| scope | not assessed | costEstimate 2.0 (narrow) |
| impact | not assessed | weight 1.0 (isolated) |

The raw nullable data is preserved on the graph. `resolveDefaults` is called internally by analysis functions but is also available to consumers that need the same default logic. This ensures the library never silently reinterprets "not assessed" as a specific value — the distinction is explicit.

> See [schemas.md](schemas.md) for the full enum definitions and numeric method tables.

## Node Metadata

Unlike the original napi design where `DependencyGraph` only stored IDs, node attributes carry the categorical metadata directly. This eliminates the need to pass `TaskInput[]` alongside the graph — `weightedCriticalPath` and `riskPath` read attributes from the graph nodes.

The graph acts as an in-memory index/metadata store for categorical fields. Task body content, file path, and other non-graph data stay external to the library.

## Edge Attributes

Edges carry `qualityDegradation` for the DAG-propagation cost model. If absent, the default (0.9) is used by `workflowCost`. Other algorithms ignore edge attributes.

> See [cost-benefit.md](cost-benefit.md) for how qualityDegradation is used in propagation.

## Graph Reactivity

graphology's `Graph` class extends Node.js `EventEmitter` and emits fine-grained mutation events: `nodeAdded`, `edgeAdded`, `nodeDropped`, `edgeDropped`, `nodeAttributesUpdated`, `edgeAttributesUpdated`, `cleared`, `edgesCleared`.

`TaskGraph` does **not** wrap or re-emit these events. Consumers that need reactivity (e.g., file-watch → coordinator notification) access the underlying graphology instance via `graph.raw` and attach listeners directly. This keeps `TaskGraph` as a pure computation library with no opinion about reactivity.

## Constraints

- **DAG structure** — The library models task dependencies as a directed acyclic graph. Cycles are detected and reported as errors, not silently tolerated. See [errors-validation.md](errors-validation.md).
- **No parallel edges** — Between any node pair (A, B), at most one edge A→B exists. Duplicate dependency declarations are a validation error, not a valid use case. See [ADR-006](decisions/006-deterministic-edge-keys.md).
- **Unique node keys** — Task IDs (slugs) are unique within a graph. Adding a node with a duplicate key is an error.
- **Small graph sizes** — Realistic task graphs are 10–200 nodes. This means rebuild-on-change is always sub-millisecond. See [ADR-002](decisions/002-rebuild-vs-incremental.md).

## Open Questions

- Should we support multi-graphs (same node pair, multiple edges with different attributes)? Not needed for current use cases but could arise if conditional dependencies are introduced. See [ADR-006](decisions/006-deterministic-edge-keys.md) for the no-parallel-edges constraint.