import { describe, it, expect } from "vitest";
import { calculateTaskEv } from "../src/analysis/cost-benefit.js";

// ---------------------------------------------------------------------------
// calculateTaskEv — pure function tests
// ---------------------------------------------------------------------------

describe("calculateTaskEv", () => {
  // --- Basic formula verification ---

  it("computes EV with default config (all zeros): C_fail = C_success", () => {
    // When fallbackCost=0, timeLost=0, retries=0 → expectedRetries=0
    // C_success = scopeCost * impactWeight
    // C_fail = scopeCost * impactWeight + 0 + 0 = C_success
    // EV = p * C_success + (1-p) * C_success = C_success
    const result = calculateTaskEv(0.8, 3.0, 1.5);

    expect(result.pSuccess).toBe(0.8);
    expect(result.expectedRetries).toBeCloseTo(0.25); // (1-0.8)/0.8 = 0.25
    expect(result.ev).toBeCloseTo(3.0 * 1.5); // 4.5 — both terms equal C_success
  });

  it("computes EV = C_success when p = 1 (guaranteed success)", () => {
    const result = calculateTaskEv(1.0, 4.0, 2.0);

    expect(result.pSuccess).toBe(1.0);
    expect(result.expectedRetries).toBeCloseTo(0); // (1-1)/1 = 0
    expect(result.ev).toBeCloseTo(4.0 * 2.0); // 8.0 — only success term
  });

  it("computes EV = C_fail when p = 0 (guaranteed failure)", () => {
    // When p=0, expectedRetries=0, so with default config:
    // C_fail = scopeCost * impactWeight + 0 + 0 = scopeCost * impactWeight
    // EV = 0 * C_success + 1 * C_fail = C_fail
    const result = calculateTaskEv(0, 3.0, 1.5);

    expect(result.pSuccess).toBe(0);
    expect(result.expectedRetries).toBe(0); // p=0 → 0
    expect(result.ev).toBeCloseTo(3.0 * 1.5); // 4.5 — only failure term
  });

  it("computes EV = C_fail when p = 0 with fallback cost", () => {
    const result = calculateTaskEv(0, 3.0, 1.5, { fallbackCost: 10, timeLost: 5 });

    expect(result.pSuccess).toBe(0);
    expect(result.expectedRetries).toBe(0); // p=0 → 0, no retries
    // C_fail = 3.0*1.5 + 10 + 5*0 = 4.5 + 10 + 0 = 14.5
    expect(result.ev).toBeCloseTo(14.5);
  });

  // --- Geometric series for expectedRetries ---

  it("computes expectedRetries as (1-p)/p for various p values", () => {
    const cases: [number, number][] = [
      [0.98, 0.02 / 0.98],    // trivial risk
      [0.90, 0.10 / 0.90],    // low risk
      [0.80, 0.20 / 0.80],    // medium risk → 0.25
      [0.65, 0.35 / 0.65],    // high risk
      [0.50, 0.50 / 0.50],    // critical risk → 1.0
    ];

    for (const [p, expectedRetries] of cases) {
      const result = calculateTaskEv(p, 1.0, 1.0);
      expect(result.expectedRetries).toBeCloseTo(expectedRetries);
    }
  });

  // --- Impact weight scaling ---

  it("impactWeight scales scopeCost in both C_success and C_fail (default config)", () => {
    // With default config (no fallback/retry costs), both terms = scopeCost * impactWeight
    const result1 = calculateTaskEv(0.8, 3.0, 1.0); // isolated
    const result2 = calculateTaskEv(0.8, 3.0, 1.5); // component
    const result3 = calculateTaskEv(0.8, 3.0, 3.0); // project

    // All EVs should be scopeCost * impactWeight (since C_fail = C_success with default config)
    expect(result1.ev).toBeCloseTo(3.0 * 1.0); // 3.0
    expect(result2.ev).toBeCloseTo(3.0 * 1.5); // 4.5
    expect(result3.ev).toBeCloseTo(3.0 * 3.0); // 9.0
  });

  // --- Fallback cost ---

  it("adds fallbackCost to the failure term", () => {
    const fallbackCost = 20;
    const result = calculateTaskEv(0.5, 2.0, 1.0, { fallbackCost });

    // C_success = 2.0 * 1.0 = 2.0
    // expectedRetries = (1-0.5)/0.5 = 1.0
    // C_fail = 2.0 + 20 + 0 * 1.0 = 22.0
    // EV = 0.5 * 2.0 + 0.5 * 22.0 = 1.0 + 11.0 = 12.0
    expect(result.ev).toBeCloseTo(12.0);
  });

  // --- Time lost per retry ---

  it("adds timeLost * expectedRetries to the failure term", () => {
    const result = calculateTaskEv(0.5, 2.0, 1.0, { timeLost: 5 });

    // expectedRetries = 1.0
    // C_fail = 2.0 + 0 + 5 * 1.0 = 7.0
    // EV = 0.5 * 2.0 + 0.5 * 7.0 = 1.0 + 3.5 = 4.5
    expect(result.ev).toBeCloseTo(4.5);
  });

  it("combines fallbackCost and timeLost in C_fail", () => {
    const result = calculateTaskEv(0.8, 3.0, 1.5, {
      fallbackCost: 10,
      timeLost: 5,
    });

    // expectedRetries = 0.25
    // C_success = 3.0 * 1.5 = 4.5
    // C_fail = 4.5 + 10 + 5 * 0.25 = 15.75
    // EV = 0.8 * 4.5 + 0.2 * 15.75 = 3.6 + 3.15 = 6.75
    expect(result.ev).toBeCloseTo(6.75);
  });

  // --- Retries cap ---

  it("caps expectedRetries at config.retries when retries > 0", () => {
    // p=0.5 → expectedRetries = 1.0, but config.retries = 3 → capped at 1.0 (below cap)
    const result1 = calculateTaskEv(0.5, 2.0, 1.0, { retries: 3, timeLost: 5 });
    expect(result1.expectedRetries).toBeCloseTo(1.0); // not capped

    // p=0.2 → expectedRetries = 4.0, config.retries = 2 → capped at 2
    const result2 = calculateTaskEv(0.2, 2.0, 1.0, { retries: 2, timeLost: 5 });
    expect(result2.expectedRetries).toBe(2); // capped

    // C_fail with cap: 2.0 + 0 + 5 * 2 = 12.0
    // EV = 0.2 * 2.0 + 0.8 * 12.0 = 0.4 + 9.6 = 10.0
    expect(result2.ev).toBeCloseTo(10.0);
  });

  it("does not cap expectedRetries when retries = 0 (default)", () => {
    // p=0.2 → expectedRetries = 4.0
    const result = calculateTaskEv(0.2, 2.0, 1.0);
    expect(result.expectedRetries).toBeCloseTo(4.0);
  });

  it("respects retries cap with low probability and large expectedRetries", () => {
    // p=0.1 → expectedRetries = 9.0, retries=1 → capped at 1
    const result = calculateTaskEv(0.1, 2.0, 1.0, { retries: 1, timeLost: 3 });

    expect(result.expectedRetries).toBe(1); // capped
    // C_fail = 2.0 + 0 + 3 * 1 = 5.0
    // EV = 0.1 * 2.0 + 0.9 * 5.0 = 0.2 + 4.5 = 4.7
    expect(result.ev).toBeCloseTo(4.7);
  });

  // --- Value rate conversion ---

  it("multiplies final EV by valueRate when non-zero", () => {
    const result = calculateTaskEv(0.8, 3.0, 1.0, { valueRate: 100 });

    // Without valueRate: EV = 3.0 (default config, C_fail = C_success)
    // With valueRate: EV = 3.0 * 100 = 300
    expect(result.ev).toBeCloseTo(300);
  });

  it("does not multiply by valueRate when valueRate is 0 (default)", () => {
    const result = calculateTaskEv(0.8, 3.0, 1.0);

    // EV = scopeCost * impactWeight * 1.0 = 3.0
    expect(result.ev).toBeCloseTo(3.0);
  });

  it("applies valueRate after full EV calculation including fallback and time costs", () => {
    const result = calculateTaskEv(0.5, 2.0, 1.0, {
      fallbackCost: 10,
      timeLost: 5,
      valueRate: 10,
    });

    // expectedRetries = 1.0
    // C_success = 2.0
    // C_fail = 2.0 + 10 + 5 * 1.0 = 17.0
    // EV_raw = 0.5 * 2.0 + 0.5 * 17.0 = 1.0 + 8.5 = 9.5
    // EV = 9.5 * 10 = 95
    expect(result.ev).toBeCloseTo(95);
  });

  // --- Known calculations from Python research model ---

  it("matches Python research model: medium risk + narrow scope + isolated impact (default task)", () => {
    // p=0.80, scopeCost=2.0 (narrow), impactWeight=1.0 (isolated)
    // No retry costs in simplest case → EV = scopeCost * impactWeight = 2.0
    const result = calculateTaskEv(0.80, 2.0, 1.0);

    expect(result.pSuccess).toBeCloseTo(0.80);
    expect(result.expectedRetries).toBeCloseTo(0.25);
    expect(result.ev).toBeCloseTo(2.0);
  });

  it("matches Python research model: high risk + broad scope + component impact with retries", () => {
    // p=0.65, scopeCost=4.0 (broad), impactWeight=1.5 (component)
    // With retries=3, timeLost=2, fallbackCost=8
    const result = calculateTaskEv(0.65, 4.0, 1.5, {
      retries: 3,
      timeLost: 2,
      fallbackCost: 8,
    });

    // expectedRetries = (1-0.65)/0.65 = 0.538... → not capped (below 3)
    expect(result.expectedRetries).toBeCloseTo(0.35 / 0.65);

    const p = 0.65;
    const cSuccess = 4.0 * 1.5; // = 6.0
    const cFail = 6.0 + 8 + 2 * (0.35 / 0.65); // = 14 + 1.0769... = 15.0769...
    const expectedEv = p * cSuccess + (1 - p) * cFail;

    expect(result.ev).toBeCloseTo(expectedEv);
  });

  it("matches Python research model: critical risk + system scope + project impact", () => {
    // p=0.50, scopeCost=5.0 (system), impactWeight=3.0 (project)
    const result = calculateTaskEv(0.50, 5.0, 3.0);

    expect(result.pSuccess).toBeCloseTo(0.50);
    expect(result.expectedRetries).toBeCloseTo(1.0);
    // Default config: C_fail = C_success = 5.0 * 3.0 = 15.0
    expect(result.ev).toBeCloseTo(15.0);
  });

  it("matches Python research model: trivial risk + single scope + isolated impact", () => {
    // p=0.98, scopeCost=1.0 (single), impactWeight=1.0 (isolated)
    const result = calculateTaskEv(0.98, 1.0, 1.0);

    expect(result.pSuccess).toBeCloseTo(0.98);
    expect(result.expectedRetries).toBeCloseTo(0.02 / 0.98);
    expect(result.ev).toBeCloseTo(1.0);
  });

  // --- Boundary values ---

  it("handles very small p > 0", () => {
    const result = calculateTaskEv(0.01, 1.0, 1.0);

    expect(result.pSuccess).toBe(0.01);
    expect(result.expectedRetries).toBeCloseTo(0.99 / 0.01); // = 99
    // Default config: C_fail = C_success = 1.0
    expect(result.ev).toBeCloseTo(1.0);
  });

  it("handles p very close to 1", () => {
    const result = calculateTaskEv(0.999, 1.0, 1.0);

    expect(result.expectedRetries).toBeCloseTo(0.001 / 0.999);
    expect(result.ev).toBeCloseTo(1.0);
  });

  it("returns zero EV when scopeCost is 0", () => {
    const result = calculateTaskEv(0.5, 0, 1.0);

    // C_success = 0, C_fail = 0 + 0 + 0 = 0
    expect(result.ev).toBe(0);
  });

  it("returns zero EV when impactWeight is 0 and no fallback costs", () => {
    const result = calculateTaskEv(0.5, 5.0, 0);

    // C_success = 0, C_fail = 0 + 0 + 0 = 0
    expect(result.ev).toBe(0);
  });

  it("preserves p as pSuccess in the result without modification", () => {
    expect(calculateTaskEv(0.75, 2.0, 1.0).pSuccess).toBe(0.75);
    expect(calculateTaskEv(0, 2.0, 1.0).pSuccess).toBe(0);
    expect(calculateTaskEv(1, 2.0, 1.0).pSuccess).toBe(1);
  });

  // --- Config variations ---

  it("undefined config defaults all fields to 0", () => {
    const result = calculateTaskEv(0.5, 2.0, 1.0, undefined);

    expect(result.expectedRetries).toBeCloseTo(1.0);
    expect(result.ev).toBeCloseTo(2.0);
  });

  it("empty config object defaults all fields to 0", () => {
    const result = calculateTaskEv(0.5, 2.0, 1.0, {});

    expect(result.expectedRetries).toBeCloseTo(1.0);
    expect(result.ev).toBeCloseTo(2.0);
  });

  it("partial config: only retries set", () => {
    const result = calculateTaskEv(0.2, 2.0, 1.0, { retries: 1 });

    // expectedRetries = (1-0.2)/0.2 = 4, capped at 1
    expect(result.expectedRetries).toBe(1);
    // C_success = 2.0, C_fail = 2.0 + 0 + 0 * 1 = 2.0
    // EV = 0.2 * 2.0 + 0.8 * 2.0 = 0.4 + 1.6 = 2.0
    expect(result.ev).toBeCloseTo(2.0);
  });

  it("partial config: only fallbackCost set", () => {
    const result = calculateTaskEv(0.5, 2.0, 1.0, { fallbackCost: 5 });

    // expectedRetries = 1.0 but timeLost=0 → retry cost = 0
    // C_fail = 2.0 + 5 + 0 = 7.0
    // EV = 0.5 * 2.0 + 0.5 * 7.0 = 1.0 + 3.5 = 4.5
    expect(result.ev).toBeCloseTo(4.5);
  });

  it("partial config: only timeLost set (no effect without retries generating cost)", () => {
    const result = calculateTaskEv(0.5, 2.0, 1.0, { timeLost: 10 });

    // expectedRetries = 1.0
    // C_fail = 2.0 + 0 + 10 * 1.0 = 12.0
    // EV = 0.5 * 2.0 + 0.5 * 12.0 = 1.0 + 6.0 = 7.0
    expect(result.ev).toBeCloseTo(7.0);
  });

  it("full config with all parameters", () => {
    const result = calculateTaskEv(0.5, 2.0, 1.5, {
      retries: 2,
      fallbackCost: 10,
      timeLost: 3,
      valueRate: 50,
    });

    // expectedRetries = (1-0.5)/0.5 = 1.0, not capped (below 2)
    expect(result.expectedRetries).toBeCloseTo(1.0);

    // C_success = 2.0 * 1.5 = 3.0
    // C_fail = 3.0 + 10 + 3 * 1.0 = 16.0
    // EV_raw = 0.5 * 3.0 + 0.5 * 16.0 = 1.5 + 8.0 = 9.5
    // EV = 9.5 * 50 = 475.0
    expect(result.ev).toBeCloseTo(475.0);
  });
});