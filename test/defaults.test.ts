import { describe, it, expect } from "vitest";
import {
  scopeCostEstimate,
  scopeTokenEstimate,
  riskSuccessProbability,
  riskWeight,
  impactWeight,
  resolveDefaults,
} from "../src/analysis/defaults.js";

// ---------------------------------------------------------------------------
// scopeCostEstimate / scopeTokenEstimate
// ---------------------------------------------------------------------------

describe("scopeCostEstimate", () => {
  const cases: [string, number][] = [
    ["single", 1.0],
    ["narrow", 2.0],
    ["moderate", 3.0],
    ["broad", 4.0],
    ["system", 5.0],
  ];

  for (const [scope, expected] of cases) {
    it(`maps "${scope}" → ${expected}`, () => {
      expect(scopeCostEstimate(scope as "single" | "narrow" | "moderate" | "broad" | "system")).toBe(expected);
    });
  }
});

describe("scopeTokenEstimate", () => {
  const cases: [string, number][] = [
    ["single", 500],
    ["narrow", 1500],
    ["moderate", 3000],
    ["broad", 6000],
    ["system", 10000],
  ];

  for (const [scope, expected] of cases) {
    it(`maps "${scope}" → ${expected}`, () => {
      expect(scopeTokenEstimate(scope as "single" | "narrow" | "moderate" | "broad" | "system")).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// riskSuccessProbability / riskWeight
// ---------------------------------------------------------------------------

describe("riskSuccessProbability", () => {
  const cases: [string, number][] = [
    ["trivial", 0.98],
    ["low", 0.90],
    ["medium", 0.80],
    ["high", 0.65],
    ["critical", 0.50],
  ];

  for (const [risk, expected] of cases) {
    it(`maps "${risk}" → ${expected}`, () => {
      expect(riskSuccessProbability(risk as "trivial" | "low" | "medium" | "high" | "critical")).toBe(expected);
    });
  }
});

describe("riskWeight", () => {
  const cases: [string, number][] = [
    ["trivial", 0.02],
    ["low", 0.10],
    ["medium", 0.20],
    ["high", 0.35],
    ["critical", 0.50],
  ];

  for (const [risk, expected] of cases) {
    it(`maps "${risk}" → ${expected}`, () => {
      expect(riskWeight(risk as "trivial" | "low" | "medium" | "high" | "critical")).toBeCloseTo(expected);
    });
  }

  it("equals 1 - riskSuccessProbability for every risk value", () => {
    const risks: Array<"trivial" | "low" | "medium" | "high" | "critical"> = [
      "trivial", "low", "medium", "high", "critical",
    ];
    for (const r of risks) {
      expect(riskWeight(r)).toBeCloseTo(1 - riskSuccessProbability(r));
    }
  });
});

// ---------------------------------------------------------------------------
// impactWeight
// ---------------------------------------------------------------------------

describe("impactWeight", () => {
  const cases: [string, number][] = [
    ["isolated", 1.0],
    ["component", 1.5],
    ["phase", 2.0],
    ["project", 3.0],
  ];

  for (const [impact, expected] of cases) {
    it(`maps "${impact}" → ${expected}`, () => {
      expect(impactWeight(impact as "isolated" | "component" | "phase" | "project")).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// resolveDefaults
// ---------------------------------------------------------------------------

describe("resolveDefaults", () => {
  it("fills all defaults when only name is provided", () => {
    const result = resolveDefaults({ name: "test-task" });

    expect(result.name).toBe("test-task");
    // Default categorical values
    expect(result.scope).toBe("narrow");
    expect(result.risk).toBe("medium");
    expect(result.impact).toBe("isolated");
    // Derived numeric values from defaults
    expect(result.costEstimate).toBe(2.0);
    expect(result.tokenEstimate).toBe(1500);
    expect(result.successProbability).toBeCloseTo(0.80);
    expect(result.riskWeight).toBeCloseTo(0.20);
    expect(result.impactWeight).toBe(1.0);
    // Label-only fields remain null
    expect(result.level).toBeNull();
    expect(result.priority).toBeNull();
    expect(result.status).toBeNull();
  });

  it("preserves explicitly provided categorical fields", () => {
    const result = resolveDefaults({
      name: "big-task",
      scope: "system",
      risk: "critical",
      impact: "project",
    });

    expect(result.scope).toBe("system");
    expect(result.risk).toBe("critical");
    expect(result.impact).toBe("project");
    // Derived from explicit values
    expect(result.costEstimate).toBe(5.0);
    expect(result.tokenEstimate).toBe(10000);
    expect(result.successProbability).toBeCloseTo(0.50);
    expect(result.riskWeight).toBeCloseTo(0.50);
    expect(result.impactWeight).toBe(3.0);
  });

  it("preserves explicit label-only fields", () => {
    const result = resolveDefaults({
      name: "labeled-task",
      level: "implementation",
      priority: "high",
      status: "in-progress",
    });

    expect(result.level).toBe("implementation");
    expect(result.priority).toBe("high");
    expect(result.status).toBe("in-progress");
    // Categorical defaults still applied
    expect(result.scope).toBe("narrow");
    expect(result.risk).toBe("medium");
    expect(result.impact).toBe("isolated");
  });

  it("handles mixed present/absent fields", () => {
    const result = resolveDefaults({
      name: "mixed-task",
      scope: "broad",
      // risk absent → default medium
      impact: "component",
      level: "planning",
      // priority absent → null
      // status absent → null
    });

    expect(result.scope).toBe("broad");
    expect(result.risk).toBe("medium");
    expect(result.impact).toBe("component");
    expect(result.level).toBe("planning");
    expect(result.priority).toBeNull();
    expect(result.status).toBeNull();

    // Derived values: scope=broad, risk=medium (default), impact=component
    expect(result.costEstimate).toBe(4.0);
    expect(result.tokenEstimate).toBe(6000);
    expect(result.successProbability).toBeCloseTo(0.80);
    expect(result.riskWeight).toBeCloseTo(0.20);
    expect(result.impactWeight).toBe(1.5);
  });

  it("derives riskWeight as 1 - successProbability for resolved risk", () => {
    const result = resolveDefaults({ name: "x", risk: "high" });
    expect(result.riskWeight).toBeCloseTo(1 - result.successProbability);
  });
});