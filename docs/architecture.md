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

`init` is the **only write action**. All other actions are read-only. This matters for the security model: a read-only task tool is safe to expose to any agent; `init` requires write scope.

## What We Replicate from taskgraph (Rust)

### DependencyGraph — all algorithms

| Operation | Source (Rust) | Implementation (TS) |
|-----------|---------------|---------------------|
| `hasCycles` | petgraph `is_cyclic_directed` | `graphology-dag` `hasCycle` |
| `findCycles` | DFS with recursion stack | Custom: DFS with 3-color marking + back-edge path extraction (see §findCycles) |
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
- `workflowCost` — DAG-propagation EV aggregation (see §Workflow-Cost DAG Propagation). Skips completed tasks unless flagged.
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
- Zod interop — typebox is the sole schema system. No Zod bridge planned. Consumers with Zod in their stack can convert at their boundary.

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
  from: Type.String(),              // prerequisite task id
  to: Type.String(),                // dependent task id
  qualityDegradation: Type.Optional(Type.Number()),  // 0.0–1.0, default 0.9
})
```

The `qualityDegradation` field models how much upstream failure bleeds through to the dependent task. Value of 0.0 means no propagation (independent model), 1.0 means full propagation. Default is 0.9 following the Python research model. Only used by `workflowCost` in DAG-propagation mode; ignored by all other algorithms.

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
const TaskGraphEdgeAttributes = Type.Object({
  qualityDegradation: Type.Optional(Type.Number()),
})
```

Edges carry `qualityDegradation` for the DAG-propagation cost model. If absent, the default (0.9) is used by `workflowCost`. Other algorithms ignore edge attributes.

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

// 2. From DB query results (alkhub use case — explicit edges with optional qualityDegradation)
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

**Note on qualityDegradation:** `fromTasks` constructs edges from `dependsOn` arrays in frontmatter, which cannot express per-edge `qualityDegradation`. Those edges get the default (0.9). `fromRecords` and `fromJSON` support per-edge values. Edges can be augmented after construction via `updateEdgeAttributes` if needed.

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

### Graph reactivity

graphology's `Graph` class extends Node.js `EventEmitter` and emits fine-grained mutation events: `nodeAdded`, `edgeAdded`, `nodeDropped`, `edgeDropped`, `nodeAttributesUpdated`, `edgeAttributesUpdated`, `cleared`, `edgesCleared`. `TaskGraph` does **not** wrap or re-emit these. Consumers that need reactivity (e.g., the OpenCode plugin for file-watch → coordinator notification) access the underlying graphology instance via `graph.raw` and attach listeners directly. This keeps `TaskGraph` as a pure computation library with no opinion about reactivity.

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

  // Mutation
  removeTask(id: string): void
  removeDependency(prerequisite: string, dependent: string): void
  updateTask(id: string, attributes: Partial<TaskGraphNodeAttributes>): void
  updateEdgeAttributes(prerequisite: string, dependent: string, attrs: Partial<TaskGraphEdgeAttributes>): void

  // Queries
  hasCycles(): boolean
  findCycles(): string[][]
  topologicalOrder(): string[]  // throws CircularDependencyError if cyclic
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
  workflowCost(options?: WorkflowCostOptions): WorkflowCostResult
  riskDistribution(): RiskDistributionResult

  // Subgraph
  subgraph(filter: (taskId: string, attrs: TaskGraphNodeAttributes) => boolean): TaskGraph

  // Validation
  validateSchema(): ValidationError[]
  validateGraph(): GraphValidationError[]
  validate(): ValidationError[]

  // Export
  export(): TaskGraphSerialized
  toJSON(): TaskGraphSerialized

  // Reactivity
  get raw(): Graph  // underlying graphology instance for direct event listener attachment
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
function calculateTaskEv(p: number, scopeCost: number, impactWeight: number, config?: EvConfig): EvResult
function shouldDecomposeTask(attrs: TaskGraphNodeAttributes): DecomposeResult
```

### Return types

```typescript
import { Type, Static } from "@alkdev/typebox";


export const RiskPathResult = Type.Object({
  path: Type.Array(Type.String()),
  totalRisk: Type.Number(),
});
export type RiskPathResult = Static<typeof RiskPathResult>;

export const DecomposeResult = Type.Object({
  shouldDecompose: Type.Boolean(),
  reasons: Type.Array(Type.String()),
});
export type DecomposeResult = Static<typeof DecomposeResult>;

export const WorkflowCostOptions = Type.Object({
  includeCompleted: Type.Optional(Type.Boolean()),
  limit: Type.Optional(Type.Number()),
  propagationMode: Type.Optional(
    Type.Union([Type.Literal("independent"), Type.Literal("dag-propagate")])
  ),
  defaultQualityDegradation: Type.Optional(Type.Number()),
});
export type WorkflowCostOptions = Static<typeof WorkflowCostOptions>;


export const WorkflowCostResult = Type.Object({
  tasks: Type.Array(
    Type.Object({
      taskId: Type.String(),
      name: Type.String(),
      ev: Type.Number(),
      pIntrinsic: Type.Number(),
      pEffective: Type.Number(),
      probability: Type.Number(),
      scopeCost: Type.Number(),
      impactWeight: Type.Number(),
    })
  ),
  totalEv: Type.Number(),
  averageEv: Type.Number(),
  propagationMode: Type.Union([
    Type.Literal("independent"),
    Type.Literal("dag-propagate"),
  ]),
});
export type WorkflowCostResult = Static<typeof WorkflowCostResult>;

export const EvConfig = Type.Object({
  retries: Type.Optional(Type.Number()),
  fallbackCost: Type.Optional(Type.Number()),
  timeLost: Type.Optional(Type.Number()),
  valueRate: Type.Optional(Type.Number()),
});
export type EvConfig = Static<typeof EvConfig>;

export const EvResult = Type.Object({
  ev: Type.Number(),
  pSuccess: Type.Number(),
  expectedRetries: Type.Number(),
});
export type EvResult = Static<typeof EvResult>;

export const RiskDistributionResult = Type.Object({
  trivial: Type.Array(Type.String()),
  low: Type.Array(Type.String()),
  medium: Type.Array(Type.String()),
  high: Type.Array(Type.String()),
  critical: Type.Array(Type.String()),
  unspecified: Type.Array(Type.String()),
});
export type RiskDistributionResult = Static<typeof RiskDistributionResult>;
```

## findCycles Implementation

graphology does not provide a cycle extraction function — only `hasCycle` (boolean) and `stronglyConnectedComponents` (node groups, not paths). We implement a custom DFS cycle path extractor in `src/graph/queries.ts`.

**Algorithm:** Extend the 3-color DFS (WHITE/GREY/BLACK) used by `graphology-dag`'s `hasCycle`. When a back edge is found (GREY → GREY), trace back through the recursion stack to extract the cycle path as an ordered node sequence. This returns the actual cycle paths needed for error reporting in `validate()`.

**Optimization:** Use `stronglyConnectedComponents()` from `graphology-components` as a fast pre-check. If there are zero multi-node SCCs (and no self-loops), skip the DFS entirely — the graph is acyclic.

**Relationship to `topologicalOrder`:** `topologicalOrder()` throws `CircularDependencyError` (with `cycles` populated) when the graph is cyclic, rather than returning `null`. This prevents silent ignoring of cycles and gives consumers the cycle information needed for error reporting.

## Workflow-Cost DAG Propagation

The Rust CLI computes EV per-task independently — no upstream quality degradation. As the framework doc in the Rust source notes, this is a simplified model (the "Kuhn poker analogy") — it captures a structural property of the problem but ignores how upstream failure degrades downstream work. The Python research notebook (`/workspace/@alkimiadev/taskgraph/docs/research/cost_benefit_analysis_framework.py`) implements a DAG-propagation model that addresses this.

### Why DAG propagation matters

The independent model is dangerously optimistic for non-trivial workflows. In a dependency chain where planning has p=0.65 (poor), the Python model shows a **213% cost increase** vs good planning (p=0.92). The independent model barely shows a difference because it ignores cascading failure. This structural property is independent of the "type" of developer — human, LLM, or otherwise.

### Implementation

We implement DAG propagation as the default mode, with the independent model as a degenerate case:

```typescript
function calculateWorkflowCost(graph, options): WorkflowCostResult {
  const topoOrder = graph.topologicalOrder()
  const upstreamSuccessProbs = new Map<string, number>()
  let totalEv = 0

  for (const nodeId of topoOrder) {
    const pEff = options.propagationMode === 'dag-propagate'
      ? computeEffectiveP(nodeId, upstreamSuccessProbs, graph, options)
      : getIntrinsicP(nodeId)

    const { ev, pSuccess } = calculateTaskEv(pEff, scopeCost, impactWeight, config)
    upstreamSuccessProbs.set(nodeId, pSuccess)
    totalEv += ev * impactWeight
  }
}

