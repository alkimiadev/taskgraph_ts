# taskgraph_ts Architecture

> Status: draft — this is a starting point for iteration, not a final spec.

## Why This Exists

The taskgraph CLI is useful but requires bash access. In agent systems, bash + untrusted data sources (web content, academic papers, etc.) is a security risk akin to SQL injection — adversarial content can instruct agents to exfiltrate data or take harmful actions through the shell. We've seen this in practice: researchers hiding prompt injections in academic papers using Unicode steganography that bypassed review systems.

Rather than restricting which agents get bash access and hoping nothing goes wrong, we expose the graph and cost-benefit operations as a library callable as a native tool — no shell involved.

The same math and graph code also serves a different purpose: implementation agents that *do* have bash access can call these operations directly as tools rather than shelling out to the CLI, which is faster and avoids argument parsing issues.

## Core Principle

**The graph algorithms and cost-benefit math are the value.** Markdown parsing, file discovery, and CLI output formatting are input/output concerns that belong to the caller, not to this library.

This crate is a standalone implementation. It copies the essential logic from `/workspace/@alkimiadev/taskgraph` but does not depend on it. The upstream CLI continues to exist for human use and offline analysis.

## What We Copy (Rewritten)

From the taskgraph Rust crate, adapted for library use:

- **DependencyGraph** — all algorithms:
  - Cycle detection (`hasCycles`, `findCycles`)
  - Topological sort (`topologicalOrder`)
  - Dependency queries (`dependencies`, `dependents`)
  - Parallel groups (`parallelGroups`)
  - Critical path (`criticalPath`)
  - Weighted critical path (`weightedCriticalPath`)
  - Bottleneck detection (`bottlenecks`)
  - DOT export (`toDot`)

- **Categorical enums** with their numeric methods:
  - `TaskScope` — `costEstimate()` (1.0–5.0)
  - `TaskRisk` — `successProbability()` (0.50–0.98)
  - `TaskImpact` — `weight()` (1.0–3.0)
  - `TaskLevel` — labeling, no numeric method currently

- **Cost-benefit math**:
  - `calculateTaskEv(p, scopeCost, impactWeight)` — expected value calculation
  - Risk-path finding (highest cumulative risk path)
  - Decomposition flagging (tasks that should be broken down)

- **Error types** — cleaned up, mapped to typed JS error classes

## What We Don't Copy

