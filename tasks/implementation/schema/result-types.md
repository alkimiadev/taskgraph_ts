---
id: schema/result-types
name: Define analysis result TypeBox schemas (RiskPathResult, DecomposeResult, WorkflowCostResult, etc.)
status: completed
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

- [x] `src/schema/results.ts` exports all result schemas and types:
  - `RiskPathResult`: `{ path: string[], totalRisk: number }`
  - `DecomposeResult`: `{ shouldDecompose: boolean, reasons: string[] }`
  - `WorkflowCostOptions`: `{ includeCompleted?, limit?, propagationMode?, defaultQualityRetention? }`
  - `WorkflowCostResult`: `{ tasks: [...], totalEv, averageEv, propagationMode }`
  - `EvConfig`: `{ retries?, fallbackCost?, timeLost?, valueRate? }` with defaults (0, 0, 0, 0)
  - `EvResult`: `{ ev, pSuccess, expectedRetries }`
  - `RiskDistributionResult`: `{ trivial, low, medium, high, critical, unspecified }` — each `string[]`
- [x] All schemas use `Static<typeof>` for type aliases, no manual interface definitions
- [x] `WorkflowCostOptions.propagationMode` is `Type.Union([Type.Literal("independent"), Type.Literal("dag-propagate")])`
- [x] Re-exported from `src/schema/index.ts`

## References

- docs/architecture/api-surface.md — return type definitions
- docs/architecture/schemas.md — result schema definitions

## Notes

All schemas follow the TypeBox-as-single-source-of-truth pattern. WorkflowCostTaskEntry is an internal schema (not exported) used within WorkflowCostResult's tasks array. EvConfig fields use `Type.Number({ default: 0 })` per architecture spec for defaults. The `WorkflowCostOptions.propagationMode` is correctly a `Type.Union` of two `Type.Literal` values as specified. Results.js was already re-exported from index.ts.

## Summary

Implemented all 7 analysis result TypeBox schemas with `Static<typeof>` type aliases.
- Created: `src/schema/results.ts` (7 schema constants + 7 type aliases + 1 internal WorkflowCostTaskEntry)
- Modified: `test/schema.test.ts` (46 new tests: 39 runtime validation + 7 compile-time type alias verification)
- Tests: 137 total, all passing; `tsc --noEmit` clean