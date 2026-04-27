---
id: schema/numeric-methods-and-defaults
name: Implement categorical numeric functions and resolveDefaults
status: completed
depends_on:
  - schema/enums
  - schema/graph-schemas
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Implement the standalone numeric functions that map categorical enum values to their numeric equivalents, plus `resolveDefaults` which fills in defaults for unassessed fields and computes derived numeric values. These live in `src/analysis/defaults.ts` per the project structure.

## Acceptance Criteria

- [ ] `src/analysis/defaults.ts` exports:
  - `scopeCostEstimate(scope: TaskScope): number` — maps to 1.0–5.0 per table
  - `scopeTokenEstimate(scope: TaskScope): number` — maps to 500–10000 per table
  - `riskSuccessProbability(risk: TaskRisk): number` — maps to 0.50–0.98 per table
  - `riskWeight(risk: TaskRisk): number` — maps to 0.02–0.50 (equals 1 - successProbability)
  - `impactWeight(impact: TaskImpact): number` — maps to 1.0–3.0 per table
  - `resolveDefaults(attrs: Partial<TaskGraphNodeAttributes> & Pick<TaskGraphNodeAttributes, 'name'>): ResolvedTaskAttributes`
- [ ] All numeric mapping tables match [schemas.md](../../../docs/architecture/schemas.md) exactly:
  - Scope: single=1.0/500, narrow=2.0/1500, moderate=3.0/3000, broad=4.0/6000, system=5.0/10000
  - Risk: trivial=0.98/0.02, low=0.90/0.10, medium=0.80/0.20, high=0.65/0.35, critical=0.50/0.50
  - Impact: isolated=1.0, component=1.5, phase=2.0, project=3.0
- [ ] `resolveDefaults` handles null/undefined categorical fields by falling back to: risk→medium, scope→narrow, impact→isolated
- [ ] `resolveDefaults` populates derived fields: costEstimate, tokenEstimate, successProbability, riskWeight, impactWeight
- [ ] Label-only fields (level, priority, status) remain nullable after resolution — no default value assigned
- [ ] `riskWeight(risk)` equals `1 - riskSuccessProbability(risk)` — guaranteed by implementation
- [ ] Unit tests covering every enum value's numeric mapping and resolveDefaults with mixed null/present inputs

## References

- docs/architecture/schemas.md — numeric method tables, ResolvedTaskAttributes definition
- docs/architecture/graph-model.md — categorical field defaults

## Notes

Floating-point comparison in tests uses `toBeCloseTo` for riskWeight and successProbability due to IEEE 754 precision (e.g., 1 - 0.98 = 0.020000000000000018).

## Summary

Implemented categorical numeric functions and resolveDefaults.
- Modified: `src/analysis/defaults.ts` — 5 standalone numeric functions (scopeCostEstimate, scopeTokenEstimate, riskSuccessProbability, riskWeight, impactWeight) + resolveDefaults
- Modified: `src/schema/results.ts` — added ResolvedTaskAttributes TypeBox schema and type alias
- Created: `test/defaults.test.ts` — 30 tests covering every enum value mapping and resolveDefaults with mixed null/present inputs
- Tests: 30 new, all 218 total passing; lint clean