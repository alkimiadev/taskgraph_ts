# Architecture

> **This document has been decomposed into modular documents.** See [docs/architecture/](architecture/) for the current architecture specification.

The monolithic architecture document was split to follow the SDD process's modular documentation pattern (~500 line target per document). The content now lives in:

- [architecture/README.md](architecture/README.md) — Overview, problem statement, consumer context
- [architecture/graph-model.md](architecture/graph-model.md) — Edge direction, construction, defaults, metadata
- [architecture/api-surface.md](architecture/api-surface.md) — TaskGraph class, standalone functions, return types
- [architecture/schemas.md](architecture/schemas.md) — TypeBox schemas, enums, numeric methods
- [architecture/cost-benefit.md](architecture/cost-benefit.md) — EV math, risk, DAG propagation, findCycles
- [architecture/frontmatter.md](architecture/frontmatter.md) — Parsing, serialization, supply chain security
- [architecture/errors-validation.md](architecture/errors-validation.md) — Error types, validation levels
- [architecture/build-distribution.md](architecture/build-distribution.md) — Dependencies, project structure, targets
- [architecture/decisions/](architecture/decisions/) — ADR records for design decisions