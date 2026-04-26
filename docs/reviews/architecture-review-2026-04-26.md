---
status: completed
date: 2026-04-26
reviewer: architect
scope: all ADR documents (001-007) and peripheral architecture documents
resolution: all issues addressed — see resolution notes below
---

# Architecture Review — 2026-04-26

**Files reviewed:**

- `docs/architecture/decisions/001-pivot-to-typescript-graphology.md`
- `docs/architecture/decisions/002-rebuild-vs-incremental.md`
- `docs/architecture/decisions/003-topo-order-throws-on-cycle.md`
- `docs/architecture/decisions/004-workflow-cost-dag-propagation.md`
- `docs/architecture/decisions/005-no-depth-escalation-v1.md`
- `docs/architecture/decisions/006-deterministic-edge-keys.md`
- `docs/architecture/decisions/007-subgraph-internal-only.md`
- `docs/architecture/frontmatter.md`
- `docs/architecture/errors-validation.md`
- `docs/architecture/build-distribution.md`
- `docs/architecture/incremental-update-exploration.md`
- `docs/architecture.md` (redirect file)
- `docs/architecture/README.md`
- `docs/architecture/api-surface.md`
- `docs/architecture/graph-model.md`
- `docs/architecture/schemas.md`
- `docs/architecture/cost-benefit.md`

**Summary:** 3 critical, 10 warnings, 7 suggestions. Overall: needs revision before stabilization.

---

## Critical Issues

### C-1. Inconsistency in Construction Error Policy — `DuplicateNodeError`/`DuplicateEdgeError` vs. "Construction Never Throws"

**Location**: `errors-validation.md`, "Construction vs. Validation Error Handling" section (lines 117–123); contradicts `api-surface.md`, line 60.

**Issue**: `errors-validation.md` line 119 states:

> "Construction never throws — `fromTasks`, `fromRecords`, `fromJSON`, `addTask`, `addDependency` can be called freely. `DuplicateNodeError` and `DuplicateEdgeError` are the exceptions — they represent programming errors"

This is a direct contradiction. If "construction never throws" then `DuplicateNodeError` and `DuplicateEdgeError` should not exist as thrown errors during construction. The section header and first sentence establish a principle, then immediately carve out exceptions that swallow the principle.

`api-surface.md` line 60 says `addTask` "throws `DuplicateNodeError` if the ID already exists" which is consistent with the exception but contradicts the stated principle.

**Recommendation**: Reformulate. Either:
- State clearly that construction throws only for programming errors (duplicate IDs), not for data quality issues — and remove the absolute "never throws" claim. Something like: "Construction throws only for precondition violations (duplicate nodes/edges that already exist), not for data validation issues."
- Or make `addTask`/`addDependency` idempotent (no-op on duplicate) for truly "construction never throws" semantics, with `validate()` as the path to detect duplicates.

---

### C-2. `qualityDegradation` Semantic Inversion — Higher Value Means Less Degradation

**Location**: `schemas.md`, lines 77–80; `cost-benefit.md`, lines 69–75.

**Issue**: `DependencyEdge.qualityDegradation` is defined in `schemas.md` as "0.0–1.0, default 0.9" and described as "how much upstream failure bleeds through," with: "0.0 = no propagation (independent model), 1.0 = full propagation."

But in `cost-benefit.md` line 69, the propagation formula is:

> `parentP + (1 - parentP) × (1 - qualityDegradation)`

With default 0.9, this gives: `parentP + (1 - parentP) × 0.1`. A `qualityDegradation` of 0.9 results in **low** actual propagation (only 10% of the failure bleeds through), while 0.0 results in full propagation.

The name `qualityDegradation` says "high value = high degradation" but the formula says "high value = high quality retention, low degradation." This inverted semantics will cause real bugs.

**Recommendation**: Either:
- Rename to `qualityRetention` (0.9 = 90% quality retained, low bleeding), OR
- Invert the formula so high values = high degradation, OR
- Add an explicit "Note on naming" section: "Despite the name, `qualityDegradation` represents quality *retention*. A value of 0.9 means 90% quality is retained; only 10% of the upstream failure propagates. The `(1 - qualityDegradation)` term in the formula extracts the degradation fraction."

---

### C-3. Undefined `Nullable` Helper — Definition After First Use

**Location**: `schemas.md`, lines 46–66 (first use), line 219 (definition).

**Issue**: `TaskInput` uses `Type.Optional(Nullable(TaskStatusEnum))` on lines 54–63, but `Nullable` is only defined at line 219 in the `ResolvedTaskAttributes` section. An implementer reading top-down encounters `Nullable` without understanding what it does.

Additionally, it's unclear whether `Nullable` is from `@alkdev/typebox` or defined locally.

**Recommendation**: Define `Nullable` in a "Shared Schema Utilities" section at the top of `schemas.md` (before `TaskInput`), or at minimum add a forward reference at first use: "see Shared Schema Utilities below for the `Nullable` helper."

---

## Warnings

### W-1. ADR-002 Mitigation References Exploration as If Settled

**Location**: `decisions/002-rebuild-vs-incremental.md`, lines 25–28.

**Issue**: The mitigation section cites `incremental-update-exploration.md` as if it's a completed exploration, but that document is explicitly "Draft exploration — not yet a decision" (its line 8). If someone reads only ADR-002, they'd assume the incremental exploration is settled.

**Recommendation**: Add a qualifier: "An incremental update architecture has been explored (draft, not yet a decision) in …"

---

### W-2. ADR-001 Missing Alternatives Section

**Location**: `decisions/001-pivot-to-typescript-graphology.md`.

**Issue**: ADR-001 is the foundational decision but lacks an explicit "Alternatives Considered" section. Alternatives (pure Rust, WASM compile, napi-rs) are mentioned in context but not structured. ADRs 002–007 have clearer structure.

**Recommendation**: Add an "Alternatives Considered" section: NAPI/Rust (original plan — build complexity), WASM-compiled Rust (reintroduces Rust toolchain), manual adjacency map (no DAG algorithms), D3/other JS graph libs (graphology already in tree).

---

### W-3. No Document Lifecycle Protocol

**Location**: All peripheral documents have `status: draft`; all ADRs say `Status: Accepted`.

**Issue**: No protocol for when/how documents transition from draft to stable, and no definition of what "draft" means (unstable? unreviewed? subject to change?).

**Recommendation**: Define document lifecycle states (draft → stable → deprecated) in `frontmatter.md` or a governance section in `README.md`. Add transition criteria (e.g., "stable after implementation is complete and tests pass").

---

### W-4. `TaskStatus` Enum Values Never Listed; "Completed" Semantics Undefined

**Location**: `schemas.md` line 143 ("same pattern for TaskImpact, TaskLevel, TaskPriority, TaskStatus"), `cost-benefit.md` line 82–83 (`includeCompleted` semantics).

**Issue**: The actual string values of `TaskStatusEnum` are never defined. `cost-benefit.md` mentions `includeCompleted: false` but doesn't define which enum value(s) constitute "completed."

**Recommendation**: Define `TaskStatusEnum` values explicitly. Specify which status value(s) the `includeCompleted` option treats as "completed."

---

### W-5. File I/O Functions May Not Work in Non-Node Runtimes

**Location**: `frontmatter.md` lines 17–19, `build-distribution.md` lines 49–52.

**Issue**: `parseTaskFile` and `parseTaskDirectory` are async and presumably use Node.js `fs` APIs. ADR-001 and `build-distribution.md` state the library works in Node, Deno, and Bun. Are these functions available in all runtimes? If not, this needs documenting.

**Recommendation**: Document environment constraints. Consider a separate export path (e.g., `@alkdev/taskgraph/fs`) for file I/O functions to avoid bundling Node APIs into Deno/Bun consumers.

---

### W-6. `architecture.md` Redirect Missing ADR References

**Location**: `/workspace/@alkdev/taskgraph_ts/docs/architecture.md`.

**Issue**: The redirect file lists modular documents but doesn't mention ADRs under `docs/architecture/decisions/`. A reader following this redirect would miss the decision records.

**Recommendation**: Add a line pointing to `docs/architecture/decisions/` or to the ADR table in `README.md`.

---

### W-7. CVE Number for js-yaml Appears Incorrect

**Location**: `frontmatter.md`, line 40.

**Issue**: References "CVE-2025-64718" for js-yaml prototype pollution. The CVE number format and sequence number appear inconsistent with typical CVE assignment patterns. An incorrect CVE undermines the supply-chain security argument.

**Recommendation**: Verify the actual CVE number for the js-yaml prototype pollution vulnerability. Update or mark as "referenced in npm audit" if the specific CVE can't be confirmed.

---

### W-8. `WorkflowCostOptions.limit` Is Undocumented

**Location**: `api-surface.md`, lines 136–137.

**Issue**: `WorkflowCostOptions` includes `limit?: number` with no documentation of what it constrains or its default behavior.

**Recommendation**: Document what `limit` does (number of tasks returned? depth limit?) and its behavior when omitted.

---

### W-9. Workspace-Absolute Paths in References

**Location**: `incremental-update-exploration.md`, lines 171–174; `README.md` lines 69, 101, 131–137.

**Issue**: References like `/workspace/@alkdev/typebox/docs/values/diff-patch.md` and `/workspace/@alkimiadev/taskgraph/docs/framework.md` are monorepo-internal absolute paths that won't resolve outside this workspace (published docs, open-source context).

**Recommendation**: Convert to relative paths from repository root or link to published URLs. Keep workspace-absolute paths only in a clearly marked "Developer Notes" section.

---

### W-10. `fromTasks`/`fromRecords` Edge Construction Semantics Underspecified

**Location**: `graph-model.md` lines 33–36, `api-surface.md` lines 23–24, `errors-validation.md`.

**Issue**: Missing documentation for:
- Whether `fromRecords` requires edges to reference tasks in the same `tasks` array
- What happens with dangling edge references (validation error? silently dropped?)
- Whether edge order matters in the `edges` array
- Whether `fromTasks`/`fromRecords` throw `DuplicateEdgeError` or silently deduplicate

**Recommendation**: Document edge construction semantics: dangling reference handling, duplicate edge handling, and edge ordering.

---

## Suggestions

### S-1. Enhance ADR Index with One-Line Summaries

The ADR table in `README.md` lists ADR number and title but not consequences. Adding one-line consequence summaries would let readers quickly understand each decision's impact without opening every ADR.

### S-2. Add a Glossary

Terms like `qualityDegradation`, `pIntrinsic`, `pEffective`, `EV` (expected value), `DAG-propagation`, `degenerate case` are used throughout but never formally defined in one place. A glossary in `README.md` or a separate `glossary.md` would help new readers.

### S-3. Document Test Runner in `build-distribution.md`

The build/distribution doc lists the `test/` directory structure but doesn't specify the test runner, CI expectations, or coverage requirements. This is architecturally relevant for a pure TS library.

### S-4. Fix Incomplete Error Class Listing in Project Structure

**Location**: `build-distribution.md`, line 54.

The error directory listing shows `TaskgraphError, TaskNotFoundError, CircularDependencyError, InvalidInputError` but omits `DuplicateNodeError` and `DuplicateEdgeError` which are defined in `errors-validation.md`.

### S-5. Document `graph.raw` Mutation Safety Contract

**Location**: `api-surface.md` line 52, `graph-model.md` line 78.

Consumers can access the underlying graphology instance via `graph.raw`, but mutations made directly bypass `TaskGraph` invariants (deterministic edge keys, no-parallel-edges). Add a warning about unsafe direct mutation.

### S-6. Make `architecture.md` Redirect Minimal

The redirect file at `docs/architecture.md` duplicates the document listing from `README.md`. Consider making it a simple pointer to avoid staleness.

### S-7. Note That `incremental-update-exploration.md` May Become a Future ADR

**Location**: `incremental-update-exploration.md`.

