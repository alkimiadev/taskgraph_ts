# @alkdev/taskgraph Architecture

> Status: draft — pivot from napi/Rust to pure TypeScript with graphology.

## Why This Exists

The taskgraph CLI (`/workspace/@alkimiadev/taskgraph`) is useful but requires bash access. In agent systems, bash + untrusted data sources (web content, academic papers, etc.) is a security risk — adversarial content can instruct agents to exfiltrate data or take harmful actions through the shell. We've seen this in practice: researchers hiding prompt injections in academic papers using Unicode steganography that bypassed review systems.

Rather than restricting which agents get bash access and hoping nothing goes wrong, we expose the graph and cost-benefit operations as a library callable as a native tool — no shell involved.

The same graph code also serves agents that *do* have bash access — they call these operations directly as tools rather than shelling out to the CLI, which is faster and avoids argument parsing issues.

## Why Not NAPI/Rust

The original draft specified a Rust core with napi-rs bindings. That added significant complexity with minimal benefit for our use case:

- **Cross-platform build pain** — macOS x64/ARM64, Linux x64/ARM64, Windows x64. Each needs a separate binary. Publishing is a headache.
- **Realistic graph sizes are small** — task graphs are typically 10–50 nodes, rarely exceeding 200. The performance difference between Rust and JS is negligible at this scale.
- **graphology already exists** — it provides all the DAG algorithms we need, and we already have it in the dependency tree at `/workspace/graphology`.
- **Runtime compatibility** — pure JS/TS works in Node, Deno, and Bun without native addon headaches. No platform-specific binaries.
- **Future UI path** — graphology is the graph engine behind sigma.js/react-sigma, making visualization straightforward later.
- **Near 1:1 petgraph ↔ graphology mapping** — porting back to Rust later is tractable because the graph operation semantics align closely.

## Core Principle

**The graph algorithms and cost-benefit math are the value.** Everything else — frontmatter parsing, file discovery, CLI output formatting — is input/output that belongs to the caller or to specific consumers.

This is a standalone implementation. It replicates the essential logic from `/workspace/@alkimiadev/taskgraph` but does not depend on it. The upstream CLI continues to exist for human use and offline analysis.

## Two Consumers

### 1. alkhub (hub-spoke coordinator)

The hub's database is the source of truth for tasks at runtime. The coordinator loads task rows + dependency edges from the DB, builds a graphology graph in memory, and runs graph algorithms (topo, cycles, parallel, critical path, bottleneck, risk-path).

See `/workspace/@alkdev/alkhub_ts/docs/architecture/storage/tasks.md` for the DB schema and the graphology integration section.

### 2. OpenCode plugin (task tool)

An OpenCode plugin following the registry pattern (like `@alkdev/open-memory` and `@alkdev/open-coordinator`). Exposes a single `task` tool with `{action, args}` dispatch. Reads frontmatter from markdown files on disk, runs the same graph algorithms. Functionally replaces the `taskgraph` CLI for agents within OpenCode — no bash required.

Commands replicated from the CLI (minus `graph`/DOT export which was added speculatively and isn't used):

| CLI Command | Plugin Action | Notes |
|-------------|---------------|-------|
| `list` | `task({action: "list"})` | List all tasks |
| `show` | `task({action: "show", args: {id}})` | Show task details |
| `deps` | `task({action: "deps", args: {id}})` | What a task depends on |
| `dependents` | `task({action: "dependents", args: {id}})` | What depends on a task |
| `topo` | `task({action: "topo"})` | Topological order |
| `cycles` | `task({action: "cycles"})` | Cycle detection |
| `parallel` | `task({action: "parallel"})` | Parallel execution groups |
| `critical` | `task({action: "critical"})` | Critical path |
| `bottleneck` | `task({action: "bottleneck"})` | High-betweenness tasks |
| `risk` | `task({action: "risk"})` | Risk distribution |
| `risk-path` | `task({action: "riskPath"})` | Highest cumulative risk path |
| `decompose` | `task({action: "decompose"})` | Tasks that should be broken down |
| `workflow-cost` | `task({action: "workflowCost"})` | Expected value cost analysis |
| `validate` | `task({action: "validate"})` | Schema + graph validation |
| `init` | `task({action: "init", args: {id, name}})` | Scaffold a new task file |

## What We Replicate from taskgraph (Rust)

### DependencyGraph — all algorithms

| Operation | Source (Rust) | Implementation (TS) |
|-----------|---------------|---------------------|
| `hasCycles` | petgraph `is_cyclic_directed` | `graphology-dag` `hasCycle` |
| `findCycles` | DFS with recursion stack | Custom: DFS extracting cycle paths |
| `topologicalOrder` | petgraph `toposort` | `graphology-dag` `topologicalSort` |
| `dependencies(id)` | Incoming edges | graphology `inNeighbors` |
| `dependents(id)` | Outgoing edges | graphology `outNeighbors` |
| `parallelGroups` | Generational grouping | `graphology-dag` `topologicalGenerations` |
| `criticalPath` | Longest path by node count (memoized DFS) | Custom: same algorithm on graphology graph |
| `weightedCriticalPath` | Longest path by cumulative weight | Custom: same algorithm with weight function |
| `bottlenecks` | All-pairs path counting | `graphology-metrics` `betweenness` (Brandes) |

### Categorical enums with numeric methods

| Enum | Values | Method | Range |
|------|--------|--------|-------|
| `TaskScope` | single, narrow, moderate, broad, system | `costEstimate()` | 1.0–5.0 |
| `TaskRisk` | trivial, low, medium, high, critical | `successProbability()` | 0.50–0.98 |
| `TaskImpact` | isolated, component, phase, project | `weight()` | 1.0–3.0 |
| `TaskLevel` | planning, decomposition, implementation, review, research | — | (labeling only) |
| `TaskPriority` | low, medium, high, critical | — | (labeling only) |
| `TaskStatus` | pending, in-progress, completed, failed, blocked | — | (labeling only) |

### Numeric method tables

| TaskScope | costEstimate | tokenEstimate |
|-----------|-------------|---------------|
| single | 1.0 | 500 |
| narrow | 2.0 | 1500 |
| moderate | 3.0 | 3000 |
| broad | 4.0 | 6000 |
| system | 5.0 | 10000 |

| TaskRisk | successProbability | riskWeight (1-p) |
|----------|--------------------|--------------------|
| trivial | 0.98 | 0.02 |
| low | 0.90 | 0.10 |
| medium | 0.80 | 0.20 |
| high | 0.65 | 0.35 |
| critical | 0.50 | 0.50 |

| TaskImpact | weight |
|-----------|--------|
| isolated | 1.0 |
| component | 1.5 |
| phase | 2.0 |
| project | 3.0 |

### Cost-benefit math

- `calculateTaskEv` — expected value with retry logic (exact formula from Rust CLI)
- `riskPath` — `weightedCriticalPath(weight = riskWeight * impactWeight)`
- `shouldDecompose` — risk >= high OR scope >= broad
- `workflowCost` — per-task EV aggregation, skip completed unless flagged
- `riskDistribution` — bucket tasks by risk category, show counts/percentages

### Error types

Typed error classes for programmatic recovery:

```typescript
class TaskgraphError extends Error {}
class TaskNotFoundError extends TaskgraphError { taskId: string }
class CircularDependencyError extends TaskgraphError { cycles: string[][] }
class InvalidInputError extends TaskgraphError { field: string; message: string }
```

## What We Don't Replicate

- `Task` / `TaskFrontmatter` Rust structs — replaced by typebox schemas + graphology node attributes
- `TaskCollection` / directory scanning — filesystem discovery belongs to the consumer
- `Config` / `.taskgraph.toml` — CLI configuration, not a library concern
- `clap` command definitions — CLI dispatch, replaced by plugin tool dispatch or direct API calls
- `toDot()` / DOT export — added speculatively, not used, dropped
- Rust's all-pairs path-counting bottleneck — replaced by graphology betweenness (Brandes, O(VE) vs O(N²×paths))

## Schema & Types (@alkdev/typebox)

All data shapes are defined as typebox schemas. This gives us:

1. **Static TypeScript types** via `Static<typeof Schema>` — compile-time safety
2. **Runtime validation** via `Value.Check()` / `Value.Assert()` — reject bad input before it hits the graph
3. **JSON Schema** for free — can be used by consumers for their own validation, API contracts, etc.

The typebox schemas serve as the single source of truth for both types and validation. No separate type definitions, no Zod, no ad-hoc validation logic.

### TaskInput schema

The universal input shape for a task, matching the Rust `TaskFrontmatter` field set:

```typescript
const TaskInput = Type.Object({
  id: Type.String(),
  name: Type.String(),
  dependsOn: Type.Array(Type.String()),
  status: Type.Optional(TaskStatusEnum),
  scope: Type.Optional(TaskScopeEnum),
  risk: Type.Optional(TaskRiskEnum),
  impact: Type.Optional(TaskImpactEnum),
  level: Type.Optional(TaskLevelEnum),
  priority: Type.Optional(TaskPriorityEnum),
  tags: Type.Optional(Type.Array(Type.String())),
  assignee: Type.Optional(Type.String()),
  due: Type.Optional(Type.String()),
  created: Type.Optional(Type.String()),
  modified: Type.Optional(Type.String()),
})
```

Categorical enums are defined with `Type.Union(Type.Literal(...))` — string values matching the DB and frontmatter conventions.

### DependencyEdge schema

```typescript
const DependencyEdge = Type.Object({
  from: Type.String(),  // prerequisite task id
  to: Type.String(),    // dependent task id
})
```

### TaskGraphNodeAttributes schema

Node attributes stored on the graphology graph. The node key is the task `id` (slug). Attributes carry only the metadata needed for graph analysis — no body/content:

```typescript
const TaskGraphNodeAttributes = Type.Object({
  name: Type.String(),
  scope: Type.Optional(TaskScopeEnum),
  risk: Type.Optional(TaskRiskEnum),
  impact: Type.Optional(TaskImpactEnum),
  level: Type.Optional(TaskLevelEnum),
  priority: Type.Optional(TaskPriorityEnum),
  status: Type.Optional(TaskStatusEnum),
})
```

### TaskGraphEdgeAttributes schema

```typescript
const TaskGraphEdgeAttributes = Type.Object({})
```

Edges carry no attributes currently — they are pure dependency edges (prerequisite → dependent).

### SerializedGraph schema

Following the graphology native JSON format, parameterized with our attribute types:

```typescript
const TaskGraphSerialized = SerializedGraph(
  TaskGraphNodeAttributes,
  TaskGraphEdgeAttributes,
  Type.Object({})
)
```

This validates the graphology `export()` output and enables `import()` from validated JSON blobs.

## Graph Model

### Edge direction

**prerequisite → dependent** (matches Rust CLI convention).

If task B has `dependsOn: ["A"]`, the edge is **A → B** (A must complete before B).

In graphology terms:
- `graph.inNeighbors(B)` → prerequisites (what B depends on)
- `graph.outNeighbors(A)` → dependents (what depends on A)
- `graph.addEdge(A, B)` — prerequisite is source, dependent is target

### Construction

The graph must be constructable from multiple sources.

```typescript
// 1. From TaskInput array (frontmatter/JSON — most common)
const graph = TaskGraph.fromTasks(tasks: TaskInput[]): TaskGraph

// 2. From DB query results (alkhub use case)
const graph = TaskGraph.fromRecords(tasks: TaskInput[], edges: DependencyEdge[]): TaskGraph

// 3. From graphology native JSON (export/import round-trip)
const graph = TaskGraph.fromJSON(data: TaskGraphSerialized): TaskGraph

// 4. Incremental construction (programmatic/testing)
const graph = new TaskGraph()
graph.addTask("a", { name: "Task A" })
graph.addTask("b", { name: "Task B", scope: "broad" })
graph.addDependency("a", "b")  // a is prerequisite of b
```

For paths 1 and 2, the preferred internal approach is to build a `SerializedGraph` JSON blob (nodes array + edges array) and call `graph.import()`. This is faster than N individual `addNode`/`addEdge` calls and avoids the verbose builder API. See graphology performance tips at `/workspace/graphology/docs/performance-tips.md`.

### Categorical field defaults

Categorical fields (`scope`, `risk`, `impact`, `level`) are optional (nullable) — NULL means "not yet assessed." The analysis functions need numeric values, so we provide a `resolveDefaults` helper:

```typescript
function resolveDefaults(attrs: TaskGraphNodeAttributes): ResolvedTaskAttributes
```

This maps None → the Rust CLI's default values:
- risk: None → successProbability 0.80 (medium), riskWeight 0.20
- scope: None → costEstimate 2.0 (narrow)
- impact: None → weight 1.0 (isolated)

The raw nullable data is preserved on the graph. `resolveDefaults` is called internally by analysis functions but is also available to consumers that need the same default logic.

### Task metadata lives on nodes

Unlike the original napi design where `DependencyGraph` only stored IDs, node attributes carry the categorical metadata directly. This eliminates the need to pass `TaskInput[]` alongside the graph — `weightedCriticalPath` and `riskPath` read attributes from the graph nodes. The graph acts as an in-memory index/metadata store; task body content stays external.

## API Surface

### TaskGraph class

```typescript
class TaskGraph {
  // Construction
  static fromTasks(tasks: TaskInput[]): TaskGraph
  static fromRecords(tasks: TaskInput[], edges: DependencyEdge[]): TaskGraph
  static fromJSON(data: TaskGraphSerialized): TaskGraph
  addTask(id: string, attributes: TaskGraphNodeAttributes): void
  addDependency(prerequisite: string, dependent: string): void

  // Queries
  hasCycles(): boolean
  findCycles(): string[][]
  topologicalOrder(): string[] | null
  dependencies(taskId: string): string[]
  dependents(taskId: string): string[]
  taskCount(): number
  getTask(taskId: string): TaskGraphNodeAttributes | undefined

  // Analysis
  parallelGroups(): string[][]
  criticalPath(): string[]
  weightedCriticalPath(weightFn: (taskId: string, attrs: TaskGraphNodeAttributes) => number): string[]
  bottlenecks(): Array<{ taskId: string; score: number }>

  // Cost-benefit (methods that use categorical data on nodes)
  riskPath(): RiskPathResult
  shouldDecompose(taskId: string): DecomposeResult
  workflowCost(options?: { includeCompleted?: boolean; limit?: number }): WorkflowCostResult
  riskDistribution(): RiskDistributionResult

  // Validation
  validateSchema(): ValidationError[]
  validateGraph(): GraphValidationError[]
  validate(): ValidationError[]

  // Export
  export(): TaskGraphSerialized
  toJSON(): TaskGraphSerialized
}
```

### Standalone functions (can be used without TaskGraph class)

```typescript
// Categorical enum numeric methods
function scopeCostEstimate(scope: TaskScope): number       // 1.0–5.0
function scopeTokenEstimate(scope: TaskScope): number      // 500–10000
function riskSuccessProbability(risk: TaskRisk): number    // 0.50–0.98
function riskWeight(risk: TaskRisk): number                // 0.02–0.50
function impactWeight(impact: TaskImpact): number          // 1.0–3.0

// Defaults resolution
function resolveDefaults(attrs: Partial<TaskGraphNodeAttributes>): ResolvedTaskAttributes

// Cost-benefit
function calculateTaskEv(p: number, scopeCost: number, impactWeight: number): number
function shouldDecomposeTask(attrs: TaskGraphNodeAttributes): DecomposeResult
```

### Return types

```typescript
interface RiskPathResult {
  path: string[]
  totalRisk: number
}

interface DecomposeResult {
  shouldDecompose: boolean
  reasons: string[]  // e.g. ["risk: high", "scope: broad"]
}

interface WorkflowCostResult {
  tasks: Array<{
    taskId: string
    name: string
    ev: number
    probability: number
    scopeCost: number
    impactWeight: number
  }>
  totalEv: number
  averageEv: number
}

interface RiskDistributionResult {
  trivial: string[]
  low: string[]
  medium: string[]
  high: string[]
  critical: string[]
  unspecified: string[]
}
```

## Validation

Two levels, consistent with the Rust CLI's `validate` command:

1. **`validateSchema()`** — typebox `Value.Check` on input data (frontmatter fields, enum values, required fields)
2. **`validateGraph()`** — graph-level invariants: cycle detection, dangling dependency references
3. **`validate()`** — both, for convenience

## Frontmatter Parsing

Included in this package (not a separate module). Supports the same YAML frontmatter format as the Rust CLI.

```typescript
function parseFrontmatter(markdown: string): TaskInput
function parseTaskFile(filePath: string): Promise<TaskInput>
function parseTaskDirectory(dirPath: string): Promise<TaskInput[]>
function serializeFrontmatter(task: TaskInput, body?: string): string
```

Uses `gray-matter` (or equivalent) for the `---` delimited YAML split, then validates with typebox. The `serializeFrontmatter` function generates a markdown file from a `TaskInput`, supporting the `init` action.

## Project Structure

```
taskgraph_ts/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public API surface, re-exports
│   ├── schema/
│   │   ├── index.ts           # Re-exports all schemas
│   │   ├── enums.ts           # TaskScope, TaskRisk, TaskImpact, TaskLevel, TaskStatus, TaskPriority
│   │   ├── task.ts            # TaskInput, DependencyEdge schemas
│   │   ├── graph.ts           # TaskGraphNodeAttributes, TaskGraphEdgeAttributes, SerializedGraph
│   │   └── results.ts         # RiskPathResult, DecomposeResult, WorkflowCostResult, RiskDistributionResult
│   ├── graph/
│   │   ├── index.ts           # TaskGraph class
│   │   ├── construction.ts    # fromTasks, fromRecords, fromJSON, incremental building
│   │   └── queries.ts         # hasCycles, findCycles, topologicalOrder, dependencies, dependents
│   ├── analysis/
│   │   ├── index.ts           # Re-exports
│   │   ├── critical-path.ts   # criticalPath, weightedCriticalPath
│   │   ├── bottleneck.ts      # bottlenecks (graphology betweenness)
│   │   ├── risk.ts            # riskPath, riskDistribution
│   │   ├── cost-benefit.ts    # calculateTaskEv, workflowCost
│   │   ├── decompose.ts       # shouldDecompose
│   │   └── defaults.ts        # resolveDefaults, enum numeric methods
│   ├── frontmatter/
│   │   ├── index.ts           # parseFrontmatter, parseTaskFile, parseTaskDirectory, serializeFrontmatter
│   │   ├── parse.ts           # YAML/frontmatter parsing + typebox validation
│   │   └── serialize.ts       # TaskInput → markdown with frontmatter
│   └── error/
│       └── index.ts           # TaskgraphError, TaskNotFoundError, CircularDependencyError, InvalidInputError
├── test/
│   ├── graph.test.ts
│   ├── analysis.test.ts
│   ├── schema.test.ts
│   ├── frontmatter.test.ts
│   └── cost-benefit.test.ts
└── docs/
    └── architecture.md         # This file
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `graphology` | Directed graph data structure |
| `graphology-dag` | hasCycle, topologicalSort, topologicalGenerations |
| `graphology-metrics` | betweenness centrality (bottleneck) |
| `graphology-components` | connected/strongly-connected components |
| `graphology-operators` | subgraph extraction |
| `@alkdev/typebox` | Schema definition, static types, runtime validation |
| `gray-matter` | YAML frontmatter extraction from markdown |

## Build & Distribution

- **Package**: `@alkdev/taskgraph` on npm
- **Module**: ESM primary, CJS compat
- **Targets**: Node 18+, Deno, Bun — pure JS, no native addons
- **Build**: `tsc` for declarations + bundler for distribution
- **No platform-specific binaries** — this is the whole point of the pivot

## Open Questions

1. **YAML parser choice** — `gray-matter` bundles its own YAML handling. Do we need a separate `yaml` dependency, or does gray-matter's built-in handling suffice for our frontmatter format?

2. **`findCycles` implementation** — graphology doesn't expose cycle extraction (only `hasCycle`). We need to implement DFS-based cycle extraction ourselves. Straightforward but worth noting.

3. **`workflow-cost` DAG propagation** — The Rust CLI computes EV per-task independently (no upstream quality degradation). The Python research notebook has a DAG-propagation model. Should we implement the basic version (matching Rust) or include DAG propagation from the start?

4. **Zod interop** — `@alkdev/typebox` includes a `typemap` module for Zod compatibility. If consumers are forced into Zod by other parts of their stack, we can provide typebox ↔ zod conversion. Not v1, but noted.

5. **Graph event listeners** — graphology supports event listeners on node/edge mutations. Should `TaskGraph` expose these, or is that the caller's job if they need reactivity?

## Performance Notes

From graphology's performance tips (`/workspace/graphology/docs/performance-tips.md`):

- Prefer callback iteration (`forEachNode`, `forEachEdge`) over array-returning methods (`nodes()`, `edges()`) when iterating
- Use `addEdgeWithKey` with simple incremental keys instead of `addEdge` to skip the automatic key generation overhead
- Avoid callback nesting in hot loops; hoist inner callbacks
- For bulk construction, `graph.import(serializedData)` is faster than N individual add calls

Realistic task graphs (10–200 nodes) make all of this academic, but the patterns are free to adopt.

## Threat Model Context

For background on the security motivation:

- **Attack vector**: Agents with bash access processing untrusted content (web pages, academic papers, API responses) can be manipulated via prompt injection. This includes subtle attacks like Unicode steganography hiding instructions in otherwise legitimate content.
- **Defense in depth**: The instruction firewall project (using Ternary Bonsai 1.7b classifier to detect instruction-bearing content) addresses detection. This project addresses the other side — reducing the blast radius by removing bash as a requirement for analysis operations.
- **Tool-based access**: Instead of `taskgraph --json list | jq`, agents call `task.list()` as a tool. No shell, no injection surface, no data exfiltration path through bash.

## References

- Rust taskgraph CLI: `/workspace/@alkimiadev/taskgraph/`
- graphology monorepo: `/workspace/graphology/`
- alkhub task storage spec: `/workspace/@alkdev/alkhub_ts/docs/architecture/storage/tasks.md`
- @alkdev/typebox: `/workspace/@alkdev/typebox/`
- open-memory plugin (registry pattern ref): `/workspace/@alkdev/open-memory/`
- open-coordinator plugin (registry pattern ref): `/workspace/@alkimiadev/open-coordinator/`
- Older graphology + typebox POC: `/workspace/lbug_test/convert_graphology.ts`
- Older taskgraph MCP POC (graphology usage ref): `/workspace/tools/ade_mcp/src/core/TaskGraphManager.ts`