import { Type, type Static } from "@alkdev/typebox";
import {
  Nullable,
  TaskStatusEnum,
  TaskScopeEnum,
  TaskRiskEnum,
  TaskImpactEnum,
  TaskLevelEnum,
  TaskPriorityEnum,
} from "./enums.js";

// --- Input Schemas ---

/**
 * Universal input shape for a task, matching the Rust `TaskFrontmatter` field set.
 *
 * Categorical fields use `Type.Optional(Nullable(...))` to support both:
 * - Field absent (undefined) — key missing from YAML frontmatter
 * - Field explicitly null — key present but set to null in YAML (e.g., `risk:`)
 *
 * This distinguishes "not yet assessed" from "intentionally set to null".
 */
export const TaskInput = Type.Object({
  id: Type.String(),
  name: Type.String(),
  dependsOn: Type.Array(Type.String()),
  status: Type.Optional(Nullable(TaskStatusEnum)),
  scope: Type.Optional(Nullable(TaskScopeEnum)),
  risk: Type.Optional(Nullable(TaskRiskEnum)),
  impact: Type.Optional(Nullable(TaskImpactEnum)),
  level: Type.Optional(Nullable(TaskLevelEnum)),
  priority: Type.Optional(Nullable(TaskPriorityEnum)),
  tags: Type.Optional(Type.Array(Type.String())),
  assignee: Type.Optional(Nullable(Type.String())),
  due: Type.Optional(Nullable(Type.String())),
  created: Type.Optional(Nullable(Type.String())),
  modified: Type.Optional(Nullable(Type.String())),
});
/** Inferred type from TaskInput schema */
export type TaskInput = Static<typeof TaskInput>;

/**
 * Dependency edge between two tasks.
 *
 * `qualityRetention` models how much upstream quality is preserved:
 * - 0.0 = no retention (full propagation of upstream failure)
 * - 1.0 = complete retention (independent model)
 * - default = 0.9
 */
export const DependencyEdge = Type.Object({
  from: Type.String(),
  to: Type.String(),
  qualityRetention: Type.Optional(Type.Number({ default: 0.9 })),
});
/** Inferred type from DependencyEdge schema */
export type DependencyEdge = Static<typeof DependencyEdge>;