import type { EvConfig, EvResult } from "../schema/results.js";

/**
 * Calculate the expected value (EV) of a task.
 *
 * Pure math function — takes numeric inputs, returns EV result.
 * No graph dependency.
 *
 * Formula:
 *   expectedRetries = (1 - p) / p  when p > 0, else 0  (geometric series)
 *   C_success = scopeCost * impactWeight
 *   C_fail    = scopeCost * impactWeight + fallbackCost + timeLost * expectedRetries
 *   EV        = p * C_success + (1 - p) * C_fail
 *
 * When `config.retries` is provided and > 0, `expectedRetries` is capped at `retries`.
 * When `config.valueRate` is non-zero, the final EV is multiplied by `valueRate`.
 *
 * @param p - Probability of success (0 to 1)
 * @param scopeCost - Cost estimate from scope (1.0–5.0)
 * @param impactWeight - Impact weight (1.0–3.0)
 * @param config - Optional configuration: retries, fallbackCost, timeLost, valueRate
 * @returns EvResult with ev, pSuccess, and expectedRetries
 */
export function calculateTaskEv(
  p: number,
  scopeCost: number,
  impactWeight: number,
  config?: EvConfig,
): EvResult {
  const retries = config?.retries ?? 0;
  const fallbackCost = config?.fallbackCost ?? 0;
  const timeLost = config?.timeLost ?? 0;
  const valueRate = config?.valueRate ?? 0;

  // Expected retries: geometric series (1-p)/p when p > 0
  let expectedRetries = p > 0 ? (1 - p) / p : 0;

  // Cap at configured max retries when retries > 0
  if (retries > 0 && expectedRetries > retries) {
    expectedRetries = retries;
  }

  // C_success and C_fail: impactWeight scales scopeCost
  const cSuccess = scopeCost * impactWeight;
  const cFail = scopeCost * impactWeight + fallbackCost + timeLost * expectedRetries;

  // EV = P_success * C_success + (1 - P_success) * C_fail
  let ev = p * cSuccess + (1 - p) * cFail;

  // Apply value rate conversion when configured
  if (valueRate !== 0) {
    ev = ev * valueRate;
  }

  return { ev, pSuccess: p, expectedRetries };
}

// Placeholder for future implementation
// export function workflowCost(...)  { ... }
// export function computeEffectiveP(...) { ... }