---
id: schema/result-types
name: Define analysis result TypeBox schemas (RiskPathResult, DecomposeResult, WorkflowCostResult, etc.)
status: pending
depends_on:
  - schema/enums
scope: narrow
risk: trivial
impact: component
level: implementation
---

## Description

Define all analysis function return type schemas in `src/schema/results.ts`. These are the structured outputs of the cost-benefit and analysis functions. Each schema has both a TypeBox constant and a `Static<typeof>` type alias.

## Acceptance Criteria

- [ ] `src/schema/results.ts` exports all result schemas and types:
  - `RiskPathResult`: `{ path: string[], totalRisk: number }`
  - `DecomposeResult`: `{ shouldDecompose: boolean, reasons: string[] }`
  - `WorkflowCostOptions`: `{ includeCompleted?, limit?, propagationMode?, defaultQualityRetention? }`
  - `WorkflowCostResult`: `{ tasks: [...], totalEv, averageEv, propagationMode }`
  - `EvConfig`: `{ retries?, fallbackCost?, timeLost?, valueRate? }` with defaults (0, 0, 0, 0)
  - `EvResult`: `{ ev, pSuccess, expectedRetries }`
  - `RiskDistributionResult`: `{ trivial, low, medium, high, critical, unspecified }` — each `string[]`
- [ ] All schemas use `Static<typeof>` for type aliases, no manual interface definitions
- [ ] `WorkflowCostOptions.propagationMode` is `Type.Union([Type.Literal("independent"), Type.Literal("dag-propagate")])`
- [ ] Re-exported from `src/schema/index.ts`

## References

- docs/architecture/api-surface.md — return type definitions
- docs/architecture/schemas.md — result schema definitions

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion