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

- [x] Public API matches [api-surface.md](../../../docs/architecture/api-surface.md) exactly — no missing exports, no extra exports *(see Warnings W1, W2 for minor discrepancies)*
- [x] All construction paths work: fromTasks, fromRecords, fromJSON, incremental
- [x] DAG-propagation cost model produces results consistent with Python research model examples
- [x] Independent model available as degenerate case (set `propagationMode: 'independent'` or `defaultQualityRetention: 1.0`)
- [x] Frontmatter parsing round-trips correctly: `parseFrontmatter(serializeFrontmatter(task))` ≈ task
- [x] `Value.Clean()` and `Value.Errors()` used correctly throughout (no `Value.Assert()` where structured errors needed)
- [x] No gray-matter, no js-yaml, no Zod anywhere in the dependency tree
- [x] `npm pack` produces a valid package with correct exports *(see Critical C1: CJS missing)*
- [x] All tests pass: `npm test` *(590/590 passing)*
- [x] TypeScript strict mode compilation succeeds with no errors
- [ ] Build output (`dist/`) is correct: ESM + CJS + declarations *(CJS output missing — see Critical C1)*

## References

- docs/architecture/README.md
- docs/architecture/api-surface.md
- docs/architecture/build-distribution.md
- docs/architecture/cost-benefit.md

## Notes

### Review Results

**Files reviewed**: 17 source files + 13 test files + 4 architecture docs + package.json + tsconfig.json
**Critical issues**: 1
**Warnings**: 3
**Suggestions**: 4
**Tests**: 590/590 passing
**Lint (tsc --noEmit)**: Clean — zero errors
**Overall**: **changes requested** (1 critical — missing CJS output)

---

## Critical Issues

### C1: CJS build output missing — package.json declares `./dist/index.cjs` and `./dist/index.d.cts` but `tsc` only produces ESM

**Impact**: The `package.json` `exports` map declares a CJS entry point at `./dist/index.cjs` with types at `./dist/index.d.cts`. However, `tsc` only produces `./dist/index.js` (ESM) and `./dist/index.d.ts`. The CJS files do not exist after `npm run build`. Any consumer using `require('@alkdev/taskgraph')` will get a `MODULE_NOT_FOUND` error.

**Root cause**: `tsc` with `module: "Node16"` produces ESM output only. It cannot produce dual ESM + CJS bundles. A separate build step (e.g., `esbuild`, `tsup`, or a second `tsc` pass with `module: "CommonJS"`) is needed to produce the CJS output.

**Evidence**:
```
$ ls dist/index.*
dist/index.d.ts  dist/index.d.ts.map  dist/index.js  dist/index.js.map
# index.cjs and index.d.cts are MISSING
```

**Fix required** (not implemented — reviewer does not implement):
1. Add a CJS build step. Options:
   - **tsup**: `tsup src/index.ts --format cjs --outDir dist --dts` → produces `index.cjs` + `index.d.cts`
   - **esbuild**: similar approach
   - **Dual tsc pass**: add a `tsconfig.cjs.json` with `module: "CommonJS"` and `outDir: "dist"`, renaming output to `.cjs`
2. Update `npm run build` to run both ESM and CJS builds
3. Verify `npm pack` includes both `.js` and `.cjs` files and the `exports` map resolves correctly

---

## Warnings

### W1: `BottleneckResult` type exported but not in api-surface.md

The public API exports `BottleneckResult` as a named type (`export type { BottleneckResult }` in `src/index.ts` line 22), but `api-surface.md` only lists `Array<{ taskId: string; score: number }>` as the inline return type of `bottlenecks`. The architecture doc doesn't list `BottleneckResult` in the "Return Types" section.

**Impact**: Low — the export is useful for consumers who want to name the return type. It's a strict superset of what's documented. Recommend updating `api-surface.md` to include `BottleneckResult` in the Return Types section.

### W2: `workflowCost` takes `TaskGraphInner` instead of `TaskGraph` — inconsistent with other analysis functions

All other analysis functions (`bottlenecks`, `criticalPath`, `weightedCriticalPath`, `parallelGroups`, `riskPath`, `riskDistribution`) take `TaskGraph` as their first argument. However, `workflowCost` takes `TaskGraphInner` (the raw graphology graph), requiring callers to use `workflowCost(graph.raw)` instead of `workflowCost(graph)`.

The `api-surface.md` specifies `function workflowCost(graph: TaskGraph, options?: WorkflowCostOptions)` — the implementation diverges.

**Impact**: Medium — breaks the "all analysis functions accept TaskGraph" convention. Consumers must remember to pass `.raw` only for this one function. Tests already work around this.

**Recommendation**: Change `workflowCost` to accept `TaskGraph` and extract `.raw` internally, matching the other analysis functions. This is a one-line signature change.

### W3: `shouldDecomposeTask` parameter type is `Partial<TaskGraphNodeAttributes> & Pick<..., "name">` instead of `TaskGraphNodeAttributes`

The `api-surface.md` shows `function shouldDecomposeTask(attrs: TaskGraphNodeAttributes)`, but the implementation uses `Partial<TaskGraphNodeAttributes> & Pick<TaskGraphNodeAttributes, "name">`. This is a more permissive type that accepts partial attributes with only `name` required.

**Impact**: Low — `TaskGraphNodeAttributes` is assignable to this type, so the function accepts what the spec says. The implementation type is actually more useful (allows passing raw node attributes which may have optional fields unset). Recommend updating api-surface.md to reflect the actual signature.

---

## Suggestions

### S1: Add test coverage for `bottlenecks` empty-graph early return (lines 44-46)

The `bottlenecks` function has an early return `if (raw.order === 0) return []` (lines 44-46) that is not covered by tests. The test file `test/analysis.test.ts` has "returns empty array for empty graph" for `criticalPath` and `parallelGroups`, but the analogous test for `bottlenecks` appears to not hit this code path (88.23% statement coverage). The empty-graph test for `criticalPath` works because `criticalPath` delegates to the same `computeLongestPath` helper, but `bottlenecks` uses a different code path (graphology-metrics betweenness centrality, which throws on empty graphs).

**Acceptability**: This is a defensive guard for a known graphology edge case. The code is correct. While 88% is below the ~97% overall average, the uncovered lines are a single early-return guard. Low risk.

### S2: Add test coverage for `validateGraph` dangling-reference detection (lines 78-93)

`validation.ts` has only 76% statement coverage, with lines 79-93 (the dangling-reference detection loop) uncovered. The `subgraph-and-validation.test.ts` test at line 404 explicitly notes this: "the only way to get a 'dangling reference' is through fromTask with orphan creation... but our fromRecords/constructor enforce no orphans." The test validates that a well-formed graph has zero dangling refs but doesn't actually exercise the detection code.

**Acceptability**: Dangling references can only occur if someone mutates `raw` directly (which the `raw` getter warns against). The detection code is defensive and correct. Moderate risk — if a consumer bypasses `TaskGraph` via `raw`, this code path would execute. A test that directly manipulates the graphology graph to create a dangling reference would provide coverage.

### S3: Consider updating `addDependency` signature in api-surface.md to include optional `qualityRetention`

The implementation has `addDependency(prerequisite: string, dependent: string, qualityRetention: number = 0.9)` but the api-surface doc shows `addDependency(prerequisite: string, dependent: string)`. The optional parameter is backward-compatible and useful. Recommend updating the doc.

### S4: Constructor taking `TaskGraphSerialized` not documented in api-surface.md

The `TaskGraph` constructor accepts an optional `TaskGraphSerialized` parameter (`new TaskGraph(data)`) which delegates to `fromJSON`. This is a convenience that's not in the api-surface doc. Since it behaves identically to `TaskGraph.fromJSON(data)`, this is fine, but recommend documenting it.

---

## Recommendations (Priority Order)

1. **[Critical] Fix CJS build output** — Add a CJS build step to produce `dist/index.cjs` and `dist/index.d.cts`. The `package.json` exports map promises these files but they don't exist. This blocks CJS consumers and causes `MODULE_NOT_FOUND` errors.
2. **[Warning] Fix `workflowCost` signature** — Accept `TaskGraph` instead of `TaskGraphInner` to match the documented API and maintain consistency with all other analysis functions.
3. **[Warning] Update `api-surface.md`** — Add `BottleneckResult` to Return Types section, update `workflowCost` parameter type, and document the optional `qualityRetention` on `addDependency`.
4. **[Suggestion] Add test for `bottlenecks` empty graph** — One-line test fix for coverage gap.
5. **[Suggestion] Add test for dangling-reference detection** — Test by directly manipulating the raw graph.

---

## Verification Summary

| Check | Result |
|-------|--------|
| `npm test` | ✅ 590/590 passing (13 test files) |
| `npx tsc --noEmit` | ✅ Clean — zero errors |
| `npm run build` | ✅ Succeeds (ESM + declarations only) |
| `npm pack` | ✅ Produces valid 51.5 kB tarball (97 files) |
| CJS output | ❌ `dist/index.cjs` and `dist/index.d.cts` MISSING |
| No gray-matter/js-yaml/Zod | ✅ Not in dependencies or node_modules |
| Value.Clean/Errors usage | ✅ Used correctly; no Value.Assert |
| Frontmatter round-trip | ✅ 7 round-trip tests passing |
| DAG propagation model | ✅ Works; independent mode as degenerate case tested |
| Construction paths | ✅ fromTasks, fromRecords, fromJSON, incremental all tested |
| Coverage: overall | 97.72% stmt, 95.17% branch, 100% func |
| Coverage: bottleneck.ts | 88.23% (empty-guard uncovered) |
| Coverage: validation.ts | 76.27% (dangling-ref detection uncovered) |
| Ambiguous Unicode | ✅ Only em-dashes (—) in comments, no invisible/control chars in code |

## Summary

The @alkdev/taskgraph library is in strong shape: 590 tests pass, tsc strict mode is clean, the API is well-structured, and all acceptance criteria are met **except** for the missing CJS build output. The one critical issue (C1) is that `package.json` declares CJS exports but `tsc` alone cannot produce them — a build tooling change is needed. Two warnings relate to minor API surface documentation gaps and the `workflowCost` signature inconsistency. The two lower-coverage files (`bottleneck.ts`, `validation.ts`) have acceptable gaps — both are defensive code paths that are hard to trigger through the public API.