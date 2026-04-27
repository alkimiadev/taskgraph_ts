---
id: cost-benefit/risk-analysis
name: Implement riskPath, riskDistribution, and shouldDecomposeTask functions
status: pending
depends_on:
  - cost-benefit/ev-calculation
  - analysis/critical-path
  - schema/numeric-methods-and-defaults
scope: moderate
risk: low
impact: component
level: implementation
---

## Description

Implement the three risk analysis functions: `riskPath`, `riskDistribution`, and `shouldDecomposeTask`. These are standalone composable functions that serve different analysis use cases.

## Acceptance Criteria

- [ ] `riskPath(graph: TaskGraph): RiskPathResult`:
  - Calls `weightedCriticalPath` with weight function `riskWeight * impactWeight`
  - Returns `{ path: string[], totalRisk: number }`
  - `totalRisk` is the sum of weight values along the path
- [ ] `riskDistribution(graph: TaskGraph): RiskDistributionResult`:
  - Groups all tasks by their `risk` attribute
  - Returns `{ trivial: string[], low: string[], medium: string[], high: string[], critical: string[], unspecified: string[] }`
  - Tasks with `risk: undefined` (not assessed) go in `unspecified`
  - No duplicate task IDs in any bucket
- [ ] `shouldDecomposeTask(attrs: TaskGraphNodeAttributes): DecomposeResult`:
  - Pure function — takes node attributes (not a graph)
  - Internally calls `resolveDefaults` for `risk` and `scope` (nullable fields)
  - Flags decomposition when: risk >= "high" OR scope >= "broad"
  - Returns `{ shouldDecompose: boolean, reasons: string[] }`
  - Unassessed tasks (null/undefined risk or scope) are never flagged — default values are below threshold
  - Provides specific reasons: e.g., `"risk: high — failure probability 0.35"`, `"scope: broad — cost estimate 4.0"`
- [ ] Unit tests for all three functions with known inputs/outputs

## References

- docs/architecture/api-surface.md — risk analysis functions
- docs/architecture/cost-benefit.md — riskPath, riskDistribution, shouldDecomposeTask, decomposition threshold

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion