import { Type, type Static, type TSchema } from "@alkdev/typebox";

// --- Nullable helper ---

/** Wrap a schema to also accept `null`. */
export const Nullable = <T extends TSchema>(schema: T) =>
  Type.Union([schema, Type.Null()]);

// --- Enum schemas (runtime) and type aliases (compile-time) ---

export const TaskScopeEnum = Type.Union([
  Type.Literal("single"),
  Type.Literal("narrow"),
  Type.Literal("moderate"),
  Type.Literal("broad"),
  Type.Literal("system"),
]);
/** "single" | "narrow" | "moderate" | "broad" | "system" */
export type TaskScope = Static<typeof TaskScopeEnum>;

export const TaskRiskEnum = Type.Union([
  Type.Literal("trivial"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("critical"),
]);
/** "trivial" | "low" | "medium" | "high" | "critical" */
export type TaskRisk = Static<typeof TaskRiskEnum>;

export const TaskImpactEnum = Type.Union([
  Type.Literal("isolated"),
  Type.Literal("component"),
  Type.Literal("phase"),
  Type.Literal("project"),
]);
/** "isolated" | "component" | "phase" | "project" */
export type TaskImpact = Static<typeof TaskImpactEnum>;

export const TaskLevelEnum = Type.Union([
  Type.Literal("planning"),
  Type.Literal("decomposition"),
  Type.Literal("implementation"),
  Type.Literal("review"),
  Type.Literal("research"),
]);
/** "planning" | "decomposition" | "implementation" | "review" | "research" */
export type TaskLevel = Static<typeof TaskLevelEnum>;

export const TaskPriorityEnum = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("critical"),
]);
/** "low" | "medium" | "high" | "critical" */
export type TaskPriority = Static<typeof TaskPriorityEnum>;

export const TaskStatusEnum = Type.Union([
  Type.Literal("pending"),
  Type.Literal("in-progress"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("blocked"),
]);
/** "pending" | "in-progress" | "completed" | "failed" | "blocked" */
export type TaskStatus = Static<typeof TaskStatusEnum>;