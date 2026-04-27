import type {
  TaskScope,
  TaskRisk,
  TaskImpact,
} from "../schema/enums.js";
import type { TaskGraphNodeAttributes } from "../schema/graph.js";
import type { ResolvedTaskAttributes } from "../schema/results.js";

// ---------------------------------------------------------------------------
// Numeric mapping tables — match docs/architecture/schemas.md exactly
// ---------------------------------------------------------------------------

// --- TaskScope → cost/token estimates ---

const SCOPE_COST_ESTIMATE: Record<TaskScope, number> = {
  single: 1.0,
  narrow: 2.0,
  moderate: 3.0,
  broad: 4.0,
  system: 5.0,
};

const SCOPE_TOKEN_ESTIMATE: Record<TaskScope, number> = {
  single: 500,
  narrow: 1500,
  moderate: 3000,
  broad: 6000,
  system: 10000,
};

// --- TaskRisk → probability/weight ---

const RISK_SUCCESS_PROBABILITY: Record<TaskRisk, number> = {
  trivial: 0.98,
  low: 0.90,
  medium: 0.80,
  high: 0.65,
  critical: 0.50,
};

// --- TaskImpact → weight ---

const IMPACT_WEIGHT: Record<TaskImpact, number> = {
  isolated: 1.0,
  component: 1.5,
  phase: 2.0,
  project: 3.0,
};

// ---------------------------------------------------------------------------
// Standalone numeric functions
// ---------------------------------------------------------------------------

/** Maps TaskScope → costEstimate (1.0–5.0). */
export function scopeCostEstimate(scope: TaskScope): number {
  return SCOPE_COST_ESTIMATE[scope];
}

/** Maps TaskScope → tokenEstimate (500–10000). */
export function scopeTokenEstimate(scope: TaskScope): number {
  return SCOPE_TOKEN_ESTIMATE[scope];
}

/** Maps TaskRisk → successProbability (0.50–0.98). */
export function riskSuccessProbability(risk: TaskRisk): number {
  return RISK_SUCCESS_PROBABILITY[risk];
}

/** Maps TaskRisk → riskWeight (0.02–0.50). Guaranteed to equal 1 - riskSuccessProbability(risk). */
export function riskWeight(risk: TaskRisk): number {
  return 1 - riskSuccessProbability(risk);
}

/** Maps TaskImpact → impactWeight (1.0–3.0). */
export function impactWeight(impact: TaskImpact): number {
  return IMPACT_WEIGHT[impact];
}

// ---------------------------------------------------------------------------
// resolveDefaults
// ---------------------------------------------------------------------------

/** Default fallbacks for unassessed categorical fields (see graph-model.md). */
const DEFAULT_RISK: TaskRisk = "medium";
const DEFAULT_SCOPE: TaskScope = "narrow";
const DEFAULT_IMPACT: TaskImpact = "isolated";

/**
 * Fills in defaults for unassessed categorical fields and computes derived
 * numeric values.
 *
 * - Categorical fields with defaults (risk, scope, impact) are always resolved.
 * - Label-only fields (level, priority, status) remain nullable — no default
 *   value is assigned.
 * - Derived fields (costEstimate, tokenEstimate, successProbability,
 *   riskWeight, impactWeight) are computed from the resolved categorical values.
 *
 * @param attrs - Partial node attributes with at least a `name` present.
 * @returns Fully resolved attributes ready for analysis.
 */
export function resolveDefaults(
  attrs: Partial<TaskGraphNodeAttributes> & Pick<TaskGraphNodeAttributes, "name">,
): ResolvedTaskAttributes {
  const risk = attrs.risk ?? DEFAULT_RISK;
  const scope = attrs.scope ?? DEFAULT_SCOPE;
  const impact = attrs.impact ?? DEFAULT_IMPACT;

  return {
    name: attrs.name,
    scope,
    risk,
    impact,
    level: attrs.level ?? null,
    priority: attrs.priority ?? null,
    status: attrs.status ?? null,
    costEstimate: scopeCostEstimate(scope),
    tokenEstimate: scopeTokenEstimate(scope),
    successProbability: riskSuccessProbability(risk),
    riskWeight: riskWeight(risk),
    impactWeight: impactWeight(impact),
  };
}