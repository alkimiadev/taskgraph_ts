---
id: cost-benefit/dag-propagation
name: Implement DAG-propagation effective probability computation
status: completed
depends_on:
  - cost-benefit/ev-calculation
  - graph/queries
  - schema/numeric-methods-and-defaults
scope: moderate
risk: high
impact: phase
level: implementation
---

## Description

Implement the DAG-propagation cost model in `src/analysis/cost-benefit.ts`. This is the core algorithmic contribution beyond the Rust CLI — it captures the structural reality that upstream failures multiply downstream damage.

Per [cost-benefit.md](../../../docs/architecture/cost-benefit.md), the algorithm:
1. Processes tasks in topological order
2. For each task with prerequisites, computes `pEffective` from intrinsic probability + upstream propagation
3. Upstream propagation: `parentP + (1 - parentP) × qualityRetention` for each parent
4. `pEffective` = intrinsic × product of all inherited quality factors

## Acceptance Criteria

- [x] `computeEffectiveP(taskId, graph, upstreamSuccessProbs, defaultQualityRetention, propagationMode)` — internal helper
- [x] In `dag-propagate` mode: for each task in topological order:
  - Get intrinsic probability from `resolveDefaults(risk).successProbability`
  - For each prerequisite, compute inherited quality: `parentP + (1 - parentP) × qualityRetention`
  - `pEffective` = intrinsic × product of all inherited quality factors
  - Store task's **actual** success probability for downstream propagation (use `pEffective` if this is the task's real probability)
- [x] In `independent` mode: `pEffective = pIntrinsic` (no propagation)
- [x] Completed tasks (`status: "completed"`): propagate with `p = 1.0` when `includeCompleted: false`
- [x] `qualityRetention` per edge defaults to 0.9, can be overridden per-edge via `defaultQualityRetention` option or edge attributes
- [x] Throws `CircularDependencyError` if graph is cyclic (needs topo sort)
- [x] Unit tests: simple chain (verify compounding effect), diamond graph, independent vs dag-propagate comparison matches Python research model results, completed task exclusion/propagation semantics

## References

- docs/architecture/cost-benefit.md — DAG-propagation algorithm, qualityRetention semantics
- docs/architecture/decisions/004-workflow-cost-dag-propagation.md — ADR-004
- docs/architecture/decisions/005-no-depth-escalation-v1.md — no depth escalation in v1

## Notes

No depth escalation in v1 per ADR-005 — multiplicative propagation captures depth effects implicitly.
Per-edge qualityRetention on edges takes precedence over defaultQualityRetention option.
With default EvConfig (no fallbackCost/timeLost), EV = scopeCost × impactWeight regardless of p, so totalEv is similar across modes but pEffective differs.

## Summary

Implemented DAG-propagation effective probability computation with `computeEffectiveP` internal helper and `workflowCost` public function.
- Modified: `src/analysis/cost-benefit.ts` — added `computeEffectiveP` and `workflowCost` functions
- Modified: `test/cost-benefit.test.ts` — added 30+ new tests for DAG propagation
- Tests: 63 total in cost-benefit.test.ts, all 476 across test suite passing
- Key features: topological ordering, per-edge qualityRetention, independent/dag-propagate modes, completed task exclusion/propagation semantics, CircularDependencyError for cyclic graphs