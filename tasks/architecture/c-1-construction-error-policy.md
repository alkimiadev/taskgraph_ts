---
id: architecture/c-1-construction-error-policy
name: Fix construction error policy contradiction
status: completed
depends_on: []
created: 2026-04-26T09:10:18.462977719Z
modified: 2026-04-26T09:10:18.462978343Z
scope: narrow
risk: high
---

# Description

**Review ref**: C-1 (Critical)
**Files affected**: `docs/architecture/errors-validation.md`, `docs/architecture/api-surface.md`

`errors-validation.md` line 119 states "Construction never throws" but then lists `DuplicateNodeError` and `DuplicateEdgeError` as exceptions. `api-surface.md` line 60 documents `addTask` as throwing `DuplicateNodeError`. These contradict each other.

Resolve one of two ways:
1. **Preferred**: Replace "Construction never throws" with "Construction throws only for precondition violations (duplicate IDs), not for data validation issues." Make the exception explicit rather than contradicting the principle.
2. Make `addTask`/`addDependency` idempotent (no-op on duplicate) so the principle holds, with `validate()` as the path to detect duplicates.

Also update `api-surface.md` to be consistent with whichever path is chosen.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` C-1
