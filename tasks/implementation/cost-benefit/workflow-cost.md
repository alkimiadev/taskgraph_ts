---
id: cost-benefit/workflow-cost
name: Implement workflowCost orchestration function
status: pending
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

- [ ] `workflowCost` accepts `WorkflowCostOptions` with optional: `includeCompleted`, `limit`, `propagationMode`, `defaultQualityRetention`
- [ ] Default propagation mode: `"dag-propagate"` per ADR-004
- [ ] Default `defaultQualityRetention`: 0.9
- [ ] Each task in result includes: `taskId`, `name`, `ev`, `pIntrinsic`, `pEffective`, `probability` (= `pEffective`), `scopeCost`, `impactWeight`
- [ ] `totalEv`: sum of all task EVs (excluding completed tasks from output when `includeCompleted: false`)
- [ ] `averageEv`: `totalEv / tasks.length`
- [ ] `propagationMode`: reflected in result
- [ ] When `includeCompleted: false`: completed tasks excluded from `tasks` array but remain in propagation chain with p=1.0
- [ ] When `includeCompleted: false`: only `"completed"` status triggers exclusion; `"failed"` and `"blocked"` are always included
- [ ] When `limit` is set: returns at most `limit` tasks (sorted by EV descending? or topological order? spec says "limits the number of tasks in the result" — use topological order with limit)
- [ ] Throws `CircularDependencyError` if graph is cyclic
- [ ] Unit tests: full workflow cost calculation, independent vs dag-propagate comparison, excludeCompleted scenarios, limit behavior

## References

- docs/architecture/cost-benefit.md — workflow cost, skip-completed semantics
- docs/architecture/api-surface.md — workflowCost signature, WorkflowCostOptions
- docs/architecture/decisions/004-workflow-cost-dag-propagation.md — ADR-004

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion