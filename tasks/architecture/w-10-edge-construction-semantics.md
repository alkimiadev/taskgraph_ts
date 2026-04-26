---
id: architecture/w-10-edge-construction-semantics
name: Document fromTasks/fromRecords edge construction and validation semantics
status: completed
depends_on:
  - architecture/c-1-construction-error-policy
created: 2026-04-26T09:11:03.412470108Z
modified: 2026-04-26T09:11:03.412470586Z
scope: narrow
risk: medium
---

# Description

**Review ref**: W-10 (Warning)
**Files affected**: `docs/architecture/graph-model.md`, `docs/architecture/api-surface.md`, `docs/architecture/errors-validation.md`

Missing documentation for `fromTasks`/`fromRecords` edge construction:
- Whether `fromRecords` requires edges to reference tasks in the same `tasks` array
- What happens with dangling edge references (validation error? silently dropped?)
- Whether edge order matters in the `edges` array
- Whether `fromTasks`/`fromRecords` throw `DuplicateEdgeError` or silently deduplicate

Add a "Construction Semantics" section to graph-model.md specifying these behaviors.

Depends on C-1 (construction error policy) — the resolution of that issue determines whether duplicate edges are errors or idempotent no-ops.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` W-10
