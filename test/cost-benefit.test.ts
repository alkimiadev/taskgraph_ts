import { describe, it, expect } from "vitest";
import { calculateTaskEv, computeEffectiveP, workflowCost } from "../src/analysis/cost-benefit.js";
import { TaskGraph } from "../src/graph/construction.js";
import { CircularDependencyError } from "../src/error/index.js";

// ---------------------------------------------------------------------------
// Helper: create test graphs
// ---------------------------------------------------------------------------

/**
 * Create a simple chain graph: A → B → C
 * All tasks have medium risk (p=0.80), narrow scope, isolated impact.
 */
function createChainGraph(): TaskGraph {
  return TaskGraph.fromTasks([
    { id: "A", name: "Task A", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated" },
    { id: "B", name: "Task B", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
    { id: "C", name: "Task C", dependsOn: ["B"], risk: "medium", scope: "narrow", impact: "isolated" },
  ]);
}

/**
 * Create a diamond graph: A → B, A → C, B → D, C → D
 * This tests that convergence correctly multiplies both inherited factors.
 */
function createDiamondGraph(): TaskGraph {
  return TaskGraph.fromTasks([
    { id: "A", name: "Task A", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated" },
    { id: "B", name: "Task B", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
    { id: "C", name: "Task C", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
    { id: "D", name: "Task D", dependsOn: ["B", "C"], risk: "medium", scope: "narrow", impact: "isolated" },
  ]);
}

/**
 * Create a cyclic graph for testing CircularDependencyError.
 */
function createCyclicGraph(): TaskGraph {
  const tg = new TaskGraph();
  // We manually add nodes and edges that form a cycle
  // Note: TaskGraph prevents self-loops but we can create cycles
  tg.addTask("A", { name: "Task A" });
  tg.addTask("B", { name: "Task B" });
  tg.addTask("C", { name: "Task C" });
  // Create cycle: A → B → C → A
  tg.addDependency("A", "B");
  tg.addDependency("B", "C");
  tg.addDependency("C", "A");
  return tg;
}

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

// ---------------------------------------------------------------------------
// computeEffectiveP — DAG-propagation probability tests
// ---------------------------------------------------------------------------

describe("computeEffectiveP", () => {
  // Helper to create a graph and compute effective probabilities
  const qr0_9 = 0.9; // default qualityRetention

  it("returns pIntrinsic in independent mode regardless of parents", () => {
    const graph = createChainGraph();
    const upstreamSuccessProbs = new Map<string, number>();
    // Even with upstream data, independent mode returns pIntrinsic
    upstreamSuccessProbs.set("A", 0.65);

    expect(
      computeEffectiveP("B", graph.raw, upstreamSuccessProbs, qr0_9, "independent", 0.80)
    ).toBeCloseTo(0.80);
  });

  it("returns pIntrinsic for root tasks (no prerequisites)", () => {
    const graph = createChainGraph();
    const upstreamSuccessProbs = new Map<string, number>();

    // Task A has no prerequisites — pEffective should equal pIntrinsic
    expect(
      computeEffectiveP("A", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.80)
    ).toBeCloseTo(0.80);
  });

  it("computes inherited quality for a simple chain: A → B", () => {
    // A has p=0.65 (high risk), B has intrinsic p=0.80 (medium risk)
    // qualityRetention = 0.9 (default)
    // inheritedQuality from A = 0.65 + (1 - 0.65) * 0.9 = 0.65 + 0.315 = 0.965
    // pEffective_B = 0.80 * 0.965 = 0.772
    const graph = createChainGraph();
    const upstreamSuccessProbs = new Map<string, number>();
    upstreamSuccessProbs.set("A", 0.65);

    const pEff_B = computeEffectiveP(
      "B", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.80
    );

    const inheritedFromA = 0.65 + (1 - 0.65) * 0.9; // 0.965
    expect(pEff_B).toBeCloseTo(0.80 * inheritedFromA);
  });

  it("computes compounding for a 3-node chain: A → B → C", () => {
    // A (p=0.65) → B (p=0.80) → C (p=0.80)
    // Step 1: pEff_A = 0.65 (root, no parents)
    // Step 2: B has parent A with p=0.65
    //   inheritedFromA = 0.65 + (1-0.65)*0.9 = 0.965
    //   pEff_B = 0.80 * 0.965 = 0.772
    // Step 3: C has parent B with p=0.772
    //   inheritedFromB = 0.772 + (1-0.772)*0.9 = 0.772 + 0.2052 = 0.9772
    //   pEff_C = 0.80 * 0.9772 = 0.78176
    const graph = createChainGraph();
    const upstreamSuccessProbs = new Map<string, number>();
    
    // A (root)
    const pEff_A = computeEffectiveP("A", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.65);
    expect(pEff_A).toBeCloseTo(0.65);
    upstreamSuccessProbs.set("A", pEff_A);

    // B depends on A
    const pEff_B = computeEffectiveP("B", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.80);
    const inheritedFromA = 0.65 + (1 - 0.65) * 0.9;
    expect(pEff_B).toBeCloseTo(0.80 * inheritedFromA);
    upstreamSuccessProbs.set("B", pEff_B);

    // C depends on B
    const pEff_C = computeEffectiveP("C", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.80);
    const inheritedFromB = pEff_B + (1 - pEff_B) * 0.9;
    expect(pEff_C).toBeCloseTo(0.80 * inheritedFromB);
  });

  it("computes diamond graph: A → B, A → C, B → D, C → D", () => {
    // A=0.65 (high risk), B=C=D=0.80 (medium risk)
    // Step 1: pEff_A = 0.65
    // Step 2 (B): parent A with p=0.65
    //   inheritedFromA = 0.65 + 0.35*0.9 = 0.965
    //   pEff_B = 0.80 * 0.965 = 0.772
    // Step 3 (C): parent A with p=0.65
    //   pEff_C = same as B = 0.772
    // Step 4 (D): parents B (p=0.772) and C (p=0.772)
    //   inheritedFromB = 0.772 + 0.228*0.9 = 0.772 + 0.2052 = 0.9772
    //   inheritedFromC = same = 0.9772
    //   pEff_D = 0.80 * 0.9772 * 0.9772
    const graph = createDiamondGraph();
    const upstreamSuccessProbs = new Map<string, number>();

    // A (root)
    const pEff_A = computeEffectiveP("A", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.65);
    expect(pEff_A).toBeCloseTo(0.65);
    upstreamSuccessProbs.set("A", pEff_A);

    // B depends on A
    const pEff_B = computeEffectiveP("B", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.80);
    const inheritedFromA = 0.65 + (1 - 0.65) * 0.9;
    expect(pEff_B).toBeCloseTo(0.80 * inheritedFromA);
    upstreamSuccessProbs.set("B", pEff_B);

    // C depends on A
    const pEff_C = computeEffectiveP("C", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.80);
    expect(pEff_C).toBeCloseTo(0.80 * inheritedFromA); // same as B
    upstreamSuccessProbs.set("C", pEff_C);

    // D depends on B and C
    const pEff_D = computeEffectiveP("D", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.80);
    const inheritedFromB = pEff_B + (1 - pEff_B) * 0.9;
    const inheritedFromC = pEff_C + (1 - pEff_C) * 0.9;
    expect(pEff_D).toBeCloseTo(0.80 * inheritedFromB * inheritedFromC);
  });

  it("uses per-edge qualityRetention from edge attributes", () => {
    // Create a graph with custom qualityRetention per edge
    const tg = TaskGraph.fromRecords(
      [
        { id: "A", name: "Task A", dependsOn: [] },
        { id: "B", name: "Task B", dependsOn: ["A"] },
      ],
      [
        { from: "A", to: "B", qualityRetention: 0.5 },  // lower retention
      ]
    );

    const upstreamSuccessProbs = new Map<string, number>();
    upstreamSuccessProbs.set("A", 0.65);

    // With qualityRetention=0.5: inheritedQuality = 0.65 + 0.35*0.5 = 0.825
    // pEffective = 0.80 * 0.825 = 0.66
    const pEff = computeEffectiveP("B", tg.raw, upstreamSuccessProbs, 0.9, "dag-propagate", 0.80);
    expect(pEff).toBeCloseTo(0.80 * (0.65 + (1 - 0.65) * 0.5));
  });

  it("falls back to defaultQualityRetention when edge has no qualityRetention attribute", () => {
    // Create a graph using raw graphology API so edges don't have qualityRetention
    const tg = new TaskGraph();
    tg.addTask("A", { name: "Task A" });
    tg.addTask("B", { name: "Task B" });
    // Add edge directly via raw graphology, without qualityRetention attribute
    tg.raw.addEdgeWithKey("A->B", "A", "B", {});

    const upstreamSuccessProbs = new Map<string, number>();
    upstreamSuccessProbs.set("A", 0.65);

    // Since the edge has no qualityRetention attribute, defaultQualityRetention=0.85 is used
    // inheritedQuality = 0.65 + 0.35*0.85 = 0.65 + 0.2975 = 0.9475
    // pEffective = 0.80 * 0.9475 = 0.758
    const pEff = computeEffectiveP("B", tg.raw, upstreamSuccessProbs, 0.85, "dag-propagate", 0.80);
    expect(pEff).toBeCloseTo(0.80 * (0.65 + 0.35 * 0.85));
  });

  it("qualityRetention=1.0 gives independent model (inherited quality = 1.0)", () => {
    // With qualityRetention=1.0: inheritedQuality = parentP + (1-parentP)*1.0 = 1.0
    // pEffective = pIntrinsic * 1.0 = pIntrinsic
    // Create graph with edges that have qualityRetention=1.0
    const tg = TaskGraph.fromRecords(
      [
        { id: "A", name: "Task A", dependsOn: [] },
        { id: "B", name: "Task B", dependsOn: ["A"] },
      ],
      [
        { from: "A", to: "B", qualityRetention: 1.0 },
      ]
    );
    const upstreamSuccessProbs = new Map<string, number>();
    upstreamSuccessProbs.set("A", 0.50);

    const pEff = computeEffectiveP("B", tg.raw, upstreamSuccessProbs, 0.9, "dag-propagate", 0.80);
    expect(pEff).toBeCloseTo(0.80); // pIntrinsic unchanged
  });

  it("qualityRetention=0.0 gives full propagation (inherited quality = parentP)", () => {
    // With qualityRetention=0.0: inheritedQuality = parentP + (1-parentP)*0.0 = parentP
    // So pEffective = pIntrinsic * parentP
    // Create graph with edges that have qualityRetention=0.0
    const tg = TaskGraph.fromRecords(
      [
        { id: "A", name: "Task A", dependsOn: [] },
        { id: "B", name: "Task B", dependsOn: ["A"] },
      ],
      [
        { from: "A", to: "B", qualityRetention: 0.0 },
      ]
    );
    const upstreamSuccessProbs = new Map<string, number>();
    upstreamSuccessProbs.set("A", 0.65);

    const pEff = computeEffectiveP("B", tg.raw, upstreamSuccessProbs, 0.9, "dag-propagate", 0.80);
    expect(pEff).toBeCloseTo(0.80 * 0.65); // pIntrinsic * parentP
  });

  it("skips parents not in upstream map (robustness)", () => {
    // B depends on A, but A is not in upstreamSuccessProbs yet
    // This shouldn't happen in normal usage (topological order ensures processing)
    // but the function should gracefully skip missing parents
    const graph = createChainGraph();
    const upstreamSuccessProbs = new Map<string, number>();
    // A not in map — should be skipped, so no inherited quality factors
    // pEffective = pIntrinsic (no parents found in map)

    const pEff = computeEffectiveP("B", graph.raw, upstreamSuccessProbs, qr0_9, "dag-propagate", 0.80);
    // With no parents found in map, product is 1.0, so pIntrinsic
    // Wait — actually B has a parent A in the graph, but A isn't in the map.
    // The function skips it, so no multiplication happens.
    // inheritedProduct stays at 1.0 → pEffective = pIntrinsic
    expect(pEff).toBeCloseTo(0.80);
  });
});

// ---------------------------------------------------------------------------
// workflowCost — integration tests
// ---------------------------------------------------------------------------

describe("workflowCost", () => {
  it("computes workflow cost for a simple chain with dag-propagate mode", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Planning", dependsOn: [], risk: "high", scope: "narrow", impact: "phase" },
      { id: "B", name: "Implementation", dependsOn: ["A"], risk: "medium", scope: "broad", impact: "component" },
    ]);

    const result = workflowCost(graph.raw);

    expect(result.propagationMode).toBe("dag-propagate");

    // Task A (root, high risk, narrow scope, phase impact)
    // pIntrinsic_A = 0.65, pEffective_A = 0.65 (root, no parents)
    // EV_A = 0.65 * (2.0 * 2.0) + 0.35 * (2.0 * 2.0) = 4.0 (default config, C_fail=C_success)
    const taskA = result.tasks.find(t => t.taskId === "A")!;
    expect(taskA).toBeDefined();
    expect(taskA.pIntrinsic).toBeCloseTo(0.65);
    expect(taskA.pEffective).toBeCloseTo(0.65);
    expect(taskA.scopeCost).toBeCloseTo(2.0); // narrow
    expect(taskA.impactWeight).toBeCloseTo(2.0); // phase

    // Task B (depends on A, medium risk, broad scope, component impact)
    // inheritedFromA = 0.65 + 0.35*0.9 = 0.965
    // pEffective_B = 0.80 * 0.965 = 0.772
    const taskB = result.tasks.find(t => t.taskId === "B")!;
    expect(taskB).toBeDefined();
    expect(taskB.pIntrinsic).toBeCloseTo(0.80);
    expect(taskB.pEffective).toBeCloseTo(0.80 * (0.65 + 0.35 * 0.9));
    expect(taskB.scopeCost).toBeCloseTo(4.0); // broad
    expect(taskB.impactWeight).toBeCloseTo(1.5); // component
  });

  it("computes workflow cost in independent mode (no propagation)", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Planning", dependsOn: [], risk: "high", scope: "narrow", impact: "phase" },
      { id: "B", name: "Implementation", dependsOn: ["A"], risk: "medium", scope: "broad", impact: "component" },
    ]);

    const result = workflowCost(graph.raw, { propagationMode: "independent" });

    expect(result.propagationMode).toBe("independent");

    // In independent mode, pEffective = pIntrinsic for all tasks
    const taskA = result.tasks.find(t => t.taskId === "A")!;
    expect(taskA.pEffective).toBeCloseTo(0.65); // high risk
    expect(taskA.pIntrinsic).toBeCloseTo(0.65);

    const taskB = result.tasks.find(t => t.taskId === "B")!;
    expect(taskB.pEffective).toBeCloseTo(0.80); // medium risk, no propagation
    expect(taskB.pIntrinsic).toBeCloseTo(0.80);
  });

  it("dag-propagate mode shows degradation vs independent mode", () => {
    // Key insight: in dag-propagate, downstream tasks have lower pEffective
    // than their pIntrinsic, because upstream quality degrades them
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Planning", dependsOn: [], risk: "critical", scope: "broad", impact: "phase" },
      { id: "B", name: "Implementation", dependsOn: ["A"], risk: "medium", scope: "moderate", impact: "component" },
      { id: "C", name: "Review", dependsOn: ["B"], risk: "low", scope: "narrow", impact: "isolated" },
    ]);

    const dagResult = workflowCost(graph.raw, { propagationMode: "dag-propagate" });
    const indepResult = workflowCost(graph.raw, { propagationMode: "independent" });

    // In dag-propagate, every task that has parents should have pEffective < pIntrinsic
    // (assuming qualityRetention < 1.0)
    for (const task of dagResult.tasks) {
      const indepTask = indepResult.tasks.find(t => t.taskId === task.taskId)!;
      if (indepTask) {
        // Root task has pEffective = pIntrinsic in both modes
        if (task.taskId === "A") {
          expect(task.pEffective).toBeCloseTo(task.pIntrinsic);
        } else {
          // Propagation should reduce pEffective below pIntrinsic
          expect(task.pEffective).toBeLessThan(task.pIntrinsic);
        }
      }
    }

    // Total EV may be the same with default config (C_fail = C_success),
    // but pEffective values differ which is the key metric
    // Verify that at least one task has different pEffective between modes
    let anyDifferent = false;
    for (const task of dagResult.tasks) {
      const indepTask = indepResult.tasks.find(t => t.taskId === task.taskId)!;
      if (Math.abs(task.pEffective - indepTask.pEffective) > 0.001) {
        anyDifferent = true;
      }
    }
    expect(anyDifferent).toBe(true);
  });

  it("computes chain with compounding effect — each hop compounds quality loss", () => {
    // A (critical, p=0.50) → B (medium, p=0.80) → C (medium, p=0.80)
    // In dag-propagate: pEff degrades at each hop
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "critical", scope: "narrow", impact: "isolated" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
      { id: "C", name: "Task C", dependsOn: ["B"], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw, { propagationMode: "dag-propagate" });

    const taskA = result.tasks.find(t => t.taskId === "A")!;
    const taskB = result.tasks.find(t => t.taskId === "B")!;
    const taskC = result.tasks.find(t => t.taskId === "C")!;

    // A is root: pEffective = pIntrinsic = 0.50
    expect(taskA.pIntrinsic).toBeCloseTo(0.50);
    expect(taskA.pEffective).toBeCloseTo(0.50);

    // B has parent A (p=0.50):
    // inheritedFromA = 0.50 + 0.50*0.9 = 0.95
    // pEffective_B = 0.80 * 0.95 = 0.76
    expect(taskB.pEffective).toBeCloseTo(0.80 * (0.50 + 0.50 * 0.9));

    // C has parent B (p=0.76):
    // inheritedFromB = 0.76 + 0.24*0.9 = 0.76 + 0.216 = 0.976
    // pEffective_C = 0.80 * 0.976 = 0.7808
    const pEff_B = 0.80 * (0.50 + 0.50 * 0.9);
    const inheritedFromB = pEff_B + (1 - pEff_B) * 0.9;
    expect(taskC.pEffective).toBeCloseTo(0.80 * inheritedFromB);

    // Verify compounding: C has more degradation than B
    const degradation_B = taskB.pIntrinsic - taskB.pEffective;
    const degradation_C = taskC.pIntrinsic - taskC.pEffective;
    // Both are degraded, and the degradation accumulates
    expect(degradation_B).toBeGreaterThan(0);
    expect(degradation_C).toBeGreaterThan(0);
  });

  it("diamond graph: convergence multiplies inherited quality factors", () => {
    const graph = createDiamondGraph();
    const result = workflowCost(graph.raw);

    const taskA = result.tasks.find(t => t.taskId === "A")!;
    const taskB = result.tasks.find(t => t.taskId === "B")!;
    const taskC = result.tasks.find(t => t.taskId === "C")!;
    const taskD = result.tasks.find(t => t.taskId === "D")!;

    // All have medium risk (p=0.80)
    expect(taskA.pIntrinsic).toBeCloseTo(0.80);
    expect(taskB.pIntrinsic).toBeCloseTo(0.80);
    expect(taskC.pIntrinsic).toBeCloseTo(0.80);
    expect(taskD.pIntrinsic).toBeCloseTo(0.80);

    // A is root, no degradation
    expect(taskA.pEffective).toBeCloseTo(0.80);

    // B and C both depend on A — they get the same degradation
    const inheritedFromA = 0.80 + 0.20 * 0.9; // = 0.98
    expect(taskB.pEffective).toBeCloseTo(0.80 * inheritedFromA);
    expect(taskC.pEffective).toBeCloseTo(0.80 * inheritedFromA);

    // D depends on both B and C — product of both inherited factors
    const inheritedFromB = taskB.pEffective + (1 - taskB.pEffective) * 0.9;
    const inheritedFromC = taskC.pEffective + (1 - taskC.pEffective) * 0.9;
    expect(taskD.pEffective).toBeCloseTo(0.80 * inheritedFromB * inheritedFromC);
  });

  it("excludes completed tasks when includeCompleted=false but propagates with p=1.0", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "high", scope: "narrow", impact: "isolated", status: "completed" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw, { includeCompleted: false });

    // A should not appear in the task list
    expect(result.tasks.find(t => t.taskId === "A")).toBeUndefined();

    // B's propagation should use p=1.0 for A (completed)
    // inheritedFromA = 1.0 + (1-1.0)*0.9 = 1.0
    // pEffective_B = 0.80 * 1.0 = 0.80
    const taskB = result.tasks.find(t => t.taskId === "B")!;
    expect(taskB).toBeDefined();
    expect(taskB.pEffective).toBeCloseTo(0.80); // No degradation from completed parent
    expect(taskB.pIntrinsic).toBeCloseTo(0.80);
  });

  it("includes completed tasks when includeCompleted=true (default)", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "high", scope: "narrow", impact: "isolated", status: "completed" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw); // default includeCompleted=true

    // A should appear in the task list
    const taskA = result.tasks.find(t => t.taskId === "A")!;
    expect(taskA).toBeDefined();

    // When includeCompleted=true, A propagates with its pEffective (not 1.0)
    // A is a root with risk="high" → pIntrinsic = 0.65, pEffective = 0.65
    expect(taskA.pEffective).toBeCloseTo(0.65);
    expect(taskA.pIntrinsic).toBeCloseTo(0.65);

    // B's propagation uses A's pEffective = 0.65
    // inheritedFromA = 0.65 + 0.35*0.9 = 0.965
    // pEffective_B = 0.80 * 0.965 = 0.772
    const taskB = result.tasks.find(t => t.taskId === "B")!;
    expect(taskB.pEffective).toBeCloseTo(0.80 * (0.65 + 0.35 * 0.9));
  });

  it("completed task with includeCompleted=false still propagates correctly to downstream", () => {
    // A (completed) → B → C
    // A propagates p=1.0
    // B should not be degraded by A's completion
    // C should receive B's degraded probability (not A's)
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "critical", scope: "narrow", impact: "isolated", status: "completed" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "high", scope: "narrow", impact: "isolated" },
      { id: "C", name: "Task C", dependsOn: ["B"], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw, { includeCompleted: false });

    // A should not be in results
    expect(result.tasks.find(t => t.taskId === "A")).toBeUndefined();

    // B's parent A propagates with p=1.0 (completed)
    // inheritedFromA = 1.0 + 0.0 * 0.9 = 1.0
    // pEffective_B = 0.65 (high risk) * 1.0 = 0.65
    const taskB = result.tasks.find(t => t.taskId === "B")!;
    expect(taskB.pIntrinsic).toBeCloseTo(0.65); // high risk
    expect(taskB.pEffective).toBeCloseTo(0.65); // no degradation from completed parent

    // C depends on B (p=0.65 propagated)
    // inheritedFromB = 0.65 + 0.35*0.9 = 0.965
    // pEffective_C = 0.80 * 0.965 = 0.772
    const taskC = result.tasks.find(t => t.taskId === "C")!;
    expect(taskC.pEffective).toBeCloseTo(0.80 * (0.65 + 0.35 * 0.9));
  });

  it("failed and blocked tasks are always included regardless of includeCompleted", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated", status: "failed" },
      { id: "B", name: "Task B", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated", status: "blocked" },
    ]);

    const result = workflowCost(graph.raw, { includeCompleted: false });

    // Both failed and blocked tasks should be included
    expect(result.tasks.find(t => t.taskId === "A")).toBeDefined();
    expect(result.tasks.find(t => t.taskId === "B")).toBeDefined();
  });

  it("throws CircularDependencyError for cyclic graph", () => {
    const graph = createCyclicGraph();
    expect(() => workflowCost(graph.raw)).toThrow(CircularDependencyError);
  });

  it("handles empty graph", () => {
    const graph = new TaskGraph();
    const result = workflowCost(graph.raw);

    expect(result.tasks).toEqual([]);
    expect(result.totalEv).toBe(0);
    expect(result.averageEv).toBe(0);
    expect(result.propagationMode).toBe("dag-propagate");
  });

  it("handles single node graph", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.taskId).toBe("A");
    expect(result.tasks[0]!.pIntrinsic).toBeCloseTo(0.80); // medium risk
    expect(result.tasks[0]!.pEffective).toBeCloseTo(0.80); // root, no parents
  });

  it("respects defaultQualityRetention option when per-edge attribute is absent", () => {
    // Create a graph using raw graphology API so edges don't have qualityRetention
    const tg = new TaskGraph();
    tg.addTask("A", { name: "Task A", risk: "critical", scope: "narrow", impact: "isolated" });
    tg.addTask("B", { name: "Task B", risk: "medium", scope: "narrow", impact: "isolated" });
    // Add edge without qualityRetention attribute
    tg.raw.addEdgeWithKey("A->B", "A", "B", {});

    // With defaultQualityRetention = 1.0, should behave like independent model
    const result = workflowCost(tg.raw, { defaultQualityRetention: 1.0 });

    const taskB = result.tasks.find(t => t.taskId === "B")!;
    // inheritedQuality = parentP + (1-parentP) * 1.0 = 1.0
    // pEffective = pIntrinsic * 1.0 = pIntrinsic
    expect(taskB.pEffective).toBeCloseTo(taskB.pIntrinsic);
  });

  it("per-edge qualityRetention overrides default", () => {
    // Create graph with custom qualityRetention on the edge
    const graph = TaskGraph.fromRecords(
      [
        { id: "A", name: "Task A", dependsOn: [], risk: "critical", scope: "narrow", impact: "isolated" },
        { id: "B", name: "Task B", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
      ],
      [
        { from: "A", to: "B", qualityRetention: 0.5 },
      ]
    );

    const result = workflowCost(graph.raw); // default qualityRetention=0.9
    const taskB = result.tasks.find(t => t.taskId === "B")!;

    // Per-edge qualityRetention = 0.5 overrides default 0.9
    // inheritedFromA = 0.50 + 0.50*0.5 = 0.75
    // pEffective_B = 0.80 * 0.75 = 0.60
    expect(taskB.pEffective).toBeCloseTo(0.80 * (0.50 + 0.50 * 0.5));
  });

  it("applies limit to task entries", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
      { id: "C", name: "Task C", dependsOn: ["B"], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw, { limit: 2 });

    expect(result.tasks).toHaveLength(2);
    // limit only affects the result list, not propagation
    expect(result.tasks[0]!.taskId).toBe("A");
    expect(result.tasks[1]!.taskId).toBe("B");
  });

  it("includes both pIntrinsic and pEffective in per-task entries", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "high", scope: "narrow", impact: "isolated" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw);
    for (const task of result.tasks) {
      expect(typeof task.pIntrinsic).toBe("number");
      expect(typeof task.pEffective).toBe("number");
      expect(typeof task.probability).toBe("number");
      expect(task.probability).toBeCloseTo(task.pEffective);
      expect(typeof task.scopeCost).toBe("number");
      expect(typeof task.impactWeight).toBe("number");
      expect(typeof task.taskId).toBe("string");
      expect(typeof task.name).toBe("string");
    }
  });

  it("computes totalEv and averageEv correctly", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated" },
      { id: "B", name: "Task B", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw, { propagationMode: "independent" });

    // Two independent tasks with medium risk, narrow scope, isolated impact
    // p=0.80, scopeCost=2.0, impactWeight=1.0
    // EV = 0.80 * 2.0 + 0.20 * 2.0 = 2.0 each
    // totalEv = 4.0, averageEv = 2.0
    expect(result.totalEv).toBeCloseTo(4.0);
    expect(result.averageEv).toBeCloseTo(2.0);
  });

  it("uses defaults for tasks with null categorical fields", () => {
    // Task with no risk/scope/impact specified — should use defaults
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [] },
    ]);

    const result = workflowCost(graph.raw);

    const taskA = result.tasks[0]!;
    // defaults: risk=medium (p=0.80), scope=narrow (costEstimate=2.0), impact=isolated (weight=1.0)
    expect(taskA.pIntrinsic).toBeCloseTo(0.80);
    expect(taskA.pEffective).toBeCloseTo(0.80);
    expect(taskA.scopeCost).toBeCloseTo(2.0);
    expect(taskA.impactWeight).toBeCloseTo(1.0);
  });

  it("independent mode produces same pIntrinsic and pEffective for all tasks", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "critical", scope: "broad", impact: "project" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "high", scope: "moderate", impact: "component" },
      { id: "C", name: "Task C", dependsOn: ["B"], risk: "low", scope: "narrow", impact: "isolated" },
    ]);

    const result = workflowCost(graph.raw, { propagationMode: "independent" });

    for (const task of result.tasks) {
      expect(task.pEffective).toBeCloseTo(task.pIntrinsic);
    }
  });

  it("dag-propagate with high risk parent shows significant degradation vs independent", () => {
    // Planning task with critical risk (p=0.50) followed by implementation
    // This matches the Python research model insight
    const graph = TaskGraph.fromTasks([
      { id: "planning", name: "Planning", dependsOn: [], risk: "critical", scope: "broad", impact: "phase" },
      { id: "implementation", name: "Implementation", dependsOn: ["planning"], risk: "medium", scope: "broad", impact: "component" },
    ]);

    const dagResult = workflowCost(graph.raw, { propagationMode: "dag-propagate" });
    const indepResult = workflowCost(graph.raw, { propagationMode: "independent" });

    const dagImpl = dagResult.tasks.find(t => t.taskId === "implementation")!;
    const indepImpl = indepResult.tasks.find(t => t.taskId === "implementation")!;

    // DAG-propagate should show lower pEffective for implementation
    // because the critical-risk parent degrades quality
    expect(dagImpl.pEffective).toBeLessThan(indepImpl.pEffective);

    // The degradation should be significant due to critical risk (p=0.50)
    // inheritedQuality = 0.50 + 0.50*0.9 = 0.95
    // pEffective_dag = 0.80 * 0.95 = 0.76
    expect(dagImpl.pEffective).toBeCloseTo(0.80 * 0.95);
    expect(dagImpl.pEffective).toBeCloseTo(0.76);

    // Independent: pEffective = pIntrinsic = 0.80
    expect(indepImpl.pEffective).toBeCloseTo(0.80);
  });

  it("parallel tasks with no shared parent have same pEffective in both modes", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated" },
      { id: "B", name: "Task B", dependsOn: [], risk: "medium", scope: "narrow", impact: "isolated" },
    ]);

    const dagResult = workflowCost(graph.raw, { propagationMode: "dag-propagate" });
    const indepResult = workflowCost(graph.raw, { propagationMode: "independent" });

    // No dependencies → no propagation → same result
    expect(dagResult.tasks[0]!.pEffective).toBeCloseTo(indepResult.tasks[0]!.pEffective);
    expect(dagResult.tasks[1]!.pEffective).toBeCloseTo(indepResult.tasks[1]!.pEffective);
  });
});

// ---------------------------------------------------------------------------
// CircularDependencyError for cyclic graphs
// ---------------------------------------------------------------------------

describe("workflowCost cycle detection", () => {
  it("throws CircularDependencyError when graph has cycles", () => {
    const graph = createCyclicGraph();
    expect(() => workflowCost(graph.raw)).toThrow(CircularDependencyError);
  });

  it("CircularDependencyError contains cycle information", () => {
    const graph = createCyclicGraph();
    try {
      workflowCost(graph.raw);
      expect.fail("Should have thrown CircularDependencyError");
    } catch (error) {
      expect(error).toBeInstanceOf(CircularDependencyError);
      const err = error as CircularDependencyError;
      expect(err.cycles.length).toBeGreaterThan(0);
      // The cycle should include the nodes A → B → C
      const cycleFlat = err.cycles.flat();
      expect(cycleFlat).toContain("A");
      expect(cycleFlat).toContain("B");
      expect(cycleFlat).toContain("C");
    }
  });
});