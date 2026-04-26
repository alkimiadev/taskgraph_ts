---
status: draft
last_updated: 2026-04-26
---

# Errors & Validation

Error types and validation levels for the library.

## Error Types

Typed error classes for programmatic recovery. All library errors extend `TaskgraphError`.

```typescript
class TaskgraphError extends Error {}

class TaskNotFoundError extends TaskgraphError {
  taskId: string
}

class CircularDependencyError extends TaskgraphError {
  cycles: string[][]   // each inner array is an ordered cycle path (last node → first node)
}

class InvalidInputError extends TaskgraphError {
  field: string
  message: string
}

class DuplicateNodeError extends TaskgraphError {
  taskId: string
}

class DuplicateEdgeError extends TaskgraphError {
  source: string
  target: string
}
```

### When Each Error Is Thrown

| Error | Trigger |
|-------|---------|
| `TaskNotFoundError` | `getTask`, `dependencies`, `dependents` called with non-existent task ID |
| `CircularDependencyError` | `topologicalOrder()` called on a cyclic graph |
| `InvalidInputError` | Frontmatter parsing finds invalid field values or missing required fields |
| `DuplicateNodeError` | `addTask` called with an ID that already exists in the graph |
| `DuplicateEdgeError` | `addDependency` called for a source→target pair that already exists |

### Mutation Operations on Non-Existent Targets

| Operation | Behavior When Target Doesn't Exist |
|-----------|-----------------------------------|
| `removeTask(id)` | No-op — if the node doesn't exist, nothing to remove |
| `removeDependency(src, tgt)` | No-op — if the edge doesn't exist, nothing to remove |
| `updateTask(id, attrs)` | Throws `TaskNotFoundError` — cannot update attributes of a non-existent node |
| `updateEdgeAttributes(src, tgt, attrs)` | Throws `TaskNotFoundError` — cannot update attributes of a non-existent edge (implies at least one endpoint missing) |
| `addDependency(prereq, dep)` | Throws `TaskNotFoundError` — at least one endpoint must exist first (use `addTask` before `addDependency`) |

This policy avoids silent failures on writes that should succeed (update, add) while allowing idempotent removals (remove is a no-op, not an error).

## Validation Levels

Two validation levels, consistent with the Rust CLI's `validate` command:

### 1. Schema validation (`validateSchema()`)

TypeBox `Value.Check` on input data — frontmatter fields, enum values, required fields. Returns `ValidationError[]`. Catches:
- Missing required fields (`id`, `name`)
- Invalid enum values (e.g., `risk: "extreme"`)
- Type mismatches (e.g., `dependsOn: "not-an-array"`)

### 2. Graph validation (`validateGraph()`)

Graph-level invariants — catches problems that exist between tasks, not within a single task. Returns `GraphValidationError[]`:
- Cycle detection (via `findCycles()`)
- Dangling dependency references (task depends on an ID not in the graph)

### 3. Combined validation (`validate()`)

Runs both schema and graph validation. Returns `ValidationError[]` (the union of both types).

### Validation Return Types

```typescript
interface ValidationError {
  type: "schema"
  taskId?: string        // which task has the issue (if applicable)
  field: string         // which field is invalid
  message: string       // human-readable description
  value?: unknown       // the invalid value (if safe to include)
}

interface GraphValidationError {
  type: "graph"
  category: "cycle" | "dangling-reference"
  taskId?: string
  message: string
  details?: unknown     // e.g., cycles: string[][] for cycle errors
}
```

Both types are returned as arrays. Validation never throws — it collects all issues and returns them. This allows consumers to implement "collect all errors" strategies.

## Cycle Handling

The library takes a strict approach to cycles:

- `hasCycles()` returns a boolean — no side effects
- `findCycles()` returns the actual cycle paths — for debugging and error reporting
- `topologicalOrder()` **throws** `CircularDependencyError` when the graph is cyclic, rather than returning a partial ordering — see [ADR-003](decisions/003-topo-order-throws-on-cycle.md)

**Cyclic graphs are a valid graph state** — they can be constructed, queried, and validated. Only operations that require a DAG (topo sort, critical path, parallel groups, workflow cost) throw on cycles. Construction never throws.

## Construction vs. Validation Error Handling

The fundamental contract:

1. **Construction never throws** — `fromTasks`, `fromRecords`, `fromJSON`, `addTask`, `addDependency` can be called freely. `DuplicateNodeError` and `DuplicateEdgeError` are the exceptions — they represent programming errors (adding something that already exists), not data validation issues.
2. **Validation returns error arrays** — `validateSchema()`, `validateGraph()`, and `validate()` collect issues without throwing.
3. **`topologicalOrder()` is the operation-level exception** — it throws because returning a partial result would be silently incorrect.

This distinction exists because validation is a "check before you proceed" operation (collect all issues, show the user), while topo sort is an operation that cannot produce a meaningful result on a cyclic graph.

## Constraints

- **All errors are typed** — no string-based error matching. Consumers can catch specific error classes.
- **Validation returns arrays, not throws** — consumers choose their own error handling strategy (fail-fast vs. collect-all-errors).
- **`topologicalOrder` is the sole exception** — it throws on cyclic graphs because returning a partial result would be silently incorrect.