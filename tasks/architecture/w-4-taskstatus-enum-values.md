---
id: architecture/w-4-taskstatus-enum-values
name: Define TaskStatus enum values and completed semantics
status: completed
depends_on: []
created: 2026-04-26T09:10:49.967999614Z
modified: 2026-04-26T09:10:49.968000036Z
scope: narrow
risk: medium
---

# Description

**Review ref**: W-4 (Warning)
**Files affected**: `docs/architecture/schemas.md`, `docs/architecture/cost-benefit.md`

The `TaskStatusEnum` values are never explicitly listed — just "same pattern for TaskImpact, TaskLevel, TaskPriority, TaskStatus." Also, `cost-benefit.md` references `includeCompleted: false` but doesn't define which status value(s) constitute "completed."

Define TaskStatusEnum values explicitly. Specify which status(es) the `includeCompleted` option treats as "completed." This blocks implementation of both the schema and the workflowCost function.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` W-4
