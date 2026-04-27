import { Type, type Static, type TSchema } from "@alkdev/typebox";
import {
  TaskScopeEnum,
  TaskRiskEnum,
  TaskImpactEnum,
  TaskLevelEnum,
  TaskPriorityEnum,
  TaskStatusEnum,
} from "./enums.js";

// --- TaskGraphNodeAttributes ---

/** Node attributes stored on the graphology graph. Carries only analysis-relevant metadata. */
export const TaskGraphNodeAttributes = Type.Object({
  name: Type.String(),
  scope: Type.Optional(TaskScopeEnum),
  risk: Type.Optional(TaskRiskEnum),
  impact: Type.Optional(TaskImpactEnum),
  level: Type.Optional(TaskLevelEnum),
  priority: Type.Optional(TaskPriorityEnum),
  status: Type.Optional(TaskStatusEnum),
});
/** Inferred type for {@link TaskGraphNodeAttributes} schema. */
export type TaskGraphNodeAttributes = Static<typeof TaskGraphNodeAttributes>;

// --- TaskGraphNodeAttributesUpdate ---

/** All fields optional for partial-update operations. */
export const TaskGraphNodeAttributesUpdate = Type.Partial(TaskGraphNodeAttributes);
/** Inferred type for {@link TaskGraphNodeAttributesUpdate} schema. */
export type TaskGraphNodeAttributesUpdate = Static<typeof TaskGraphNodeAttributesUpdate>;

// --- TaskGraphEdgeAttributes ---

/** Edge attributes stored on the graphology graph. */
export const TaskGraphEdgeAttributes = Type.Object({
  qualityRetention: Type.Optional(Type.Number()),
});
/** Inferred type for {@link TaskGraphEdgeAttributes} schema. */
export type TaskGraphEdgeAttributes = Static<typeof TaskGraphEdgeAttributes>;

// --- SerializedGraph generic factory ---

/**
 * Generic schema factory for the graphology native JSON format.
 * Parameterized with node attribute, edge attribute, and graph attribute schemas.
 *
 * @param NodeAttrs - Schema for node attributes
 * @param EdgeAttrs - Schema for edge attributes
 * @param GraphAttrs - Schema for graph-level attributes
 */
export const SerializedGraph = <N extends TSchema, E extends TSchema, G extends TSchema>(
  NodeAttrs: N,
  EdgeAttrs: E,
  GraphAttrs: G,
) =>
  Type.Object({
    attributes: GraphAttrs,
    options: Type.Object({
      type: Type.Literal("directed"),
      multi: Type.Literal(false),
      allowSelfLoops: Type.Literal(false),
    }),
    nodes: Type.Array(
      Type.Object({
        key: Type.String(),
        attributes: NodeAttrs,
      }),
    ),
    edges: Type.Array(
      Type.Object({
        key: Type.String(),
        source: Type.String(),
        target: Type.String(),
        attributes: EdgeAttrs,
      }),
    ),
  });

// --- TaskGraphSerialized ---

/** Serialized task graph following graphology native JSON format. */
export const TaskGraphSerialized = SerializedGraph(
  TaskGraphNodeAttributes,
  TaskGraphEdgeAttributes,
  Type.Object({}),
);
/** Inferred type for {@link TaskGraphSerialized} schema. */
export type TaskGraphSerialized = Static<typeof TaskGraphSerialized>;