---
id: api/public-exports
name: Wire up public API surface in src/index.ts
status: pending
depends_on:
  - graph/taskgraph-class
  - graph/construction
  - graph/mutation
  - graph/queries
  - graph/subgraph-and-validation
  - graph/export
  - analysis/parallel-groups
  - analysis/critical-path
  - analysis/bottlenecks
  - cost-benefit/ev-calculation
  - cost-benefit/dag-propagation
  - cost-benefit/workflow-cost
  - cost-benefit/risk-analysis
  - frontmatter/parsing
  - frontmatter/file-io-and-serialize
  - schema/numeric-methods-and-defaults
scope: narrow
risk: low
impact: project
level: implementation
---

## Description

Wire up `src/index.ts` to re-export the full public API surface. This is the main entry point for consumers: everything they need should be importable from `@alkdev/taskgraph`.

## Acceptance Criteria

- [ ] `src/index.ts` re-exports all public API items:
  - `TaskGraph` class (from `src/graph/index.ts`)
  - All analysis functions: `parallelGroups`, `criticalPath`, `weightedCriticalPath`, `bottlenecks`, `riskPath`, `riskDistribution`, `shouldDecomposeTask`, `workflowCost`, `calculateTaskEv`
  - All categorical numeric functions: `scopeCostEstimate`, `scopeTokenEstimate`, `riskSuccessProbability`, `riskWeight`, `impactWeight`, `resolveDefaults`
  - All frontmatter functions: `parseFrontmatter`, `parseTaskFile`, `parseTaskDirectory`, `serializeFrontmatter`
  - All schemas and types: all enum schemas, `TaskInput`, `DependencyEdge`, `TaskGraphNodeAttributes`, `TaskGraphEdgeAttributes`, `TaskGraphSerialized`, all result types
  - All error classes: `TaskgraphError`, `TaskNotFoundError`, `CircularDependencyError`, `InvalidInputError`, `DuplicateNodeError`, `DuplicateEdgeError`
- [ ] No internal implementation details leak through the public API
- [ ] `package.json` `"exports"` field configured for ESM primary + CJS compat
- [ ] TypeScript declarations (`tsc --emitDeclarationOnly`) verify the public surface compiles correctly
- [ ] Consumer import `import { TaskGraph, workflowCost } from "@alkdev/taskgraph"` works

## References

- docs/architecture/api-surface.md — full public API
- docs/architecture/build-distribution.md — package name, ESM primary

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion