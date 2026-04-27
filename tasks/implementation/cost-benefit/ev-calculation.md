---
id: cost-benefit/ev-calculation
name: Implement calculateTaskEv pure function
status: completed
depends_on:
  - schema/numeric-methods-and-defaults
  - schema/result-types
scope: narrow
risk: low
impact: component
level: implementation
---

## Description

Implement `calculateTaskEv(p, scopeCost, impactWeight, config?): EvResult` in `src/analysis/cost-benefit.ts`. This is the pure math function — takes numeric inputs, returns EV result. No graph dependency.

Per [cost-benefit.md](../../../docs/architecture/cost-benefit.md):
```
EV = P_success × C_success + (1 - P_success) × C_fail
```
Where `C_fail = scopeCost + fallbackCost + timeLost × expectedRetries`.

## Acceptance Criteria

- [ ] `calculateTaskEv(p: number, scopeCost: number, impactWeight: number, config?: EvConfig): EvResult`
- [ ] Returns `EvResult`: `{ ev, pSuccess, expectedRetries }`
- [ ] `expectedRetries` = `(1 - p) / p` when `p > 0`, else 0 (geometric series)
- [ ] `C_fail = scopeCost * impactWeight + fallbackCost + timeLost * expectedRetries` (impactWeight scales the cost)
- [ ] `EV = p * scopeCost * impactWeight + (1-p) * C_fail`
- [ ] When `config.retries` is provided and > 0, caps `expectedRetries` at `retries`
- [ ] When `config.valueRate` is non-zero, multiplies the final EV
- [ ] Edge cases: `p = 0` (guaranteed failure), `p = 1` (guaranteed success), default config (all zeros)
- [ ] Unit tests: known calculations from the Python research model, boundary values, config variations

## References

- docs/architecture/cost-benefit.md — EV formula, EvConfig parameters, EvResult
- docs/architecture/api-surface.md — calculateTaskEv signature
- docs/architecture/schemas.md — EvConfig, EvResult schemas

## Notes

All acceptance criteria verified via 30 unit tests covering formula correctness, edge cases, config variations, and known Python research model values.

## Summary

Implemented `calculateTaskEv` pure function in `src/analysis/cost-benefit.ts`.
- Modified: `src/analysis/cost-benefit.ts` — full implementation of calculateTaskEv
- Modified: `test/cost-benefit.test.ts` — 30 comprehensive unit tests
- Tests: 30, all passing (286 total across suite)
- Lint: clean (tsc --noEmit passes)