---
id: architecture/w-5-fileio-runtime-portability
name: Document file I/O function runtime constraints and export path
status: completed
depends_on:
  - architecture/w-4-taskstatus-enum-values
created: 2026-04-26T09:10:51.293468161Z
modified: 2026-04-26T09:10:51.293468694Z
scope: narrow
risk: medium
---

# Description

**Review ref**: W-5 (Warning)
**Files affected**: `docs/architecture/frontmatter.md`, `docs/architecture/build-distribution.md`

`parseTaskFile` and `parseTaskDirectory` are async and use Node.js `fs` APIs, but ADR-001 and build-distribution.md state the library works in Node, Deno, and Bun. Document whether these I/O functions are available in all runtimes. Consider a separate export path (e.g., `@alkdev/taskgraph/fs`) for file I/O to avoid bundling Node APIs into Deno/Bun consumers.

Depends on W-4 (TaskStatus definition) only if the file I/O discussion touches file-level defaults for status fields.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` W-5
