---
id: architecture/c-2-qualitydegradation-naming
name: Fix qualityDegradation semantic inversion
status: completed
depends_on: []
created: 2026-04-26T09:10:23.809702955Z
modified: 2026-04-26T09:10:23.809703479Z
scope: narrow
risk: high
---

# Description

**Review ref**: C-2 (Critical)
**Files affected**: `docs/architecture/schemas.md`, `docs/architecture/cost-benefit.md`

The field `qualityDegradation` is described as "how much upstream failure bleeds through" with "0.0 = no propagation, 1.0 = full propagation." But the propagation formula in cost-benefit.md uses `(1 - qualityDegradation)`, meaning 0.9 = 90% quality retained (low bleeding), not 90% degradation. The name and description are semantically inverted.

Resolve one of three ways:
1. **Preferred**: Rename field to `qualityRetention` (0.9 = 90% quality retained, high retention, low bleeding).
2. Invert the semantics so high values = high degradation (use `qualityDegradation` directly in formula, not `1 - qualityDegradation`), and change default from 0.9 to 0.1.
3. Keep the name but add an explicit "Note on naming" section documenting the inversion: "Despite the name, `qualityDegradation` represents quality *retention*."

This must be decided before implementation because it affects the schema, the propagation formula, the DependencyEdge default, and all consumer code.

**Source**: `/docs/reviews/architecture-review-2026-04-26.md` C-2
