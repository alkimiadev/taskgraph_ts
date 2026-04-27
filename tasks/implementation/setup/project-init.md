---
id: setup/project-init
name: Initialize project with package.json, tsconfig, and build tooling
status: completed
depends_on: []
scope: moderate
risk: low
impact: project
level: implementation
---

## Description

Set up the TypeScript project from scratch. This is a greenfield project — the repo currently has only `AGENTS.md` and `docs/`. Initialize everything needed for a pure TypeScript ESM library: package.json, tsconfig.json, gitignore, and the src/ directory skeleton.

Per [build-distribution.md](../../../docs/architecture/build-distribution.md):
- Package name: `@alkdev/taskgraph`
- ESM primary, CJS compat
- Targets: Node 18+, Deno, Bun (pure JS, no native addons)
- Build: `tsc` for declarations + bundler for distribution
- Dependencies: `graphology`, `graphology-dag`, `graphology-metrics`, `graphology-components`, `graphology-operators`, `@alkdev/typebox`, `yaml`

## Acceptance Criteria

- [x] `package.json` exists with name `@alkdev/taskgraph`, ESM primary (`"type": "module"`), CJS compat config
- [x] All production dependencies listed per [build-distribution.md](../../../docs/architecture/build-distribution.md) dependencies table
- [x] Dev dependencies include: `typescript`, `vitest` (or agreed test runner), `@types/node`
- [x] `tsconfig.json` configured for Node 18+ target, ESM module resolution, strict mode, declaration output
- [x] `.gitignore` covers `node_modules/`, `dist/`, `*.js.map`, `.env`
- [x] `src/` directory skeleton created per [build-distribution.md](../../../docs/architecture/build-distribution.md) project structure:
  - `src/index.ts`
  - `src/schema/index.ts`, `src/schema/enums.ts`, `src/schema/task.ts`, `src/schema/graph.ts`, `src/schema/results.ts`
  - `src/graph/index.ts`, `src/graph/construction.ts`, `src/graph/queries.ts`, `src/graph/mutation.ts`
  - `src/analysis/index.ts`, `src/analysis/critical-path.ts`, `src/analysis/bottleneck.ts`, `src/analysis/risk.ts`, `src/analysis/cost-benefit.ts`, `src/analysis/decompose.ts`, `src/analysis/defaults.ts`
  - `src/frontmatter/index.ts`, `src/frontmatter/parse.ts`, `src/frontmatter/serialize.ts`
  - `src/error/index.ts`
- [x] `test/` directory created with placeholder test files per build-distribution spec
- [x] `npm install` succeeds without errors
- [x] `npx tsc --noEmit` succeeds (empty source files, but config is valid)

## References

- docs/architecture/build-distribution.md — project structure, dependencies, targets

## Notes

Dependency version adjustments from architecture spec:
- `@alkdev/typebox`: ^0.2.0 → ^0.34.49 (only version available on npm)
- `graphology`: ^0.25.4 → ^0.26.0 (latest on npm)
- `graphology-dag`: ^0.4.2 → ^0.4.1 (latest on npm)
- `graphology-metrics`: ^0.7.0 → ^2.4.0 (latest on npm)
- `graphology-components`: ^0.3.1 → ^1.5.4 (latest on npm)
- `graphology-operators`: ^0.5.2 → ^1.6.1 (latest on npm)
- `yaml`: ^2.6.1 → ^2.8.3 (latest on npm)

## Summary

Initialized the @alkdev/taskgraph TypeScript ESM project from scratch.
- Created: package.json, tsconfig.json, vitest.config.ts, .gitignore
- Created: src/ directory skeleton (20 source files across 5 modules: schema, graph, analysis, frontmatter, error)
- Created: test/ directory (5 placeholder test files: graph, analysis, schema, frontmatter, cost-benefit)
- Modified: tasks/implementation/setup/project-init.md (status → completed)
- Tests: 5 passing, npm install ✓, tsc --noEmit ✓