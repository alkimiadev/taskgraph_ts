---
id: review/complete-library
name: Final review — validate full library against architecture docs
status: pending
depends_on:
  - api/public-exports
  - review/graph-complete
  - frontmatter/file-io-and-serialize
  - cost-benefit/workflow-cost
  - cost-benefit/risk-analysis
scope: broad
risk: low
impact: project
level: review
---

## Description

Final review of the complete library. Verify the full API surface matches architecture docs, all analysis functions produce correct results, and the library achieves its stated purpose: pure TypeScript task graph library with graphology, replicating and extending the essential graph algorithms and cost-benefit math from the Rust CLI.

## Acceptance Criteria

- [ ] Public API matches [api-surface.md](../../../docs/architecture/api-surface.md) exactly — no missing exports, no extra exports
- [ ] All construction paths work: fromTasks, fromRecords, fromJSON, incremental
- [ ] DAG-propagation cost model produces results consistent with Python research model examples
- [ ] Independent model available as degenerate case (set `propagationMode: 'independent'` or `defaultQualityRetention: 1.0`)
- [ ] Frontmatter parsing round-trips correctly: `parseFrontmatter(serializeFrontmatter(task))` ≈ task
- [ ] `Value.Clean()` and `Value.Errors()` used correctly throughout (no `Value.Assert()` where structured errors needed)
- [ ] No gray-matter, no js-yaml, no Zod anywhere in the dependency tree
- [ ] `npm pack` produces a valid package with correct exports
- [ ] All tests pass: `npm test`
- [ ] TypeScript strict mode compilation succeeds with no errors
- [ ] Build output (`dist/`) is correct: ESM + CJS + declarations

## References

- docs/architecture/README.md
- docs/architecture/api-surface.md
- docs/architecture/build-distribution.md
- docs/architecture/cost-benefit.md

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion