---
id: architecture/s-4-error-classes-in-project-structure
name: Add DuplicateNodeError and DuplicateEdgeError to build-distribution.md error listing
status: completed
depends_on:
  - architecture/c-1-construction-error-policy
created: 2026-04-26T09:11:08.034858853Z
modified: 2026-04-26T09:11:08.034859401Z
scope: narrow
risk: low
---

# Description

**Review ref**: S-4 (Suggestion)
**Files affected**: `docs/architecture/build-distribution.md`

The error directory listing in the project structure (line 54) shows `TaskgraphError, TaskNotFoundError, CircularDependencyError, InvalidInputError` but omits `DuplicateNodeError` and `DuplicateEdgeError` which are defined in `errors-validation.md`. Add the missing error classes to the comment.

Depends on C-1 (construction error policy) — if we resolve that DuplicateNodeError/DuplicateEdgeError remain as thrown errors, they must appear in this listing.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` S-4
