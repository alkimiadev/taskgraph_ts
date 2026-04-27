---
id: setup/test-infrastructure
name: Configure test runner and shared test fixtures
status: pending
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

- [ ] Test runner configured in `package.json` scripts (`"test"`, `"test:watch"`, `"test:coverage"`)
- [ ] Vitest config (or equivalent) exists with ESM support and TypeScript path resolution
- [ ] Shared test fixture file created (e.g., `test/fixtures/graphs.ts`) with:
  - A simple linear chain graph (3-4 tasks, A→B→C→D)
  - A diamond dependency graph (A→B, A→C, B→D, C→D)
  - A graph with mixed categorical fields (some assessed, some null)
  - A graph with cycles for testing cycle detection
  - A larger graph (20+ nodes) for performance/bottleneck testing
- [ ] Helper function to create a `TaskGraph` from `TaskInput[]` for one-liner test setup
- [ ] Test runner executes successfully against placeholder test files
- [ ] CI-compatible output format (no watch mode in default script)

## References

- docs/architecture/build-distribution.md — test directory structure
- docs/architecture/graph-model.md — graph construction examples for fixtures

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion