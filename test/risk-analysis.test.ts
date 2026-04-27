import { describe, it, expect } from "vitest";
import { riskPath, riskDistribution } from "../src/analysis/risk.js";
import { shouldDecomposeTask } from "../src/analysis/decompose.js";
import { TaskGraph } from "../src/graph/construction.js";
import { riskWeight, impactWeight } from "../src/analysis/defaults.js";
import { CircularDependencyError } from "../src/error/index.js";

// ---------------------------------------------------------------------------
// riskPath
// ---------------------------------------------------------------------------

describe("riskPath", () => {
  it("returns empty path and zero totalRisk for empty graph", () => {
    const graph = new TaskGraph();
    const result = riskPath(graph);

    expect(result.path).toEqual([]);
    expect(result.totalRisk).toBe(0);
  });

  it("returns single node for graph with one task", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "high", impact: "phase" },
    ]);

    const result = riskPath(graph);

    expect(result.path).toEqual(["A"]);
    // totalRisk = riskWeight("high") * impactWeight("phase") = 0.35 * 2.0 = 0.70
    expect(result.totalRisk).toBeCloseTo(0.35 * 2.0);
  });

  it("finds the highest-risk path in a simple chain", () => {
    // A (medium, isolated) → B (high, phase) → C (critical, project)
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "medium", impact: "isolated" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "high", impact: "phase" },
      { id: "C", name: "Task C", dependsOn: ["B"], risk: "critical", impact: "project" },
    ]);

    const result = riskPath(graph);

    // Only one chain: A → B → C
    expect(result.path).toEqual(["A", "B", "C"]);

    // totalRisk = sum of riskWeight * impactWeight for each node
    const wA = riskWeight("medium") * impactWeight("isolated"); // 0.20 * 1.0 = 0.20
    const wB = riskWeight("high") * impactWeight("phase");      // 0.35 * 2.0 = 0.70
    const wC = riskWeight("critical") * impactWeight("project"); // 0.50 * 3.0 = 1.50
    expect(result.totalRisk).toBeCloseTo(wA + wB + wC);
  });

  it("picks the path with highest cumulative risk in a diamond graph", () => {
    //       A (critical, isolated)
    //      / \
    //   B       C
    // (low,    (high, project)
    // isolated)
    //      \ /
    //       D (medium, component)
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "critical", impact: "isolated" },
      { id: "B", name: "Task B", dependsOn: ["A"], risk: "low", impact: "isolated" },
      { id: "C", name: "Task C", dependsOn: ["A"], risk: "high", impact: "project" },
      { id: "D", name: "Task D", dependsOn: ["B", "C"], risk: "medium", impact: "component" },
    ]);

    const result = riskPath(graph);

    // Path through C should have higher risk:
    // A → C → D: 0.50*1.0 + 0.35*3.0 + 0.20*1.5 = 0.50 + 1.05 + 0.30 = 1.85
    // A → B → D: 0.50*1.0 + 0.10*1.0 + 0.20*1.5 = 0.50 + 0.10 + 0.30 = 0.90
    // The weightedCriticalPath should pick A → C → D
    expect(result.path).toEqual(["A", "C", "D"]);

    const wA = riskWeight("critical") * impactWeight("isolated");  // 0.50 * 1.0 = 0.50
    const wC = riskWeight("high") * impactWeight("project");       // 0.35 * 3.0 = 1.05
    const wD = riskWeight("medium") * impactWeight("component");   // 0.20 * 1.5 = 0.30
    expect(result.totalRisk).toBeCloseTo(wA + wC + wD);
  });

  it("uses default risk/impact when not specified on nodes", () => {
    // Nodes without risk/impact should use defaults: medium risk, isolated impact
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [] },
      { id: "B", name: "Task B", dependsOn: ["A"] },
    ]);

    const result = riskPath(graph);

    expect(result.path).toEqual(["A", "B"]);
    // Both use defaults: riskWeight("medium") * impactWeight("isolated") = 0.20 * 1.0 = 0.20 each
    expect(result.totalRisk).toBeCloseTo(0.20 + 0.20);
  });

  it("throws CircularDependencyError for cyclic graph", () => {
    const tg = new TaskGraph();
    tg.addTask("A", { name: "Task A" });
    tg.addTask("B", { name: "Task B" });
    tg.addTask("C", { name: "Task C" });
    tg.addDependency("A", "B");
    tg.addDependency("B", "C");
    tg.addDependency("C", "A");

    expect(() => riskPath(tg)).toThrow(CircularDependencyError);
  });
});

// ---------------------------------------------------------------------------
// riskDistribution
// ---------------------------------------------------------------------------

describe("riskDistribution", () => {
  it("returns all empty buckets for empty graph", () => {
    const graph = new TaskGraph();
    const result = riskDistribution(graph);

    expect(result).toEqual({
      trivial: [],
      low: [],
      medium: [],
      high: [],
      critical: [],
      unspecified: [],
    });
  });

  it("groups tasks by their risk attribute", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "trivial" },
      { id: "B", name: "Task B", dependsOn: [], risk: "low" },
      { id: "C", name: "Task C", dependsOn: [], risk: "medium" },
      { id: "D", name: "Task D", dependsOn: [], risk: "high" },
      { id: "E", name: "Task E", dependsOn: [], risk: "critical" },
    ]);

    const result = riskDistribution(graph);

    expect(result.trivial).toEqual(["A"]);
    expect(result.low).toEqual(["B"]);
    expect(result.medium).toEqual(["C"]);
    expect(result.high).toEqual(["D"]);
    expect(result.critical).toEqual(["E"]);
    expect(result.unspecified).toEqual([]);
  });

  it("puts tasks without risk attribute in unspecified bucket", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [], risk: "high" },
      { id: "B", name: "Task B", dependsOn: [] },  // no risk
      { id: "C", name: "Task C", dependsOn: [], risk: "low" },
    ]);

    const result = riskDistribution(graph);

    expect(result.high).toEqual(["A"]);
    expect(result.unspecified).toEqual(["B"]);
    expect(result.low).toEqual(["C"]);
  });

  it("puts all unspecified tasks in one bucket when no tasks have risk", () => {
    const graph = TaskGraph.fromTasks([
      { id: "A", name: "Task A", dependsOn: [] },
      { id: "B", name: "Task B", dependsOn: ["A"] },
    ]);

    const result = riskDistribution(graph);

    expect(result.unspecified).toEqual(["A", "B"]);
    expect(result.trivial).toEqual([]);
    expect(result.low).toEqual([]);
    expect(result.medium).toEqual([]);
    expect(result.high).toEqual([]);
    expect(result.critical).toEqual([]);
  });

  it("no duplicate task IDs in any bucket", () => {
    // Even if a task appears once in the graph, it should only appear once
    const graph = TaskGraph.fromTasks([
      { id: "auth", name: "Auth module", dependsOn: [], risk: "high" },
      { id: "db", name: "Database setup", dependsOn: [], risk: "medium" },
      { id: "api", name: "API layer", dependsOn: ["auth", "db"] },  // no risk
      { id: "tests", name: "Test suite", dependsOn: ["api"], risk: "low" },
      { id: "deploy", name: "Deploy pipeline", dependsOn: ["tests"], risk: "critical" },
    ]);

    const result = riskDistribution(graph);

    // Each bucket has unique entries
    const allIds = [
      ...result.trivial,
      ...result.low,
      ...result.medium,
      ...result.high,
      ...result.critical,
      ...result.unspecified,
    ];
    expect(new Set(allIds).size).toBe(allIds.length); // no duplicates
  });

  it("handles mixed category fixture graph", () => {
    // auth (high), db (medium), api (unspecified), tests (low), deploy (critical)
    const graph = TaskGraph.fromTasks([
      { id: "auth", name: "Auth module", dependsOn: [], risk: "high", scope: "broad", impact: "phase", status: "pending" },
      { id: "db", name: "Database setup", dependsOn: [], risk: "medium", scope: "moderate", impact: null, status: "completed" },
      { id: "api", name: "API layer", dependsOn: ["auth", "db"], risk: null, scope: null, impact: "component", status: null },
      { id: "tests", name: "Test suite", dependsOn: ["api"], risk: "low", scope: null, impact: null, status: null },
      { id: "deploy", name: "Deploy pipeline", dependsOn: ["tests"], risk: "critical", scope: "system", impact: "project", status: "blocked" },
    ]);

    const result = riskDistribution(graph);

    expect(result.high).toEqual(["auth"]);
    expect(result.medium).toEqual(["db"]);
    expect(result.low).toEqual(["tests"]);
    expect(result.critical).toEqual(["deploy"]);
    expect(result.unspecified).toEqual(["api"]);
  });
});

// ---------------------------------------------------------------------------
// shouldDecomposeTask
// ---------------------------------------------------------------------------

describe("shouldDecomposeTask", () => {
  it("flags high risk tasks for decomposition", () => {
    const result = shouldDecomposeTask({ name: "Auth module", risk: "high" as const });

    expect(result.shouldDecompose).toBe(true);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("risk: high");
    expect(result.reasons[0]).toContain("failure probability");
    // high risk: p=0.65, failure probability = 1 - 0.65 = 0.35
    expect(result.reasons[0]).toContain("0.35");
  });

  it("flags critical risk tasks for decomposition", () => {
    const result = shouldDecomposeTask({ name: "Deploy pipeline", risk: "critical" as const });

    expect(result.shouldDecompose).toBe(true);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("risk: critical");
    // critical risk: p=0.50, failure probability = 0.50
    expect(result.reasons[0]).toContain("0.50");
  });

  it("flags broad scope tasks for decomposition", () => {
    const result = shouldDecomposeTask({ name: "Refactor", scope: "broad" as const });

    expect(result.shouldDecompose).toBe(true);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("scope: broad");
    // broad scope: costEstimate = 4.0
    expect(result.reasons[0]).toContain("4.0");
  });

  it("flags system scope tasks for decomposition", () => {
    const result = shouldDecomposeTask({ name: "Migration", scope: "system" as const });

    expect(result.shouldDecompose).toBe(true);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("scope: system");
    // system scope: costEstimate = 5.0
    expect(result.reasons[0]).toContain("5.0");
  });

  it("flags both high risk AND broad scope with two reasons", () => {
    const result = shouldDecomposeTask({
      name: "Auth implementation",
      risk: "high" as const,
      scope: "broad" as const,
    });

    expect(result.shouldDecompose).toBe(true);
    expect(result.reasons).toHaveLength(2);
    expect(result.reasons[0]).toContain("risk: high");
    expect(result.reasons[0]).toContain("failure probability 0.35");
    expect(result.reasons[1]).toContain("scope: broad");
    expect(result.reasons[1]).toContain("cost estimate 4.0");
  });

  it("does NOT flag medium risk tasks", () => {
    const result = shouldDecomposeTask({ name: "Normal task", risk: "medium" as const });

    expect(result.shouldDecompose).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("does NOT flag low risk tasks", () => {
    const result = shouldDecomposeTask({ name: "Safe task", risk: "low" as const });

    expect(result.shouldDecompose).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("does NOT flag trivial risk tasks", () => {
    const result = shouldDecomposeTask({ name: "Trivial task", risk: "trivial" as const });

    expect(result.shouldDecompose).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("does NOT flag narrow scope tasks", () => {
    const result = shouldDecomposeTask({ name: "Narrow task", scope: "narrow" as const });

    expect(result.shouldDecompose).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("does NOT flag moderate scope tasks", () => {
    const result = shouldDecomposeTask({ name: "Moderate task", scope: "moderate" as const });

    expect(result.shouldDecompose).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("does NOT flag single scope tasks", () => {
    const result = shouldDecomposeTask({ name: "Single task", scope: "single" as const });

    expect(result.shouldDecompose).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("does NOT flag unassessed tasks (null/undefined risk and scope)", () => {
    // Unassessed tasks use defaults: risk=medium, scope=narrow
    // Both are below threshold, so not flagged
    const result = shouldDecomposeTask({ name: "Unassessed task" });

    expect(result.shouldDecompose).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("does NOT flag tasks with only medium risk and narrow scope (defaults)", () => {
    const result = shouldDecomposeTask({
      name: "Default-ish task",
      risk: "medium" as const,
      scope: "narrow" as const,
    });

    expect(result.shouldDecompose).toBe(false);
    expect(result.reasons).toEqual([]);
  });

  it("flags high risk even when scope is narrow", () => {
    const result = shouldDecomposeTask({
      name: "Risky narrow task",
      risk: "high" as const,
      scope: "narrow" as const,
    });

    expect(result.shouldDecompose).toBe(true);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("risk: high");
  });

  it("flags broad scope even when risk is low", () => {
    const result = shouldDecomposeTask({
      name: "Low-risk broad task",
      risk: "low" as const,
      scope: "broad" as const,
    });

    expect(result.shouldDecompose).toBe(true);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toContain("scope: broad");
  });

  it("reasons include specific numeric values from risk and scope", () => {
    const result = shouldDecomposeTask({
      name: "Complex task",
      risk: "critical" as const,
      scope: "system" as const,
      impact: "project" as const,
    });

    expect(result.shouldDecompose).toBe(true);
    expect(result.reasons).toHaveLength(2);

    // critical: failure probability = 1 - 0.50 = 0.50
    expect(result.reasons[0]).toBe("risk: critical — failure probability 0.50");
    // system: cost estimate = 5.0
    expect(result.reasons[1]).toBe("scope: system — cost estimate 5.0");
  });

  it("is a pure function — does not depend on a graph", () => {
    // shouldDecomposeTask takes attributes only, not a graph
    const attrs = { name: "Standalone task", risk: "high" as const };
    const result = shouldDecomposeTask(attrs);

    expect(result.shouldDecompose).toBe(true);
    // No graph needed — pure function on attributes
  });
});