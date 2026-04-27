---
id: setup/test-infrastructure
name: Configure test runner and shared test fixtures
status: completed
depends_on:
  - setup/project-init
scope: narrow
risk: low
impact: project
level: implementation
---

## Description

Set up the test infrastructure: configure Vitest (or chosen runner), create shared test fixtures and helpers for graph construction that all downstream test files will use. This avoids every test file building graphs from scratch.

## Acceptance Criteria

- [x] Test runner configured in `package.json` scripts (`"test"`, `"test:watch"`, `"test:coverage"`)
- [x] Vitest config (or equivalent) exists with ESM support and TypeScript path resolution
- [x] Shared test fixture file created (e.g., `test/fixtures/graphs.ts`) with:
  - A simple linear chain graph (3-4 tasks, A→B→C→D)
  - A diamond dependency graph (A→B, A→C, B→D, C→D)
  - A graph with mixed categorical fields (some assessed, some null)
  - A graph with cycles for testing cycle detection
  - A larger graph (20+ nodes) for performance/bottleneck testing
- [x] Helper function to create a `TaskGraph` from `TaskInput[]` for one-liner test setup
- [x] Test runner executes successfully against placeholder test files
- [x] CI-compatible output format (no watch mode in default script)

## References

- docs/architecture/build-distribution.md — test directory structure
- docs/architecture/graph-model.md — graph construction examples for fixtures

## Notes

- Added `@vitest/coverage-v8@^3.2.4` as a dev dependency to support `npm run test:coverage`
- `createTaskGraph()` builds a graphology `DirectedGraph` directly using `graph.import()` (bulk construction per architecture recommendation) with deterministic edge keys (`source->target`) and default `qualityRetention: 0.9`
- The `@/` path alias resolves to `src/` for convenient test imports of source modules
- Cycle detection uses `hasCycle()` from `graphology-dag` (standalone function, not a method on the graph instance)
- All fixture types (`TaskInput`, `TaskGraphNodeAttributes`, etc.) are defined inline until the schema module is implemented

## Summary

Configured Vitest test infrastructure and created shared test fixtures for graph construction.
- Modified: package.json (added `test:coverage` script, `@vitest/coverage-v8` dev dependency)
- Modified: vitest.config.ts (added `@/` path alias, `include` pattern, coverage config with v8 provider)
- Modified: test/graph.test.ts (expanded with 26 fixture validation tests)
- Created: test/fixtures/graphs.ts (shared fixtures: linearChain, diamond, mixedCategory, cyclic, largeGraph + createTaskGraph helper + allGraphs/allTasks convenience exports)
- Tests: 30, all passing (5 placeholder + 25 fixture validation + 1 retained placeholder)