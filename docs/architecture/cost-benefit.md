---
status: draft
last_updated: 2026-04-26
---

# Cost-Benefit Analysis

Expected value math, risk analysis, DAG-propagation cost model, and cycle detection.

## Overview

The cost-benefit functions are the key analytical value of the library. They go beyond simple graph topology to answer structural questions about task workflows: which path has the highest cumulative risk? What's the expected cost of a workflow? Which tasks should be decomposed?

These functions implement the cost-benefit framework from `/workspace/@alkimiadev/taskgraph/docs/framework.md` and extend it with DAG-propagation (from the Python research model) that the Rust CLI's independent model ignores.

## Core Concepts

### Expected Value of a Task

```
EV_task = P_success × C_success + (1 - P_success) × C_fail
```

Where categorical fields provide the inputs:
- **P_success** = `riskSuccessProbability(risk)` — probability the task completes successfully
- **C_success** = `scopeCostEstimate(scope)` — cost when it works
- **C_fail** = modeled via `EvConfig` parameters: `scopeCost + fallbackCost + timeLost × expectedRetries`. The `calculateTaskEv` function uses `scopeCost` as `C_success` and derives `C_fail` from the same `scopeCost` plus `fallbackCost` and `timeLost` scaled by expected retry count. `fallbackCost` and `timeLost` default to 0 if not provided, yielding `C_fail = C_success` in the simplest case. The `valueRate` parameter converts the result to dollar terms if needed.

### EvConfig Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `retries` | 0 | Maximum retry attempts. Used in the EV calculation: each retry adds `timeLost` cost. When 0, no retry cost is considered. |
| `fallbackCost` | 0 | Cost incurred when a task fails and no retry succeeds. Added to `scopeCost` in the failure term. |
| `timeLost` | 0 | Time cost per retry attempt. Total retry cost = `retries × timeLost`. |
| `valueRate` | 0 | Dollar conversion rate. When non-zero, multiplies the EV result to produce dollar-denominated output. When 0, EV is in abstract cost units. |

### Structural Insight: Upstream Failures Multiply

```
planning failure → wrong decomposition → wasted implementation
decomposition failure → unclear tasks → rework
review failure → bugs shipped → rework
```

This means `risk: critical` at planning level > `risk: critical` at implementation level. The cost-benefit framework demonstrates this: poor planning (p=0.65) increases total cost by 150% compared to good planning (p=0.92), even with identical implementation tasks.

The failure propagates: poor planning reduces decomposition quality, which reduces implementation effectiveness, which increases integration issues. This structural property is independent of the developer type — human, LLM, or otherwise.

### Decomposition Threshold

`shouldDecomposeTask` flags tasks where:
- risk >= high, OR
- scope >= broad

This is a structural insight: large or risky tasks have higher failure rates and should be broken down. The threshold is consistent with the Rust CLI's `decompose` command.

## DAG-Propagation Cost Model

### Why

The Rust CLI computes EV per-task independently — no upstream quality degradation. As the Python research model demonstrates, this is dangerously optimistic for non-trivial workflows. In a dependency chain where planning has p=0.65 (poor), the Python model shows a **213% cost increase** vs good planning (p=0.92). The independent model barely shows a difference because it ignores cascading failure.

### Implementation Approach

DAG propagation is the **default mode**. The independent model is a degenerate case (set `defaultQualityRetention: 1.0` or `propagationMode: 'independent'`).

The algorithm processes tasks in topological order, maintaining an `upstreamSuccessProbs` map:

1. For each task in topological order:
   - If propagation mode is `dag-propagate`: compute `pEffective` from intrinsic probability + upstream propagation
   - If propagation mode is `independent`: use intrinsic probability directly
   - Calculate EV using `calculateTaskEv`
   - Store the task's actual success probability for downstream propagation

2. When computing effective probability for a task with prerequisites:
   - Start with intrinsic probability
   - For each prerequisite, compute inherited quality: `parentP + (1 - parentP) × qualityRetention`
   - Multiply all inherited quality factors together with intrinsic probability

3. The `qualityRetention` per edge determines how much upstream quality is preserved:
   - 0.0 = no retention (full propagation — upstream failure guarantees child failure)
   - 1.0 = full retention (independent model — upstream failure has no effect on child)
   - default 0.9 = high retention (only 10% of upstream failure bleeds through)

### Per-task output

Each task in the `WorkflowCostResult.tasks` array includes both `pIntrinsic` and `pEffective` so consumers can see the degradation effect. The per-task entries also include `taskId` and `name` (enriched from the graph's node attributes) — `calculateTaskEv` is the pure math function (takes only numeric inputs), while `workflowCost` is the aggregate that orchestrates the per-task calls and enriches results with identity metadata from the graph.

### Skip-completed semantics

When `includeCompleted: false`, tasks with `status: "completed"` are excluded from the result's task list, but they **remain in the propagation chain** with p=1.0. Removing completed tasks from propagation would *worsen* downstream probability estimates — exactly the opposite of what "what's left" queries need. Only the `"completed"` status triggers this exclusion; tasks with `"failed"` or `"blocked"` status are included regardless of the `includeCompleted` setting.

> See [ADR-004](decisions/004-workflow-cost-dag-propagation.md) and [ADR-005](decisions/005-no-depth-escalation-v1.md).

### Comparison with Rust CLI

| Dimension | Rust CLI (Simple Sum) | This Library (DAG Propagation) |
|-----------|----------------------|-------------------------------|
| Topology awareness | None | Full — topological order + upstream propagation |
| Upstream failure modeling | Ignored | Each parent's failure degrades child's effective p |
| Edge semantics | Not used | `qualityRetention` per edge, default 0.9 |
| Result interpretation | Sum of independent per-task costs | Total workflow cost accounting for cascading failure |
| Degenerate case | — | Set `propagationMode: 'independent'` or `defaultQualityRetention: 1.0` |

## Risk Analysis Functions

### riskPath

`riskPath(graph)` → `RiskPathResult`

Calls `weightedCriticalPath` with weight function `riskWeight * impactWeight`. Returns the path with highest cumulative risk and its total risk score.

### riskDistribution

`riskDistribution(graph)` → `RiskDistributionResult`

Groups tasks by risk category. Returns counts per bucket: trivial, low, medium, high, critical, unspecified.

### shouldDecomposeTask

`shouldDecomposeTask(attrs: TaskGraphNodeAttributes)` → `DecomposeResult`

Pure function — takes node attributes (not a graph). Internally calls `resolveDefaults` to handle nullable `risk`/`scope` fields. A task with `risk: null` uses the default (medium, which is below the threshold); a task with `scope: null` uses the default (narrow, which is below the threshold). This means unassessed tasks are never flagged for decomposition — an explicit `risk: "high"` or `scope: "broad"` is required.

## findCycles

graphology provides `hasCycle` (boolean) and `stronglyConnectedComponents` (node groups, not paths). The library implements a custom cycle path extractor for error reporting:

- **Algorithm**: Extended 3-color DFS (WHITE/GREY/BLACK). When a back edge is found (GREY → GREY), trace back through the recursion stack to extract the cycle path as an ordered node sequence. Each inner array in the returned `string[][]` is a single cycle — an ordered sequence of node IDs where the last node has an edge back to the first. The algorithm returns **one representative cycle per back edge**, not an exhaustive enumeration of all simple cycles (which could be exponential). For error reporting, one cycle per problematic region is sufficient.
- **Optimization**: Use `stronglyConnectedComponents()` as a fast pre-check. If there are zero multi-node SCCs (and no self-loops), skip the DFS entirely.
- **Relationship to topologicalOrder**: `topologicalOrder()` throws `CircularDependencyError` (with `cycles` populated from `findCycles`) when the graph is cyclic. This gives consumers the cycle information needed for error reporting.

> See [errors-validation.md](errors-validation.md) for error handling.

## Constraints

- **DAG-propagation is default** — the independent model is opt-in, not the other way around. The independent model is the degenerate case, not the norm.
- **No depth-escalation in v1** — the multiplicative propagation model already captures depth effects implicitly (each hop compounds another `<1.0` factor). Adding an explicit depth penalty would double-count until we have empirical calibration data. See [ADR-005](decisions/005-no-depth-escalation-v1.md).
- **Categorical estimates, not numeric** — The framework uses categorical fields because LLMs reliably distinguish "high vs medium risk" but struggle with "$3.42 vs $3.50". Categoricals remain valid across environments (different models, providers, token costs).