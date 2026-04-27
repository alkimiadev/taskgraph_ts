---
id: graph/subgraph-and-validation
name: Implement TaskGraph subgraph and validation methods
status: completed
depends_on:
  - graph/taskgraph-class
  - graph/queries
  - schema/input-schemas
  - schema/graph-schemas
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Implement the `subgraph()` method and the three validation methods (`validateSchema`, `validateGraph`, `validate`) on `TaskGraph`.

Per [ADR-007](../../../docs/architecture/decisions/007-subgraph-internal-only.md), `subgraph` returns only edges where both endpoints are in the filtered set.

Per [errors-validation.md](../../../docs/architecture/errors-validation.md), validation methods collect issues and return arrays — never throw.

## Acceptance Criteria

- [ ] `subgraph(filter: (taskId: string, attrs: TaskGraphNodeAttributes) => boolean): TaskGraph`:
  - Uses `graphology-operators.subgraph` to extract matching nodes
  - Returns only edges where both endpoints are in the filtered set (internal-only) per ADR-007
  - Returns a new `TaskGraph` instance (not mutating the original)
- [ ] `validateSchema(): ValidationError[]`:
  - Uses TypeBox `Value.Check()` and `Value.Errors()` on each node's attributes
  - Returns structured `ValidationError[]` with `type: "schema"`, `taskId`, `field`, `message`, `value`
- [ ] `validateGraph(): GraphValidationError[]`:
  - Runs `findCycles()` and checks for dangling dependency references
  - Returns structured `GraphValidationError[]` with `type: "graph"`, `category`, `message`, optional `details`
  - Cycle category: `"cycle"` with cycle paths in `details`
  - Dangling reference category: `"dangling-reference"` with the referencing task ID
- [ ] `validate(): ValidationError[]` — runs both `validateSchema()` and `validateGraph()`, returns combined array
- [ ] `ValidationError` and `GraphValidationError` interfaces defined (may be in error module or co-located)
- [ ] Unit tests: subgraph filtering, subgraph excludes external edges, validateSchema catches invalid enums, validateGraph catches cycles and dangling refs

## References

- docs/architecture/api-surface.md — validation API, subgraph
- docs/architecture/errors-validation.md — validation levels, return types
- docs/architecture/decisions/007-subgraph-internal-only.md — subgraph semantics

## Notes

Implementation follows the existing codebase pattern of standalone functions + class method delegation (like queries.ts and mutation.ts). The validation logic lives in `src/graph/validation.ts` with class methods on TaskGraph delegating to the standalone functions.

## Summary

Implemented subgraph() method and three validation methods (validateSchema, validateGraph, validate) on TaskGraph.

- Created: `src/graph/validation.ts` (standalone validateSchema, validateGraph, validate functions)
- Modified: `src/graph/construction.ts` (added subgraph, validateSchema, validateGraph, validate methods + import for graphology-operators subgraph)
- Modified: `src/graph/index.ts` (added export of validation module)
- Modified: `src/error/index.ts` (added ValidationError, GraphValidationError, AnyValidationError types)
- Created: `test/subgraph-and-validation.test.ts` (43 tests, all passing)

Key design decisions:
- `subgraph()` uses `graphology-operators.subgraph` with a Set of filtered node keys, which naturally implements ADR-007 (internal-only edges)
- Validation follows the existing pattern: standalone functions + class method delegation
- `ValidationError` and `GraphValidationError` are defined as interfaces in `src/error/index.ts`, with `AnyValidationError` union type for the combined `validate()` return
- All 486 tests pass (443 existing + 43 new)