---
id: review/graph-complete
name: Review TaskGraph class implementation for correctness and API compliance
status: completed
depends_on:
  - graph/construction
  - graph/mutation
  - graph/queries
  - graph/subgraph-and-validation
  - graph/export
  - review/schemas-and-errors
scope: moderate
risk: medium
impact: phase
level: review
---

## Description

Review the TaskGraph class implementation before building analysis functions on top of it. The graph layer is the foundation for all analysis — incorrect behavior here propagates everywhere.

## Acceptance Criteria

- [x] Construction methods match [graph-model.md](../../../docs/architecture/graph-model.md) error handling table exactly:
  - `fromTasks`: silent orphan nodes, `DuplicateNodeError`, idempotent duplicate edges
  - `fromRecords`: `TaskNotFoundError` for dangling edges, `DuplicateNodeError`, `DuplicateEdgeError`
  - `fromJSON`: validated against schema, orphans preserved
  - `addTask`: `DuplicateNodeError`
  - `addDependency`: `TaskNotFoundError`, `DuplicateEdgeError`
- [x] Edge direction is prerequisite→dependent throughout (matches Rust CLI convention)
- [x] Deterministic edge keys `${source}->${target}` used via `addEdgeWithKey` (ADR-006)
- [x] `topologicalOrder` throws `CircularDependencyError` with `cycles` populated (ADR-003)
- [x] `findCycles` returns actual cycle paths (not just SCCs)
- [x] `subgraph` returns internal-only edges (ADR-007)
- [x] Validation methods return arrays, never throw
- [x] Mutation error semantics match [errors-validation.md](../../../docs/architecture/errors-validation.md) table (no-op for remove, throws for update on nonexistent)
- [x] `export()`/`toJSON()` round-trips correctly
- [x] `raw` getter exposed, warning about direct mutation documented in code comments
- [x] All tests pass, including edge cases (empty graphs, single-node, cyclic graphs, disconnected components)

## References

- docs/architecture/graph-model.md
- docs/architecture/api-surface.md
- docs/architecture/errors-validation.md

## Notes

See "Code Review Report" section below for detailed findings.

## Summary

**Approved with changes.** The TaskGraph implementation is solid and well-aligned with architecture specifications. All 561 tests pass, TypeScript compiles clean (`tsc --noEmit`), and construction/mutation/query/validation behavior matches the spec tables. Two warnings identified (one semantic concern with `updateEdgeAttributes` error type, one minor API surface divergence). No critical/blocking issues found.

---

# Code Review: review/graph-complete

## Summary

- Files reviewed: 6 (`src/graph/construction.ts`, `src/graph/mutation.ts`, `src/graph/queries.ts`, `src/graph/validation.ts`, `src/schema/graph.ts`, `src/error/index.ts`)
- Critical issues: 0
- Warnings: 2
- Suggestions: 4
- Tests: **passing** (561/561 across 12 test files)
- Lint: **clean** (`tsc --noEmit` passes with zero errors)
- Overall: **approved with changes**

---

## Acceptance Criteria Verification

### 1. Construction methods match graph-model.md error handling table ✅

| Method | Spec Requirement | Implementation | Status |
|--------|------------------|----------------|--------|
| `fromTasks` | Silent orphan nodes | `orphanIds` set tracked, added with `{ name: orphanId }` | ✅ |
| `fromTasks` | `DuplicateNodeError` | Pre-scan with `seenIds` Set, throws before any mutation | ✅ |
| `fromTasks` | Idempotent duplicate edges | `edgeSet` dedup, only one edge per pair | ✅ |
| `fromRecords` | `TaskNotFoundError` for dangling edges | Both `prerequisite` and `dependent` checked against `taskIdSet` | ✅ |
| `fromRecords` | `DuplicateNodeError` | Same pre-scan as `fromTasks` | ✅ |
| `fromRecords` | `DuplicateEdgeError` | `edgeSet` checked before adding each edge | ✅ |
| `fromJSON` | Validated against schema | `Value.Check(TaskGraphSerializedSchema, data)`, throws `InvalidInputError` | ✅ |
| `fromJSON` | Orphans preserved | `graph.import(data)` preserves all nodes from JSON | ✅ |
| `addTask` | `DuplicateNodeError` | `hasNode()` check before `addNode()` | ✅ |
| `addDependency` | `TaskNotFoundError` | Both endpoints checked with `hasNode()` | ✅ |
| `addDependency` | `DuplicateEdgeError` | `hasEdge(edgeKey)` check before `addEdgeWithKey()` | ✅ |

