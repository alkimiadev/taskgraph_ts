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
| `fromTasks` | `TaskInput[]` (frontmatter/JSON) | OpenCode plugin, tests | Default `qualityRetention` (0.9) |
| `fromRecords` | `TaskInput[]` + `DependencyEdge[]` | alkhub (DB query results) | Per-edge `qualityRetention` |
| `fromJSON` | `TaskGraphSerialized` (graphology export) | Persistence/round-trip | Preserved from source |
| Incremental | `addTask` / `addDependency` calls | Programmatic/testing | Default or explicit |

**Preferred internal approach**: For paths 1 and 2, build a serialized graph JSON blob (nodes array + edges array) and call `graph.import()`. This is faster than N individual `addNode`/`addEdge` calls and avoids the verbose builder API.

### qualityRetention on Construction

`fromTasks` constructs edges from `dependsOn` arrays in frontmatter, which cannot express per-edge `qualityRetention`. Those edges get the default (0.9). `fromRecords` and `fromJSON` support per-edge values. Edges can be augmented after construction via `updateEdgeAttributes`.

This distinction exists because the file-based frontmatter model has no syntax for per-edge attributes, while the DB-backed model (alkhub) stores per-edge `qualityRetention` in the `task_dependencies` table. The library serves both without forcing either into the other's shape.

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

## TaskInput → Node Attributes Transformation

When constructing from `TaskInput[]` (via `fromTasks`), the input data shape differs from the graph node attribute shape. The transformation is:

| TaskInput field | Graph node attribute | Notes |
|----------------|---------------------|-------|
| `id` | Node key (not an attribute) | Used as `graph.addNode(id, attributes)` key |
| `name` | `name: Type.String()` (required) | Directly transferred |
| `dependsOn` | Creates edges (not a node attribute) | Each element → `addDependency(id, dep)` with default `qualityRetention: 0.9` |
| `status`, `scope`, `risk`, `impact`, `level`, `priority` | Same-name optional attributes | `Type.Optional(Nullable(Enum))` → `Type.Optional(Enum)`: YAML `null` values and absent fields both map to attribute `undefined` (not stored on the node) |
| `tags`, `assignee`, `due`, `created`, `modified` | **Not stored on graph** | These fields exist on `TaskInput` but are not part of `TaskGraphNodeAttributes`. They belong to the caller/consumer, not the graph. |

The key point: `TaskInput` uses `Type.Optional(Nullable(Enum))` (field can be absent *or* set to null), but `TaskGraphNodeAttributes` uses `Type.Optional(Enum)` (field can be absent, but not null). The transformation strips `null` → `undefined` (not stored). This is correct because on the graph, absent and null mean the same thing: "not assessed."

For `fromRecords`, the same transformation applies to tasks, and edges come from the explicit `DependencyEdge[]` array with per-edge `qualityRetention` values.

## Edge Attributes

Edges carry `qualityRetention` for the DAG-propagation cost model. If absent, the default (0.9) is used by `workflowCost`. Other algorithms ignore edge attributes.

> See [cost-benefit.md](cost-benefit.md) for how qualityRetention is used in propagation.

> **Note**: This field was renamed from `qualityDegradation` to `qualityRetention` because the original name was semantically inverted — a value of 0.9 meant "90% quality retained" (low degradation), not "90% degradation" (high degradation). See [schemas.md](schemas.md) for details.

## Graph Reactivity

graphology's `Graph` class extends Node.js `EventEmitter` and emits fine-grained mutation events: `nodeAdded`, `edgeAdded`, `nodeDropped`, `edgeDropped`, `nodeAttributesUpdated`, `edgeAttributesUpdated`, `cleared`, `edgesCleared`.

`TaskGraph` does **not** wrap or re-emit these events. Consumers that need reactivity (e.g., file-watch → coordinator notification) access the underlying graphology instance via `graph.raw` and attach listeners directly. This keeps `TaskGraph` as a pure computation library with no opinion about reactivity.

## Construction Error Handling

| Method | Dangling references (node not in graph) | Duplicate IDs/edges | Cycles |
|--------|----------------------------------------|--------------------|----|
| `fromTasks` | Silently creates nodes for each `dependsOn` target that doesn't match a known task ID. These become orphan nodes with default attributes. **Recommendation**: run `validateGraph()` after construction to detect dangling references. | `DuplicateNodeError` for duplicate task IDs. Uses `mergeNode` for nodes with the same ID (idempotent merge of attributes). Duplicate `dependsOn` entries for the same pair create only one edge (idempotent via `addEdgeWithKey`). | Not detected at construction time. Call `hasCycles()` or `validateGraph()` to detect. |
| `fromRecords` | `TaskNotFoundError` if an edge references a task ID not in the `tasks` array. Dependencies are edges and must have both endpoints present. | `DuplicateNodeError` for duplicate task IDs. `DuplicateEdgeError` for duplicate prerequisite→dependent pairs. | Not detected at construction time. Call `validateGraph()` to detect. |
| `fromJSON` | Validated against `TaskGraphSerialized` schema. Orphan nodes in the JSON are preserved (graphology import doesn't enforce connectivity). | Uses graphology's `import()` which handles duplicates via merge behavior. | Not detected at construction time. |
| `addTask` | N/A | `DuplicateNodeError` if ID already exists | N/A |
| `addDependency` | `TaskNotFoundError` if prerequisite or dependent doesn't exist | `DuplicateEdgeError` if the edge already exists | Not detected until `hasCycles()` or `topologicalOrder()` |

## Constraints

- **DAG structure** — The library models task dependencies as a directed acyclic graph. Cycles are detected and reported as errors, not silently tolerated. See [errors-validation.md](errors-validation.md).
- **No parallel edges** — Between any node pair (A, B), at most one edge A→B exists. Duplicate dependency declarations are a validation error, not a valid use case. See [ADR-006](decisions/006-deterministic-edge-keys.md).
- **Unique node keys** — Task IDs (slugs) are unique within a graph. Adding a node with a duplicate key is an error.
- **Small graph sizes** — Realistic task graphs are 10–200 nodes. This means rebuild-on-change is always sub-millisecond. See [ADR-002](decisions/002-rebuild-vs-incremental.md).

## Open Questions

- Should we support multi-graphs (same node pair, multiple edges with different attributes)? Not needed for current use cases but could arise if conditional dependencies are introduced. See [ADR-006](decisions/006-deterministic-edge-keys.md) for the no-parallel-edges constraint.