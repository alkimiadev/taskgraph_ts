---
id: architecture/w-8-limit-param-docs
name: Document WorkflowCostOptions.limit semantics
status: completed
depends_on:
  - architecture/w-4-taskstatus-enum-values
created: 2026-04-26T09:10:59.676682205Z
modified: 2026-04-26T09:10:59.676682713Z
scope: narrow
risk: medium
---

# Description

**Review ref**: W-8 (Warning)
**Files affected**: `docs/architecture/api-surface.md`

`WorkflowCostOptions` includes `limit?: number` with no documentation of what this parameter constrains or its default behavior. Document what `limit` does (number of tasks in result? max depth?) and its behavior when omitted.

Depends on W-4 (TaskStatus definition) if `limit` interacts with `includeCompleted` filtering semantics.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` W-8