### 2. Edge direction is prerequisite→dependent ✅

- `addDependency(prerequisite, dependent)` creates edge `prerequisite → dependent`
- `dependencies(taskId)` uses `graph.inNeighbors(taskId)` (prerequisites)
- `dependents(taskId)` uses `graph.outNeighbors(taskId)` (dependents)
- `topologicalOrder` returns prerequisites before dependents
- Tests confirm: `tg.raw.source('a->b')` is `'a'`, `tg.raw.target('a->b')` is `'b'`

### 3. Deterministic edge keys ✅

- `addEdgeWithKey(edgeKey, ...)` used in `addDependency` via `_edgeKey(source, target)` → `${source}->${target}`
- `fromTasks` and `fromRecords` build `edgeEntries` with deterministic keys before `graph.import()`
- Test confirms all construction paths produce deterministic keys

### 4. `topologicalOrder` throws `CircularDependencyError` with `cycles` ✅

- Catches `topologicalSort` errors, then throws `new CircularDependencyError(findCycles(graph))`
- Test confirms `CircularDependencyError.cycles.length >= 1` and contains expected cycle nodes
- Message includes cycle path descriptions (e.g., "A → B → C")

### 5. `findCycles` returns actual cycle paths (not just SCCs) ✅

- SCC used as fast pre-check only (skip DFS if no multi-node SCCs)
- 3-color DFS (WHITE/GREY/BLACK) extracts cycle paths from recursion stack
- Returns `string[][]` where each inner array is `[A, B, C]` meaning A→B→C→A
- Test confirms last→first is an edge in the graph
- Returns one representative cycle per back edge, not exhaustive enumeration

### 6. `subgraph` returns internal-only edges ✅

- Uses `graphology-operators.subgraph` which only keeps edges where both endpoints are in the filtered set
- Creates a new `TaskGraph` and imports the subgraph data
- Test confirms: diamond filtered to `{B, D}` keeps only `B→D`, removes `A→B` and `C→D`

### 7. Validation methods return arrays, never throw ✅

- `validateSchema()`, `validateGraph()`, `validate()` all return arrays
- No exceptions thrown — errors collected and returned
- Test confirms empty arrays for valid/acyclic graphs

### 8. Mutation error semantics match errors-validation.md ✅

| Operation | Spec | Implementation | Status |
|-----------|------|----------------|--------|
| `removeTask(id)` | No-op | `if (!graph.hasNode(id)) return` | ✅ |
| `removeDependency(src, tgt)` | No-op | `if (!graph.hasEdge(key)) return` | ✅ |
| `updateTask(id, attrs)` | Throws `TaskNotFoundError` | `if (!graph.hasNode(id)) throw new TaskNotFoundError(id)` | ✅ |
| `updateEdgeAttributes(src, tgt, attrs)` | Throws `TaskNotFoundError` | `if (!graph.hasEdge(key)) throw new TaskNotFoundError(key)` | ⚠️ (see W1) |
| `addDependency(prereq, dep)` | Throws `TaskNotFoundError` | Both endpoints checked | ✅ |

### 9. `export()`/`toJSON()` round-trips correctly ✅

- `export()` delegates to `graphology.export()`, cast as `TaskGraphSerialized`
- `toJSON()` is alias for `export()` (enables `JSON.stringify`)
- Tests verify: empty graph, graph with nodes+edges, re-export stability, `JSON.stringify` round-trip

### 10. `raw` getter exposed with warning ✅

- `get raw(): TaskGraphInner` returns `this._graph`
- JSDoc warning: "Mutating the underlying graphology instance directly bypasses TaskGraph's validation and invariants. Consumers using `raw` should treat the graph as read-only for structural changes and use TaskGraph methods for all mutations."
- Class-level JSDoc also documents the warning

### 11. All tests pass ✅

- 12 test files, 561 tests, all passing
- Edge cases covered: empty graphs, single-node, cyclic, disconnected components, two-node cycles, multiple independent cycles

---

## Critical Issues

None.

## Warnings

### W1: `updateEdgeAttributes` throws `TaskNotFoundError` with edge key as `taskId` — semantically misleading

**File**: `src/graph/mutation.ts:93-94`

```typescript
const key = `${prerequisite}->${dependent}`;
if (!graph.hasEdge(key)) {
  throw new TaskNotFoundError(key); // key = "x->y", not a task ID
}
```

The errors-validation.md spec says `updateEdgeAttributes` should throw `TaskNotFoundError`, and the implementation does. However, `TaskNotFoundError.taskId` is set to the edge key (e.g., `"x->y"`) rather than a task ID. This is semantically incorrect — `TaskNotFoundError` is documented as representing a missing *task* (node), not a missing edge. The `taskId` field name implies a node key. The spec states: "Throws `TaskNotFoundError` — cannot update attributes of a non-existent edge (implies at least one endpoint missing)", acknowledging this is edge-not-found, but the error class is node-focused.

**Impact**: Consumers catching `TaskNotFoundError` and reading `.taskId` will get an edge key string (`"x->y"`) where they expect a node key. This breaks the type contract of `TaskNotFoundError.taskId: string` (the field is named for task IDs, not edge keys).

**Recommendation**: Consider either (a) introducing an `EdgeNotFoundError` with `prerequisite`/`dependent` fields (breaking change, probably too late), or (b) documenting in `updateEdgeAttributes` JSDoc that the thrown `TaskNotFoundError.taskId` will contain the edge key, not a task ID.

### W2: `addDependency` has a third parameter not shown in api-surface.md

**File**: `src/graph/construction.ts:498`

```typescript
addDependency(prerequisite: string, dependent: string, qualityRetention: number = 0.9): void
```

The architecture spec in `api-surface.md` shows `addDependency(prerequisite: string, dependent: string): void` (2 params only). The implementation adds an optional `qualityRetention` parameter with default 0.9. While this is a reasonable extension (the graph-model.md construction paths table mentions "Default or explicit" for incremental construction), it technically diverges from the documented API surface.

**Impact**: Low — the parameter is optional with a default, so it's backward-compatible. However, if a consumer relies on the API surface doc, they won't know this capability exists.

**Recommendation**: Update `api-surface.md` to reflect the optional third parameter.

## Suggestions

### S1: `fromTasks` and `fromRecords` use `graph.import()` bulk loading — consider validation of `qualityRetention` range

The `qualityRetention` value (0.0–1.0 per the cost-benefit model) is not validated at construction time. While the architecture says "Construction methods enforce uniqueness, not data quality", a `qualityRetention` of e.g., 2.5 or -0.3 would silently propagate into `workflowCost` calculations and produce nonsensical results. Consider adding a `validateSchema()` call in consumer code or documenting that `qualityRetention` bounds are only checked via validation, not at construction.

### S2: `findCycles` DFS recurses without explicit stack depth limit

For very large, deep graphs, the recursive DFS in `findCycles` (`queries.ts:82-108`) could exceed the call stack. Given the architecture constraint that "realistic task graphs are 10–200 nodes" (ADR-002), this is unlikely to be a problem in practice, but an iterative version would be more robust if the graph size constraint is relaxed.

### S3: `validateGraph` dangling reference check iterates all edges but graphology guarantees no dangling refs in well-formed graphs

In `validation.ts:74-94`, the dangling reference check iterates all edges and checks if both endpoints exist as nodes. In a graphology graph with proper API usage (all mutations through `TaskGraph` methods), this can never occur — graphology doesn't allow edges with missing endpoints, and `removeTask` cascade-deletes edges. This check is only useful if someone mutates `raw` directly, which the docs discourage. The check is harmless but adds O(E) overhead for a practically unreachable state. Consider adding a comment explaining when this would fire.

### S4: `subgraph` creates two temporary graphs (subgraph + result)

In `construction.ts:620-625`, the `subgraph` method creates a graphology subgraph, exports it, creates a new `TaskGraph`, and imports the data. This involves creating two graph instances. An alternative would be to construct the `TaskGraph` directly from the subgraph's nodes/edges without the intermediate export-import. However, this is a minor performance concern given the small graph sizes (10–200 nodes per ADR-002).

## Recommendations

1. **(Warning W1)** Document or adjust the `updateEdgeAttributes` error type — the `TaskNotFoundError.taskId` containing an edge key is a semantic mismatch. At minimum, add a JSDoc note.
2. **(Warning W2)** Update `api-surface.md` to include the optional `qualityRetention` parameter on `addDependency`.
3. **(Suggestion S3)** Add a comment on the dangling reference check explaining when it would actually fire.
4. **(Suggestion S1)** Document in graph-model.md that `qualityRetention` bounds are not validated at construction time.