- `Task` / `TaskFrontmatter` — markdown-specific structs
- `TaskCollection` / directory scanning — filesystem discovery
- `Config` / `.taskgraph.toml` — CLI configuration
- `clap` command definitions — CLI dispatch
- `gray_matter` / `serde_yaml` — markdown frontmatter parsing
- `chrono` — timestamp handling (the graph doesn't need it)

These may be added later as a opt-in feature but are not part of the core.

## Input Model

The graph must be constructable from multiple sources. The DB consumer sends query results. The markdown consumer sends parsed files. The programmatic consumer builds incrementally.

### TaskInput

The universal input shape for a task:

```typescript
interface TaskInput {
  id: string
  name?: string
  dependsOn: string[]
  scope?: "single" | "narrow" | "moderate" | "broad" | "system"
  risk?: "trivial" | "low" | "medium" | "high" | "critical"
  impact?: "isolated" | "component" | "phase" | "project"
  level?: "planning" | "decomposition" | "implementation" | "review" | "research"
  priority?: "low" | "medium" | "high" | "critical"
}
```

All categorical fields are optional. The graph algorithms only need `id` and `dependsOn`. The cost-benefit and weighted-path functions need the categorical fields.

### DependencyEdge

For constructing from DB rows where tasks and edges are separate:

```typescript
interface DependencyEdge {
  from: string  // prerequisite task id
  to: string    // dependent task id
}
```

### Construction Paths

```typescript
// 1. From DB query results (the primary use case)
const graph = DependencyGraph.fromRecords(tasks, edges)

// 2. Incremental construction (programmatic)
const graph = new DependencyGraph()
graph.addTask("a")
graph.addTask("b")
graph.addDependency("a", "b")

// 3. From TaskInput array (convenience, extracts id + dependsOn)
const graph = DependencyGraph.fromTasks(tasks)
```

Path 1 is what alkhub's coordinator agent will use most. Path 2 is for programmatic/testing use. Path 3 is where the categorical data attaches for weighted analysis.

### Markdown Support

Not in scope for v1. If needed later, it would be a separate module or package that parses markdown files into `TaskInput[]` and then feeds them into the graph. The parsing is straightforward (gray_matter/YAML) and is better kept outside the core library — callers with bash access already have the CLI.

## API Surface (Draft)

### DependencyGraph

The primary class. Wraps petgraph internally.

```typescript
class DependencyGraph {
  // Construction
  static fromRecords(tasks: TaskInput[], edges: DependencyEdge[]): DependencyGraph
  static fromTasks(tasks: TaskInput[]): DependencyGraph
  addTask(id: string): void
  addDependency(from: string, to: string): void

  // Queries
  hasCycles(): boolean
  findCycles(): string[][]
  topologicalOrder(): string[] | null
  dependencies(taskId: string): string[]
  dependents(taskId: string): string[]
  taskCount(): number

  // Analysis
  parallelGroups(): string[][]
  criticalPath(): string[]
  weightedCriticalPath(weights: Record<string, number>): string[]
  bottlenecks(): Array<[string, number]>

  // Export
  toDot(): string
}
```

### Categorical Enums

Exposed as JS string enums with numeric accessor methods:

```typescript
// The enum values are strings (matching the DB and frontmatter conventions)
// The numeric methods are exposed as standalone functions

function scopeCostEstimate(scope: TaskScope): number       // 1.0–5.0
function riskSuccessProbability(risk: TaskRisk): number     // 0.50–0.98
function impactWeight(impact: TaskImpact): number           // 1.0–3.0

// Or as static methods on enum-like objects — TBD
```

The exact JS API shape (string union types vs enum objects vs namespace + functions) is open for iteration. The Rust side is unambiguous — these are enums with `match`-based methods.

### Cost-Benefit Analysis

```typescript
function calculateTaskEv(
  probability: number,
  scopeCost: number,
  impactWeight: number
): number

function riskPath(
  graph: DependencyGraph,
  tasks: TaskInput[]
): string[]

function shouldDecompose(task: TaskInput): boolean
```

### Error Types

Typed JS error classes instead of flat strings:

```typescript
class TaskgraphError extends Error {}
class TaskNotFoundError extends TaskgraphError { taskId: string }
class CircularDependencyError extends TaskgraphError { cycles: string[][] }
class InvalidInputError extends TaskgraphError { field: string; message: string }
```

This lets callers distinguish error types programmatically — important when an agent needs to decide how to recover.

## Project Structure

```
taskgraph_ts/
├── Cargo.toml                  # Rust crate config (cdylib, napi deps)
├── build.rs                    # napi-build setup
├── package.json                # npm package config + napi targets
├── src/
│   ├── lib.rs                  # Crate root, module declarations
│   ├── graph.rs                # DependencyGraph + all algorithms
│   ├── enums.rs                # TaskScope, TaskRisk, TaskImpact, TaskLevel
│   ├── cost_benefit.rs         # EV calculation, risk-path, decompose
│   ├── input.rs                # TaskInput, DependencyEdge napi structs
│   ├── error.rs                # Error types + napi conversion
│   └── napi_types.rs           # napi attribute structs (or inline)
├── index.js                    # Auto-generated by napi build
├── index.d.ts                  # Auto-generated TypeScript declarations
└── ts/
    └── index.ts                # Hand-written wrapper layer
                                 #   - Re-exports from native module
                                 #   - Typed error classes
                                 #   - Input validation
                                 #   - Convenience helpers
```

The `ts/` wrapper layer is where we add ergonomic value on top of the raw napi bindings. This is also where we'd handle things like making `weightedCriticalPath` accept either a weight map or a `TaskInput[]` that carries categorical data.

## Build & Distribution

- **Rust crate**: `taskgraph_ts` (or `taskgraph_napi` — TBD), compiled as `cdylib`
- **napi-rs**: v3, with `async` + `tokio_rt` features (for future async I/O operations)
- **Targets**: macOS x64/ARM64, Linux x64/ARM64, Windows x64
- **Package**: `@alkdev/taskgraph` on npm, with per-platform optional dependencies
- **TypeScript**: Auto-generated `.d.ts` from napi macros, plus hand-written wrapper

## Dependencies (Rust)

| Crate | Purpose |
|-------|---------|
| `napi` / `napi-derive` | Node-API bindings |
| `napi-build` | Build script configuration |
| `petgraph` | Directed graph data structure and algorithms |
| `thiserror` | Error derive macros |
| `serde` + `serde_json` | Serialization for napi object conversion |

Notably absent: `gray_matter`, `serde_yaml`, `chrono`, `clap`. The core doesn't need them.

## Open Questions

These will be resolved through iteration, not upfront design:

1. **Package name** — `@alkdev/taskgraph` vs something else. The npm namespace and whether to match the CLI crate name.

2. **Async boundary** — `DependencyGraph` operations are CPU-bound and synchronous. Should we offer `Promise`-wrapped versions anyway for non-blocking use in event-loop-sensitive environments? Or is that the caller's job?

3. **Task metadata on the graph** — Currently `DependencyGraph` only stores task IDs as node weights. For `weightedCriticalPath` and `riskPath`, the weight data comes from `TaskInput[]` passed alongside the graph. Should the graph store metadata (scope, risk, etc.) on nodes so callers don't need to pass it separately?

4. **Risk-path return type** — Should `riskPath` return just `string[]` (the path) or include the cumulative risk score? The CLI command outputs both.

5. **Enum representation in napi** — `#[napi(string_enum)]` gives JS string values, which aligns with the DB enum values. Or we could use `#[napi(enum)]` for numeric values with a TS mapping. String enums match the existing ecosystem better.

6. **Relationship to alkhub's graphology** — The alkhub spec currently uses graphology for runtime graph ops in the hub. This napi module could replace graphology for the algorithms it supports (and petgraph is faster). Or they could coexist — graphology for the coordinator's runtime queries, taskgraph_napi for deep analysis. Needs iteration to see what feels right.

7. **How `shouldDecompose` works** — The CLI `decompose` command checks if `scope > moderate` or `risk > medium`. Should this be a simple function, a method on a `Task` object, or configurable thresholds?

8. **Markdown feature flag** — Whether to ever add an optional markdown-parsing feature, and if so whether it lives in this crate or a companion package.

## Threat Model Context

For background on the security motivation:

- **Attack vector**: Agents with bash access processing untrusted content (web pages, academic papers, API responses) can be manipulated via prompt injection. This includes subtle attacks like Unicode steganography hiding instructions in otherwise legitimate content.
- **Defense in depth**: The instruction firewall project (using Ternary Bonsai 1.7b classifier to detect instruction-bearing content) addresses detection. This project addresses the other side — reducing the blast radius by removing bash as a requirement for analysis operations.
- **Tool-based access**: Instead of `taskgraph --json list | jq`, agents call `taskgraph.listTasks()` as a tool. No shell, no injection surface, no data exfiltration path through bash.