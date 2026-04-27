---
id: cost-benefit/workflow-cost
name: Implement workflowCost orchestration function
status: completed
depends_on:
  - cost-benefit/dag-propagation
  - graph/queries
scope: moderate
risk: medium
impact: component
level: implementation
---

## Description

Implement `workflowCost(graph: TaskGraph, options?: WorkflowCostOptions): WorkflowCostResult` in `src/analysis/cost-benefit.ts`. This orchestrates the per-task EV calculations, handles DAG propagation, and enriches results with `taskId` and `name` from the graph.

## Acceptance Criteria

- [x] `workflowCost` accepts `WorkflowCostOptions` with optional: `includeCompleted`, `limit`, `propagationMode`, `defaultQualityRetention`
- [x] Default propagation mode: `"dag-propagate"` per ADR-004
- [x] Default `defaultQualityRetention`: 0.9
- [x] Each task in result includes: `taskId`, `name`, `ev`, `pIntrinsic`, `pEffective`, `probability` (= `pEffective`), `scopeCost`, `impactWeight`
- [x] `totalEv`: sum of all task EVs (excluding completed tasks from output when `includeCompleted: false`)
- [x] `averageEv`: `totalEv / tasks.length`
- [x] `propagationMode`: reflected in result
- [x] When `includeCompleted: false`: completed tasks excluded from `tasks` array but remain in propagation chain with p=1.0
- [x] When `includeCompleted: false`: only `"completed"` status triggers exclusion; `"failed"` and `"blocked"` are always included
- [x] When `limit` is set: returns at most `limit` tasks (sorted by EV descending? or topological order? spec says "limits the number of tasks in the result" — use topological order with limit)
- [x] Throws `CircularDependencyError` if graph is cyclic
- [x] Unit tests: full workflow cost calculation, independent vs dag-propagate comparison, excludeCompleted scenarios, limit behavior

## References

- docs/architecture/cost-benefit.md — workflow cost, skip-completed semantics
- docs/architecture/api-surface.md — workflowCost signature, WorkflowCostOptions
- docs/architecture/decisions/004-workflow-cost-dag-propagation.md — ADR-004

## Notes

Fixed `includeCompleted` default from `true` to `false` to match the api-surface.md specification. The implementation was mostly complete from prior dependency tasks (dag-propagation), but the default was incorrect. Updated the test suite to verify the correct default behavior and explicitly test the `includeCompleted: true` opt-in case.

## Summary

Implemented `workflowCost` orchestration function and fixed `includeCompleted` default to `false` per api-surface.md.
- Modified: `src/analysis/cost-benefit.ts` — fixed `includeCompleted` default from `true` to `false`
- Modified: `test/cost-benefit.test.ts` — updated default-behavior test and added explicit `includeCompleted: true` test
- Tests: 64 cost-benefit tests, all passing; 562 total tests across 12 test files, all passing