This document is a companion to ADR-002 but has no ADR number. When it reaches a decision, it should become ADR-008. Add a note: "Future: May become ADR-008 if incremental updates are adopted."

---

## Strengths

- **ADR structure is consistent**: ADRs 002–007 follow clear Context/Decision/Consequences with Positive/Negative/Mitigation subsections.
- **Cross-references are strong**: Main docs consistently link to relevant ADRs, and ADRs reference each other and peripheral docs.
- **Construction vs. validation distinction is well-articulated**: The three-way split (construction, validation, operation) is a clear principled decision — once the DuplicateNodeError contradiction is resolved.
- **Supply-chain security reasoning in `frontmatter.md` is exemplary**: CVE references, package counts, recent attack examples — this is how supply-chain decisions should be documented.
- **Threat model is clearly stated**: The README threat model directly connects the library's existence to a concrete security posture.
- **Propagation formula is clearly specified**: Despite the naming concern (C-2), the actual math in `cost-benefit.md` is detailed enough for unambiguous implementation.

---

## Resolution Status (2026-04-26)

All issues resolved. See `tasks/architecture/` for task details.

| Issue | Resolution |
|-------|-----------|
| C-1 (Construction error policy) | ✅ Reworded to "Construction methods enforce uniqueness, not data quality" — no longer contradicts DuplicateNodeError/DuplicateEdgeError. Construction error handling table added to graph-model.md. |
| C-2 (qualityDegradation naming) | ✅ Renamed to `qualityRetention` across all documents. Added explicit "Note on naming" in schemas.md and graph-model.md documenting the rename. Updated ADR-004 and ADR-005. |
| C-3 (Nullable helper placement) | ✅ Moved Nullable definition to "Schema Utility: Nullable" section before TaskInput in schemas.md. |
| W-1 (ADR-002 draft qualifier) | ✅ Added "(draft, not yet a decision)" qualifier to ADR-002's reference to incremental-update-exploration. |
| W-2 (ADR-001 alternatives) | ✅ Added "Alternatives Considered" section with NAPI/Rust, WASM, manual adjacency map, and D3/other JS libs. |
| W-3 (Doc lifecycle protocol) | ✅ Added "Document Lifecycle" section to README.md with draft/stable/deprecated transitions and ADR status states. |
| W-4 (TaskStatus enum values) | ✅ TaskStatusEnum values explicitly listed (pending, in-progress, completed, failed, blocked). `includeCompleted` semantics clarified — only `"completed"` status triggers exclusion. |
| W-5 (File I/O runtime portability) | ✅ Added runtime constraint to frontmatter.md Constraints section: `parseTaskFile`/`parseTaskDirectory` depend on Node.js `fs`; `parseFrontmatter` is runtime-agnostic. |
| W-6 (architecture.md redirect) | ✅ Added ADR directory reference to redirect file. |
| W-7 (CVE-2025-64718) | ✅ Verified — CVE is legitimate. Updated frontmatter.md to confirm the CVE number and note patching status (js-yaml 4.1.1/3.14.2). |
| W-8 (limit parameter) | ✅ Already documented with inline comments in api-surface.md (resolved by parallel agent). |
| W-9 (Workspace paths) | ✅ Converted workspace-absolute paths to relative/monorepo references in README.md and incremental-update-exploration.md. External links use published URLs where available. |
| W-10 (Edge construction semantics) | ✅ Construction Error Handling table added to graph-model.md with per-method behaviors for dangling references, duplicates, and cycles (resolved by parallel agent). |
| S-4 (Error class listing) | ✅ DuplicateNodeError and DuplicateEdgeError added to build-distribution.md project structure listing (resolved by parallel agent). |
| S-5 (graph.raw mutation safety) | ✅ Warning about direct mutation bypassing TaskGraph invariants added to api-surface.md (resolved by parallel agent). |
| S-7 (Incremental ADR note) | ✅ Added "If this exploration leads to a decision, it will become ADR-008" to incremental-update-exploration.md. |
- **All workspace-internal reference paths resolve correctly**: Verified every path reference and all point to existing files.