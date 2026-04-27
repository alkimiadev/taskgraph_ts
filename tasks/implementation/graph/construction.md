---
id: graph/construction
name: Implement TaskGraph construction methods (fromTasks, fromRecords, fromJSON, addTask, addDependency)
status: pending
depends_on:
  - graph/taskgraph-class
scope: broad
risk: high
impact: phase
level: implementation
---

## Description

Implement the four construction methods in `src/graph/construction.ts` and integrate them as static methods on `TaskGraph`. These are the primary ways to create a graph instance from structured data. Each method has distinct semantics for edge handling, error behavior, and validation.

Per [graph-model.md](../../../docs/architecture/graph-model.md), the preferred internal approach is to build a serialized graph JSON blob and call `graph.import()` for paths 1 and 2 (better performance than N individual addNode/addEdge calls).

## Acceptance Criteria

- [ ] `TaskGraph.fromTasks(tasks: TaskInput[]): TaskGraph`:
  - Transforms `TaskInput[]` into node data + edge data, builds serialized blob, calls `graph.import()`
  - Each `dependsOn` entry creates an edge with default `qualityRetention: 0.9`
  - `dependsOn` targets not matching any task ID become orphan nodes with default attributes
  - Duplicate task IDs throw `DuplicateNodeError`
  - Uses `mergeNode` for idempotent node merging (same ID gets merged attributes)
  - Duplicate `dependsOn` entries for the same pair create only one edge (idempotent via `addEdgeWithKey`)
- [ ] `TaskGraph.fromRecords(tasks: TaskInput[], edges: DependencyEdge[]): TaskGraph`:
  - Edges must reference tasks that exist in the `tasks` array — throws `TaskNotFoundError` for dangling references
  - Per-edge `qualityRetention` from the `DependencyEdge` objects
  - Duplicate task IDs throw `DuplicateNodeError`
  - Duplicate edges (same prerequisite→dependent pair) throw `DuplicateEdgeError`
- [ ] `TaskGraph.fromJSON(data: TaskGraphSerialized): TaskGraph`:
  - Validates input against `TaskGraphSerialized` schema (using TypeBox `Value.Check`)
  - Uses `graph.import()` on the validated data
  - Orphan nodes in JSON are preserved
- [ ] `addTask(id: string, attributes: TaskGraphNodeAttributes): void`:
  - Throws `DuplicateNodeError` if ID already exists
  - Adds node to internal graphology instance
- [ ] `addDependency(prerequisite: string, dependent: string, qualityRetention?: number): void`:
  - Throws `TaskNotFoundError` if either endpoint doesn't exist
  - Throws `DuplicateEdgeError` if edge already exists
  - Uses `addEdgeWithKey` with deterministic key `${prerequisite}->${dependent}`
  - Default `qualityRetention: 0.9` if not provided
- [ ] `fromTasks`/`fromRecords` strip `null` → `undefined` for categorical fields during `TaskInput` → `TaskGraphNodeAttributes` transformation
- [ ] `TaskInput` fields `tags`, `assignee`, `due`, `created`, `modified` are not stored on graph nodes (belong to caller)
- [ ] Unit tests for each construction method: happy path, error cases, edge cases (empty arrays, cycles not rejected at construction time)
- [ ] All construction methods use deterministic edge keys per ADR-006

## References

- docs/architecture/graph-model.md — construction paths, TaskInput→attributes transformation, error handling table
- docs/architecture/api-surface.md — TaskGraph class, fromTasks/fromRecords/fromJSON/addTask/addDependency
- docs/architecture/decisions/006-deterministic-edge-keys.md — deterministic edge keys

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion