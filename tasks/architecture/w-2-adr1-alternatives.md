---
id: architecture/w-2-adr1-alternatives
name: Add Alternatives Considered section to ADR-001
status: completed
depends_on: []
created: 2026-04-26T09:10:42.466925749Z
modified: 2026-04-26T09:10:42.466926257Z
scope: narrow
risk: medium
---

# Description

**Review ref**: W-2 (Warning)
**Files affected**: `docs/architecture/decisions/001-pivot-to-typescript-graphology.md`

ADR-001 is the foundational decision but lacks an explicit "Alternatives Considered" section. Add structured alternatives: NAPI/Rust (original plan — build complexity), WASM-compiled Rust (reintroduces Rust toolchain), manual adjacency map (no DAG algorithms), D3/other JS graph libs (graphology already in tree).

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` W-2