function computeEffectiveP(nodeId, upstreamSuccessProbs, graph, options): number {
  const parents = graph.dependencies(nodeId)  // inNeighbors
  if (parents.length === 0) return getIntrinsicP(nodeId)

  let inheritedQuality = 1.0
  for (const parent of parents) {
    const parentP = upstreamSuccessProbs.get(parent)
    const degradation = getEdgeDegradation(parent, nodeId) ?? options.defaultQualityDegradation
    inheritedQuality *= (parentP + (1 - parentP) * (1 - degradation))
  }
  return getIntrinsicP(nodeId) * inheritedQuality
}
```

**Key design choices:**
- **Default mode:** `dag-propagate` — the independent model is the degenerate case (set `defaultQualityDegradation: 0`)
- **Edge-level `qualityDegradation`** — carried on `TaskGraphEdgeAttributes`, defaults to 0.9. Expressible via `fromRecords` and `fromJSON`; frontmatter `dependsOn` gets the default.
- **Per-task output includes both `pIntrinsic` and `pEffective`** so consumers can see the degradation effect
- **Depth-escalation** (increasing risk at deeper chain levels) is a future v2 consideration pending empirical calibration data from actual task outcomes

### Comparison with Rust CLI

| Dimension | Rust CLI (Simple Sum) | TS (DAG Propagation) |
|-----------|----------------------|---------------------|
| Topology awareness | None | Full — topological order + upstream propagation |
| Upstream failure modeling | Ignored | Each parent's failure degrades child's effective p |
| Edge semantics | Not used | `qualityDegradation` per edge, default 0.9 |
| Result interpretation | Sum of independent per-task costs | Total workflow cost accounting for cascading failure |
| Degenerate case | — | Set `propagationMode: 'independent'` or `defaultQualityDegradation: 0` |

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

### No gray-matter — self-contained splitter + `yaml`

We write our own `---` delimited frontmatter splitter (~40 lines) and use `yaml` (by eemeli) as the sole YAML parser. **`gray-matter` is not a dependency.**

This is a deliberate supply-chain security decision:

- **`gray-matter` depends on `js-yaml@3.x`** — an old version with known code injection vulnerabilities, pinned but unmaintained (last publish April 2021). Even with gray-matter's custom engine API, `js-yaml` is still *installed* in `node_modules` as a transitive dependency. The attack surface is the install, not the import.
- **js-yaml has an active CVE** (CVE-2025-64718 — prototype pollution via YAML merge key `<<`). Installing it at all is unacceptable.
- **gray-matter's full tree is 11 packages** (js-yaml, argparse, kind-of, section-matter, extend-shallow, is-extendable, strip-bom-string, etc.) — none of which we need for our use case.
- **Recent npm supply chain attacks** (April 2026: 18-package phishing compromise targeting chalk/debug/etc., the Shai-Hulud self-replicating worm hitting 500+ packages, the axios RAT incident) demonstrate that every dependency in the tree is potential attack surface. Small, focused libraries with zero transitive deps are the class of packages most likely to survive the current ecosystem trend — massive dependency trees for trivial functionality are becoming a liability.

**The splitter implementation:**

```typescript
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'

const DELIMITER = '---'

function splitFrontmatter(str: string): { data: string; content: string } | null {
  if (!str.startsWith(DELIMITER)) return null
  if (str.charAt(DELIMITER.length) === DELIMITER.slice(-1)) return null

  const afterOpen = str.slice(DELIMITER.length)
  const closeIndex = afterOpen.indexOf('\n' + DELIMITER)
  if (closeIndex === -1) return null

  const data = afterOpen.slice(0, closeIndex)
  const content = afterOpen.slice(closeIndex + 1 + DELIMITER.length).replace(/^\r?\n/, '')
  return { data, content }
}

function parseFrontmatter(markdown: string): { data: Record<string, unknown>; content: string } {
  const split = splitFrontmatter(markdown)
  if (!split || split.data.trim() === '') return { data: {}, content: split?.content ?? markdown }
  return { data: yamlParse(split.data), content: split.content }
}

