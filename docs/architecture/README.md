---
status: draft
last_updated: 2026-04-26
---

# @alkdev/taskgraph Architecture

Pure TypeScript task graph library with graphology. Replicates and extends the essential graph algorithms and cost-benefit math from the Rust taskgraph CLI.

## Why This Exists

The taskgraph CLI (`@alkimiadev/taskgraph`) is useful but requires bash access. In agent systems, bash + untrusted data sources is a security risk — adversarial content can instruct agents to exfiltrate data or take harmful actions through the shell. This has been observed in practice: researchers hiding prompt injections in academic papers using Unicode steganography that bypassed review systems.

Rather than restricting which agents get bash access and hoping nothing goes wrong, this library exposes the graph and cost-benefit operations as a callable API — no shell involved.

The same graph code also serves agents that *do* have bash access — they call these operations directly rather than shelling out to the CLI, which is faster and avoids argument parsing issues.

## Core Principle

**The graph algorithms and cost-benefit math are the value.** Everything else — frontmatter parsing, file discovery, CLI output formatting — is input/output that belongs to the caller or to specific consumers.

This is a standalone implementation. It replicates the essential logic from the Rust CLI but does not depend on it. The upstream CLI continues to exist for human use and offline analysis.

## Why Not NAPI/Rust

The original draft specified a Rust core with napi-rs bindings. That added significant complexity with minimal benefit for our use case:

- **Cross-platform build pain** — macOS x64/ARM64, Linux x64/ARM64, Windows x64. Each needs a separate binary.
- **Realistic graph sizes are small** — task graphs are typically 10–50 nodes, rarely exceeding 200. The performance difference between Rust and JS is negligible at this scale.
- **graphology already exists** — it provides all the DAG algorithms we need, and we already have it in the dependency tree.
- **Runtime compatibility** — pure JS/TS works in Node, Deno, and Bun without native addon headaches.
- **Future UI path** — graphology is the graph engine behind sigma.js/react-sigma, making visualization straightforward later.
- **Near 1:1 petgraph ↔ graphology mapping** — porting back to Rust later is tractable because the graph operation semantics align closely.

> See [ADR-001: Pivot to TypeScript + graphology](decisions/001-pivot-to-typescript-graphology.md) for the full decision record.

## What This Library Provides

Replicated from the Rust CLI:

- **Graph algorithms** — topological sort, cycle detection, parallel groups, critical path, bottleneck analysis, dependency queries
- **Categorical enums with numeric methods** — TaskScope, TaskRisk, TaskImpact, TaskLevel, TaskPriority, TaskStatus
- **Cost-benefit analysis** — expected value calculation, risk distribution, decomposition detection
- **DAG-propagation cost model** — extends the Rust CLI's independent model with multiplicative upstream failure propagation. The Rust CLI treats each task's cost independently; the Python research model demonstrates that this is dangerously optimistic for non-trivial workflows — poor planning (p=0.65) produces a 213% cost increase vs good planning (p=0.92) when accounting for cascading failure.

> See [cost-benefit.md](cost-benefit.md) for the propagation model details.

Not replicated (belongs to callers/specific consumers):

- `Task` / `TaskFrontmatter` Rust structs — replaced by TypeBox schemas + graphology node attributes
- `TaskCollection` / directory scanning — filesystem discovery belongs to the consumer
- `Config` / `.taskgraph.toml` — CLI configuration, not a library concern
- `clap` command definitions — CLI dispatch, replaced by consumer's own dispatch
- `toDot()` / DOT export — added speculatively in Rust, not used, dropped
- Zod interop — TypeBox is the sole schema system

## Consumer Context

Two downstream projects consume this library. Understanding their needs shapes the library's construction and API design:

### alkhub (hub-spoke coordinator)

The hub's database is the source of truth for tasks at runtime. The coordinator loads task rows + dependency edges from the DB, builds a graphology graph in memory, and runs graph algorithms. This consumer:

- Builds graphs from structured data (DB query results), not files
- Needs per-edge `qualityDegradation` attributes for the DAG propagation model
- Requires the same analysis functions the CLI provides, but called as an API, not via shell

> See alkhub task storage spec: `/workspace/@alkdev/alkhub_ts/docs/architecture/storage/tasks.md`

### OpenCode plugin (future)

An OpenCode plugin following the registry pattern (like `@alkdev/open-memory` and `@alkdev/open-coordinator`). Will expose a `task` tool with `{action, args}` dispatch. Reads frontmatter from markdown files on disk, runs the same graph algorithms. Functionally replaces the taskgraph CLI for agents within OpenCode — no bash required. This consumer:

- Builds graphs from file-based frontmatter, not DB queries
- Uses the library's frontmatter parsing (included in this package)
- Wraps library functions in its own dispatch mechanism
- Needs `init` as the only write action; all other actions are read-only (security model)

The specific CLI→plugin dispatch mapping belongs in the plugin's own architecture, not here. The library's contract is: export pure functions, let consumers wrap them however they need.

## Threat Model

- **Attack vector**: Agents with bash access processing untrusted content (web pages, academic papers, API responses) can be manipulated via prompt injection, including subtle attacks like Unicode steganography hiding instructions in otherwise legitimate content.
- **Defense in depth**: The instruction firewall project (Ternary Bonsai classifier to detect instruction-bearing content) addresses detection. This library addresses the other side — reducing blast radius by removing bash as a requirement for analysis operations.
- **Tool-based access**: Instead of `taskgraph --json list | jq`, agents call library functions directly. No shell, no injection surface, no data exfiltration path through bash.
- **Supply chain defense**: The frontmatter parser avoids `gray-matter` (which pulls in the vulnerable `js-yaml@3.x`). The library depends only on `yaml` (zero transitive deps, no known CVEs). See [frontmatter.md](frontmatter.md) for the full supply chain argument.

## Structural Principle: Upstream Failures Multiply

The cost-benefit framework demonstrates a structural property independent of developer type (human, LLM, or otherwise): errors upstream multiply the surface area for errors downstream.

```
planning failure → wrong decomposition → wasted implementation
decomposition failure → unclear tasks → rework
review failure → bugs shipped → rework
```

This is why the library implements DAG-propagation as the default cost model: it captures this multiplicative effect structurally, rather than treating each task's cost as independent. When people simplistically complain about "AI slop," what they should really be saying is "I suck at planning and that leads to poor implementations" — the structural property holds regardless of who's doing the work.

> See [cost-benefit.md](cost-benefit.md) and the Rust taskgraph's framework doc: `/workspace/@alkimiadev/taskgraph/docs/framework.md`

## Architecture Documents

| Document | Content |
|----------|---------|
| [graph-model.md](graph-model.md) | Edge direction, construction paths, categorical defaults, node metadata, reactivity |
| [api-surface.md](api-surface.md) | TaskGraph data class, standalone analysis functions, return types |
| [schemas.md](schemas.md) | TypeBox schemas, categorical enums, numeric methods |
| [cost-benefit.md](cost-benefit.md) | EV math, risk analysis, DAG propagation, findCycles approach |
| [frontmatter.md](frontmatter.md) | Parsing, serialization, supply chain security decisions |
| [errors-validation.md](errors-validation.md) | Error types, validation levels |
| [build-distribution.md](build-distribution.md) | Dependencies, project structure, targets, performance |

### Design Decisions

All significant decisions are documented as ADRs in [decisions/](decisions/):

| ADR | Decision |
|-----|----------|
| [001](decisions/001-pivot-to-typescript-graphology.md) | Pivot from NAPI/Rust to TypeScript + graphology |
| [002](decisions/002-rebuild-vs-incremental.md) | Rebuild graph on change, not incremental updates |
| [003](decisions/003-topo-order-throws-on-cycle.md) | topologicalOrder throws CircularDependencyError |
| [004](decisions/004-workflow-cost-dag-propagation.md) | DAG-propagation as default workflow cost model |
| [005](decisions/005-no-depth-escalation-v1.md) | No depth-escalation heuristic in v1 |
| [006](decisions/006-deterministic-edge-keys.md) | Deterministic edge keys via addEdgeWithKey |
| [007](decisions/007-subgraph-internal-only.md) | Subgraph returns internal-only edges |

## References

- Rust taskgraph CLI: `/workspace/@alkimiadev/taskgraph/`
- graphology monorepo: `/workspace/graphology/`
- alkhub task storage spec: `/workspace/@alkdev/alkhub_ts/docs/architecture/storage/tasks.md`
- @alkdev/typebox: `/workspace/@alkdev/typebox/`
- Cost-benefit framework: `/workspace/@alkimiadev/taskgraph/docs/framework.md`
- Workflow guide: `/workspace/@alkimiadev/taskgraph/docs/workflow.md`
- Python cost-benefit research: `/workspace/@alkimiadev/taskgraph/docs/research/cost_benefit_analysis_framework.py`
- SDD process: `/workspace/@alkdev/taskgraph_ts/docs/sdd_process.md`