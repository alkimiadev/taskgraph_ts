---
id: architecture/c-3-nullable-helper
name: Move Nullable helper definition before first use in schemas.md
status: completed
depends_on: []
created: 2026-04-26T09:10:33.686014464Z
modified: 2026-04-26T09:10:33.686014969Z
scope: narrow
risk: high
---

# Description

**Review ref**: C-3 (Critical)
**Files affected**: `docs/architecture/schemas.md`

The `Nullable` helper is used extensively in the `TaskInput` schema (lines 54–63) but only defined at line 219 in the `ResolvedTaskAttributes` section. An implementer reading top-down encounters `Nullable` without understanding what it does. Also unclear whether `Nullable` is from `@alkdev/typebox` or defined locally.

Add a "Shared Schema Utilities" section near the top of `schemas.md` (before `TaskInput`) that defines `Nullable` and its behavior. Or at minimum add a forward reference: "see Shared Schema Utilities below for the `Nullable` helper" at first use.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` C-3