function serializeFrontmatter(task: TaskInput, body?: string): string {
  const frontmatter = yamlStringify(task)
  return DELIMITER + '\n' + frontmatter + DELIMITER + '\n' + (body ?? '')
}
```

**What we don't replicate from gray-matter:** TOML/Coffee engines, JavaScript eval engine, `section-matter` (nested sections), in-memory cache, `stringify()`. We don't use any of these. The `yaml` package handles `stringify` natively.

**`yaml` package profile:**
- Zero dependencies, full YAML 1.2 spec compliance, no known CVEs
- Actively maintained, excellent TypeScript types
- Single-package blast radius — if it's ever compromised, we fork it (pure JS, tractable to maintain)

### WASM YAML parser — considered and rejected

A Rust YAML crate compiled to WASM was considered as an alternative. This would eliminate even the `yaml` JS dependency, but it reintroduces complexity the napi→graphology pivot was designed to remove (Rust toolchain in CI, WASM compile target, cold-start latency, FFI boundary). The marginal security gain over `yaml` (already zero-dep) doesn't justify the added build complexity.

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
│   │   ├── queries.ts         # hasCycles, findCycles, topologicalOrder, dependencies, dependents
│   │   └── mutation.ts        # removeTask, removeDependency, updateTask, updateEdgeAttributes
│   ├── analysis/
│   │   ├── index.ts           # Re-exports
│   │   ├── critical-path.ts   # criticalPath, weightedCriticalPath
│   │   ├── bottleneck.ts      # bottlenecks (graphology betweenness)
│   │   ├── risk.ts            # riskPath, riskDistribution
│   │   ├── cost-benefit.ts    # calculateTaskEv, workflowCost, computeEffectiveP
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
| `graphology` | Directed graph data structure + event emitter |
| `graphology-dag` | hasCycle, topologicalSort, topologicalGenerations |
| `graphology-metrics` | betweenness centrality (bottleneck) |
| `graphology-components` | strongly-connected components (findCycles pre-check) |
| `graphology-operators` | subgraph extraction |
| `@alkdev/typebox` | Schema definition, static types, runtime validation |
| `yaml` | YAML 1.2 parser (zero dependencies, no known CVEs) |

## Build & Distribution

- **Package**: `@alkdev/taskgraph` on npm
- **Module**: ESM primary, CJS compat
- **Targets**: Node 18+, Deno, Bun — pure JS, no native addons
- **Build**: `tsc` for declarations + bundler for distribution
- **No platform-specific binaries** — this is the whole point of the pivot

## Resolved Design Decisions

1. **Incremental vs rebuild on file change** — **Rebuild.** For our graph sizes (10–200 nodes), `graph.import()` from a serialized blob is sub-millisecond. Incremental updates would require tracking ID renames, dependency removals, and edge reconciliation — a whole change-detection layer for zero measurable performance gain. Both consumers (alkhub builds from DB query results; OpenCode plugin rebuilds from directory on file change) are well-served by rebuild. If a future use case requires incremental updates, add it as an optimization then.

2. **Subgraph behavior** — **Strict internal-only.** `subgraph(filter)` returns a new `TaskGraph` with matching nodes and only edges where both endpoints are in the filtered set. This matches `graphology-operators` `subgraph` behavior and produces valid subgraphs for all algorithms (topo sort, betweenness, etc.). External dependency information is available on the original graph via `dependencies()`/`dependents()`. A separate `externalDependencies(filter)` utility can be added later if consumers need "show me what this subgraph depends on outside itself."

3. **`topologicalOrder` on cyclic graph** — **Throw `CircularDependencyError`.** Both consumers treat cycles as bugs: alkhub's data comes from a validated DB schema; the OpenCode plugin's data comes from frontmatter that should be validated before graph construction. A partial ordering return type adds API complexity for a case that shouldn't happen in practice. `findCycles()` already exists for debugging when cycles are detected.

4. **`workflowCost` skip-completed semantics** — **Always propagate through completed nodes; exclude from output only.** When `includeCompleted: false`, completed tasks are excluded from the result's task list, but they **remain in the propagation chain** with p=1.0. Removing completed tasks from propagation would *worsen* downstream probability estimates — exactly the opposite of what "what's left" queries need. The "show me what's done / not done" UX concern belongs in `list` with status filtering, not in `workflowCost`.

5. **Depth-escalation for DAG propagation** — **Deferred to v2.** The multiplicative propagation model already captures depth effects implicitly: each hop compounds another `<1.0` factor. The Python research model shows substantial EV divergence between good and poor upstream planning (213% cost increase) purely from this compounding — without any explicit depth penalty. Adding an explicit depth heuristic on top would double-count the depth effect until we have empirical calibration data. The architecture supports future depth-escalation via per-edge `qualityDegradation` adjustments or `risk` categorical escalation without API changes.

6. **Edge key generation** — **Adopt `${source}->${target}` keys from the start.** Using `addEdgeWithKey` with deterministic keys (`task-a->task-b`) avoids graphology's random key generation overhead and produces readable/debuggable edge identifiers. The constraint — no parallel edges between the same node pair — is correct for DAG dependency graphs. Duplicate dependency declarations are a validation error, not a valid use case.

## Class Decomposition: Avoiding the Monolith

The `TaskGraph` class as specified has ~25 methods spanning graph construction, mutation, queries, analysis, cost-benefit math, validation, and export. Making it a monolith would create duplicate work: both alkhub and the OpenCode plugin need to call the same analysis functions, but through different dispatch mechanisms.

**The library is decomposed into standalone functions + a thin `TaskGraph` data class.**

The `TaskGraph` class handles **graph construction, mutation, and basic queries only**:

```typescript
class TaskGraph {
  // Construction
  static fromTasks(tasks: TaskInput[]): TaskGraph
  static fromRecords(tasks: TaskInput[], edges: DependencyEdge[]): TaskGraph
  static fromJSON(data: TaskGraphSerialized): TaskGraph
  addTask(id: string, attributes: TaskGraphNodeAttributes): void
  addDependency(prerequisite: string, dependent: string): void

