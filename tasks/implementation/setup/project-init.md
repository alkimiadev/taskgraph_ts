---
id: setup/project-init
name: Initialize project with package.json, tsconfig, and build tooling
status: pending
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

- [ ] `package.json` exists with name `@alkdev/taskgraph`, ESM primary (`"type": "module"`), CJS compat config
- [ ] All production dependencies listed per [build-distribution.md](../../../docs/architecture/build-distribution.md) dependencies table
- [ ] Dev dependencies include: `typescript`, `vitest` (or agreed test runner), `@types/node`
- [ ] `tsconfig.json` configured for Node 18+ target, ESM module resolution, strict mode, declaration output
- [ ] `.gitignore` covers `node_modules/`, `dist/`, `*.js.map`, `.env`
- [ ] `src/` directory skeleton created per [build-distribution.md](../../../docs/architecture/build-distribution.md) project structure:
  - `src/index.ts`
  - `src/schema/index.ts`, `src/schema/enums.ts`, `src/schema/task.ts`, `src/schema/graph.ts`, `src/schema/results.ts`
  - `src/graph/index.ts`, `src/graph/construction.ts`, `src/graph/queries.ts`, `src/graph/mutation.ts`
  - `src/analysis/index.ts`, `src/analysis/critical-path.ts`, `src/analysis/bottleneck.ts`, `src/analysis/risk.ts`, `src/analysis/cost-benefit.ts`, `src/analysis/decompose.ts`, `src/analysis/defaults.ts`
  - `src/frontmatter/index.ts`, `src/frontmatter/parse.ts`, `src/frontmatter/serialize.ts`
  - `src/error/index.ts`
- [ ] `test/` directory created with placeholder test files per build-distribution spec
- [ ] `npm install` succeeds without errors
- [ ] `npx tsc --noEmit` succeeds (empty source files, but config is valid)

## References

- docs/architecture/build-distribution.md — project structure, dependencies, targets

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion