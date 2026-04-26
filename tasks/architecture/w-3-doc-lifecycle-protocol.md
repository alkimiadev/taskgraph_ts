---
id: architecture/w-3-doc-lifecycle-protocol
name: Define document lifecycle states and transition criteria
status: completed
depends_on: []
created: 2026-04-26T09:10:49.101915726Z
modified: 2026-04-26T09:10:49.101916156Z
scope: narrow
risk: low
---

# Description

**Review ref**: W-3 (Warning)
**Files affected**: `docs/architecture/frontmatter.md` or `docs/architecture/README.md`

All peripheral docs have `status: draft` but there's no protocol for when they transition to stable, or what "draft" means. Define document lifecycle states (draft → stable → deprecated) and transition criteria in frontmatter.md or a governance section in README.md.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` W-3