  // Mutation
  removeTask(id: string): void
  removeDependency(prerequisite: string, dependent: string): void
  updateTask(id: string, attributes: Partial<TaskGraphNodeAttributes>): void
  updateEdgeAttributes(prerequisite: string, dependent: string, attrs: Partial<TaskGraphEdgeAttributes>): void

  // Queries
  hasCycles(): boolean
  findCycles(): string[][]
  topologicalOrder(): string[]
  dependencies(taskId: string): string[]
  dependents(taskId: string): string[]
  taskCount(): number
  getTask(taskId: string): TaskGraphNodeAttributes | undefined

  // Export
  export(): TaskGraphSerialized
  toJSON(): TaskGraphSerialized
  get raw(): Graph
}
```

**All analysis functions are standalone** — they take a `TaskGraph` (or its underlying `Graph`) as their first argument. This is what the project structure already reflects (`src/analysis/critical-path.ts`, `src/analysis/risk.ts`, etc.):

```typescript
// Analysis functions (standalone, composable)
function parallelGroups(graph: TaskGraph): string[][]
function criticalPath(graph: TaskGraph): string[]
function weightedCriticalPath(graph: TaskGraph, weightFn: ...): string[]
function bottlenecks(graph: TaskGraph): Array<{ taskId: string; score: number }>
function riskPath(graph: TaskGraph): RiskPathResult
function shouldDecomposeTask(attrs: TaskGraphNodeAttributes): DecomposeResult
function workflowCost(graph: TaskGraph, options?: WorkflowCostOptions): WorkflowCostResult
function riskDistribution(graph: TaskGraph): RiskDistributionResult
```

**The operations pattern (env/registry) belongs at the consumer layer, not the library layer.** The library exports pure functions. The OpenCode plugin wraps them in its own dispatch (`task({action: "workflowCost"})`). alkhub wraps them in its own operation definitions. The library doesn't need a registry — it's a toolkit, not a service.

This avoids duplicate work: the same `workflowCost` implementation is called by both consumers, each wrapping it in their own dispatch mechanism.

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
- **Supply chain defense**: We write our own `---` frontmatter splitter (~40 lines) and depend only on `yaml` (zero transitive deps, no known CVEs). No `gray-matter`, no `js-yaml` — eliminates 11 packages from the tree. Recent npm supply chain attacks (18-package phishing compromise, Shai-Hulud self-replicating worm, axios RAT) demonstrate that every installed dependency is attack surface. Small, focused libraries with zero transitive deps are the class of packages most likely to survive the current ecosystem trend — massive dependency trees for trivial functionality are becoming a liability.

## References

- Rust taskgraph CLI: `/workspace/@alkimiadev/taskgraph/`
- graphology monorepo: `/workspace/graphology/`
- alkhub task storage spec: `/workspace/@alkdev/alkhub_ts/docs/architecture/storage/tasks.md`
- @alkdev/typebox: `/workspace/@alkdev/typebox/`
- open-memory plugin (registry pattern ref): `/workspace/@alkdev/open-memory/`
- open-coordinator plugin (registry pattern ref): `/workspace/@alkimiadev/open-coordinator/`
- Older graphology + typebox POC: `/workspace/lbug_test/convert_graphology.ts`
- Older taskgraph MCP POC (graphology usage ref): `/workspace/tools/ade_mcp/src/core/TaskGraphManager.ts`
- Python cost-benefit research: `/workspace/@alkimiadev/taskgraph/docs/research/cost_benefit_analysis_framework.py`