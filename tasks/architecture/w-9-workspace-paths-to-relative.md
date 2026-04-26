---
id: architecture/w-9-workspace-paths-to-relative
name: Convert workspace-absolute paths to relative paths in docs
status: completed
depends_on: []
created: 2026-04-26T09:11:01.370744359Z
modified: 2026-04-26T09:11:01.370744867Z
scope: moderate
risk: low
---

# Description

**Review ref**: W-9 (Warning)
**Files affected**: `docs/architecture/incremental-update-exploration.md`, `docs/architecture/README.md`

References like `/workspace/@alkdev/typebox/docs/values/diff-patch.md` and `/workspace/@alkimiadev/taskgraph/docs/framework.md` are monorepo-internal absolute paths that won't resolve outside this workspace.

Convert to relative paths from repository root (e.g., `../typebox/docs/...`) or link to published documentation URLs where available. Keep workspace-absolute paths only in a clearly marked "Developer Notes" section.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` W-9
