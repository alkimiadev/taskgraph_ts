---
id: architecture/s-5-raw-mutation-safety
name: Document graph.raw mutation safety contract
status: completed
depends_on: []
created: 2026-04-26T09:11:09.375058745Z
modified: 2026-04-26T09:11:09.375059259Z
scope: narrow
risk: medium
---

# Description

**Review ref**: S-5 (Suggestion)
**Files affected**: `docs/architecture/api-surface.md`, `docs/architecture/graph-model.md`

Consumers can access the underlying graphology instance via `graph.raw`, but mutations made directly bypass TaskGraph invariants (deterministic edge keys from ADR-006, no-parallel-edges from ADR-007). Add a warning to api-surface.md and graph-model.md documenting that direct mutation of `graph.raw` can break TaskGraph invariants.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` S-5
