# TaskGraph Rust Source - Comprehensive Research Report

> Source: `/workspace/@alkimiadev/taskgraph` (Rust CLI project)
> Report date: 2026-04-23
> Version: 0.1.3

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Cargo.toml Details](#2-cargotoml-details)
3. [Core Data Types and Public APIs](#3-core-data-types-and-public-apis)
4. [Functions/Methods to Expose via NAPI](#4-functionsmethods-to-expose-via-napi)
5. [Serialization (Serde) Support](#5-serialization-serde-support)
6. [Error Types and Error Handling](#6-error-types-and-error-handling)
7. [Input/Output Patterns](#7-inputoutput-patterns)
8. [Existing Tests and Benchmarks](#8-existing-tests-and-benchmarks)

---

## 1. Project Structure

### Directory Layout

```
taskgraph/
├── Cargo.toml              # Package manifest (single crate, not a workspace)
├── Cargo.lock               # Locked dependencies
├── LICENSE-APACHE           # Apache-2.0 license
├── LICENSE-MIT              # MIT license
├── README.md                # User-facing documentation
├── AGENTS.md                # AI agent context file
├── opencode.json            # OpenCode configuration
├── .github/
│   └── workflows/
│       └── ci.yml           # CI: fmt, clippy, test, coverage
├── docs/
│   ├── ARCHITECTURE.md      # Full architecture spec
│   ├── framework.md         # Cost-benefit framework rationale
│   ├── workflow.md          # Practical workflow guide
│   ├── implementation.md   # Tools/models/guidelines
│   ├── phase-1.md through phase-4.md  # Phase plans
│   ├── issues/              # Blocking issues tracking
│   ├── reviews/             # Code review docs
│   └── research/
│       └── cost_benefit_analysis_framework.py
├── scripts/
│   └── benchmark.sh         # Manual benchmark script
├── benches/
│   └── graph_benchmarks.rs  # Criterion benchmarks
├── src/
│   ├── main.rs              # Binary entry point (thin: parse CLI, execute)
│   ├── lib.rs               # Library root - re-exports public API
│   ├── cli.rs               # CLI argument definitions (clap derive)
│   ├── task.rs              # Task, TaskFrontmatter, enums (serde types)
│   ├── graph.rs             # DependencyGraph (petgraph wrapper)
│   ├── error.rs             # Error enum (thiserror)
│   ├── config.rs            # Config loading (.taskgraph.toml)
│   ├── discovery.rs         # TaskCollection (directory scanning)
│   └── commands/
│       ├── mod.rs            # Command module re-exports
│       ├── init.rs           # `init` command
│       ├── validate.rs       # `validate` command
│       ├── list.rs           # `list` command
│       ├── show.rs            # `show` command
│       ├── deps.rs            # `deps` command
│       ├── topo.rs            # `topo` command
│       ├── cycles.rs          # `cycles` command
│       ├── parallel.rs        # `parallel` command
│       ├── critical.rs        # `critical` command
│       ├── bottleneck.rs      # `bottleneck` command
│       ├── risk.rs            # `risk` command
│       ├── decompose.rs       # `decompose` command
│       ├── workflow_cost.rs   # `workflow-cost` command
│       ├── risk_path.rs       # `risk-path` command
│       └── graph_cmd.rs       # `graph` command (DOT output)
└── tests/
    ├── integration/
    │   └── commands.rs        # 25 integration tests (assert_cmd)
    └── fixtures/
        ├── tasks/             # 3 valid tasks (one depends on another)
        ├── cycles/             # 3 tasks forming a cycle
        ├── invalid/            # 1 task with missing dependency
        ├── risk/               # 5 tasks with various risk levels
        └── decompose/          # 4 tasks for decomposition testing
```

### Module Dependency Graph

```
lib.rs
  ├── cli          → commands::*, config, discovery, graph
  ├── commands/*   → cli, discovery, graph, task
  ├── config       → error
  ├── discovery    → task, error
  ├── error        → (thiserror, std, serde_yaml, serde_json)
  ├── graph        → discovery, task, petgraph
  └── task         → (serde, chrono, gray_matter, error)
```

### Crates

This is a **single crate** project (not a Cargo workspace). It produces:
- **Library**: `libtaskgraph` (from `src/lib.rs`)
- **Binary**: `taskgraph` (from `src/main.rs`)

---

## 2. Cargo.toml Details

### Package Metadata

| Field | Value |
|-------|-------|
| name | `taskgraph` |
| version | `0.1.3` |
| edition | `2021` |
| license | `MIT OR Apache-2.0` |
| description | CLI tool for managing task dependencies using markdown files |
| repository | `https://github.com/alkimiadev/taskgraph` |
| keywords | `task`, `dependency`, `graph`, `cli`, `markdown` |
| categories | `command-line-utilities`, `development-tools` |

### Dependencies (Production)

| Crate | Version | Features | Purpose |
|-------|---------|----------|---------|
| `petgraph` | `0.7` | - | Directed graph data structure & algorithms (toposort, cycle detection, etc.) |
| `gray_matter` | `0.2` | - | Markdown frontmatter extraction (YAML engine) |
| `serde` | `1.0` | `derive` | Serialization/deserialization framework |
| `serde_json` | `1.0` | - | JSON serialization (for `--format json` output) |
| `serde_yaml` | `0.9` | - | YAML serialization (for frontmatter parsing & roundtrip) |
| `clap` | `4.5` | `derive` | CLI argument parsing |
| `clap_complete` | `4.5` | - | Shell completion generation |
| `chrono` | `0.4` | `serde` | Date/time with serde support |
| `anyhow` | `1.0` | - | Ergonomic error handling (used in CLI/binary) |
| `thiserror` | `2.0` | - | Derived error types (used in library) |
| `dirs` | `6.0` | - | Platform directories (future: global config) |
| `walkdir` | `2.5` | - | Recursive directory walking |
| `tracing` | `0.1` | - | Structured logging |
| `tracing-subscriber` | `0.3` | `env-filter` | Log output formatting |
| `toml` | `0.8` | - | Config file parsing |

### Dev Dependencies

| Crate | Version | Purpose |
|-------|---------|---------|
| `tempfile` | `3.0` | Temporary directories for tests |
| `assert_cmd` | `2.0` | CLI integration testing |
| `predicates` | `3.0` | Assertion predicates for integration tests |
| `criterion` | `0.5` | Benchmarking framework |

### Features

```toml
[features]
default = []
```

No feature flags exist yet. This is a good candidate for adding `napi` feature.

### Release Profile

```toml
[profile.release]
opt-level = 3
lto = true
strip = true
```

---

## 3. Core Data Types and Public APIs

### 3.1 Task (`src/task.rs`)

The central data type. Represents a single task file.

```rust
/// A task with its content.
#[derive(Debug, Clone)]
pub struct Task {
    pub frontmatter: TaskFrontmatter,
    pub body: String,           // Markdown body content
    pub source: Option<String>, // Source file path (if loaded from file)
}
```

**Methods:**

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `id()` | `&self -> &str` | Task ID | Accessor for frontmatter.id |
| `name()` | `&self -> &str` | Task name | Accessor for frontmatter.name |
| `status()` | `&self -> TaskStatus` | Status enum | Accessor for frontmatter.status |
| `depends_on()` | `&self -> &[String]` | Dependency list | Accessor for frontmatter.depends_on |
| `from_file()` | `&Path -> Result<Self>` | Parsed Task | Parse from a .md file on disk |
| `from_markdown()` | `&str, Option<String> -> Result<Self>` | Parsed Task | Parse from markdown string + optional source name |
| `to_markdown()` | `&self -> Result<String, serde_yaml::Error>` | Markdown string | Serialize back to markdown with YAML frontmatter |

**Key observation:** `Task` itself does **NOT** derive `Serialize` or `Deserialize`. Only `TaskFrontmatter` does. The `body` and `source` fields are not serialized through serde - they're managed separately during parse/render.

### 3.2 TaskFrontmatter (`src/task.rs`)

The structured metadata extracted from YAML frontmatter:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskFrontmatter {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub status: TaskStatus,
    #[serde(default, rename = "depends_on")]
    pub depends_on: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub modified: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<TaskScope>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub risk: Option<TaskRisk>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub impact: Option<TaskImpact>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<TaskLevel>,
}
```

**Serde details:**
- All enums use `#[serde(rename_all = "kebab-case")]` for YAML keys
- Optional fields use `skip_serializing_if` to keep output clean
- Tags use `skip_serializing_if = "Vec::is_empty"`
- `depends_on` renamed from Rust `depends_on` (same, but explicitly)
- `status` has a default of `TaskStatus::Pending`

### 3.3 Enum Types (`src/task.rs`)

All enums derive `Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default`.

#### TaskStatus

```rust
#[serde(rename_all = "kebab-case")]
pub enum TaskStatus {
    Pending,       // default
    InProgress,    // "in-progress" in YAML/JSON
    Completed,
    Failed,
    Blocked,
}
```

Also implements `Display` (kebab-case strings).

#### TaskScope

```rust
#[serde(rename_all = "kebab-case")]
pub enum TaskScope {
    Single,    // ~500 tokens, cost 1.0
    Narrow,    // default, ~1500 tokens, cost 2.0
    Moderate,  // ~3000 tokens, cost 3.0
    Broad,     // ~6000 tokens, cost 4.0
    System,    // ~10000 tokens, cost 5.0
}
```

Methods: `token_estimate() -> u32`, `cost_estimate() -> f64`, `Display`

#### TaskRisk

```rust
#[serde(rename_all = "kebab-case")]
pub enum TaskRisk {
    Trivial,   // p=0.98
    Low,       // default, p=0.90
    Medium,    // p=0.80
    High,      // p=0.65
    Critical,  // p=0.50
}
```

Methods: `success_probability() -> f64`, `Display`

#### TaskImpact

```rust
#[serde(rename_all = "kebab-case")]
pub enum TaskImpact {
    Isolated,   // default, weight 1.0
    Component,  // weight 1.5
    Phase,      // weight 2.0
    Project,    // weight 3.0
}
```

Methods: `weight() -> f64`, `Display`

#### TaskLevel

```rust
#[serde(rename_all = "kebab-case")]
pub enum TaskLevel {
    Planning,
    Decomposition,
    Implementation,  // default
    Review,
    Research,
}
```

Methods: `Display` only

### 3.4 DependencyGraph (`src/graph.rs`)

A directed graph of task dependencies built from a `TaskCollection`.

```rust
pub struct DependencyGraph {
    graph: DiGraph<TaskId, ()>,       // petgraph directed graph
    index_map: HashMap<TaskId, NodeIndex>,  // task ID -> node index
}
```

**Edge direction:** `from -> to` means "from must complete before to" (dependency must complete first).

**Public API:**

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `new()` | `-> Self` | Empty graph | Create empty graph |
| `from_collection()` | `&TaskCollection -> Self` | Built graph | Build from discovered tasks |
| `from_tasks()` | `Vec<&Task> -> Self` | Built graph | Build from explicit task list |
| `add_task()` | `&mut self, TaskId` | () | Add node |
| `add_dependency()` | `&mut self, &str, &str` | () | Add edge (from->to); silently ignores unknown IDs |
| `has_cycles()` | `&self -> bool` | Boolean | Uses `petgraph::algo::is_cyclic_directed` |
| `find_cycles()` | `&self -> Vec<Vec<TaskId>>` | Cycles | Custom DFS cycle finder |
| `topological_order()` | `&self -> Option<Vec<TaskId>>` | Order or None | Uses `petgraph::algo::toposort` |
| `dependencies()` | `&self, &str -> Vec<TaskId>` | Incoming neighbors | What this task depends on (direct) |
| `dependents()` | `&self, &str -> Vec<TaskId>` | Outgoing neighbors | What depends on this (direct) |
| `parallel_groups()` | `&self -> Vec<Vec<TaskId>>` | Generations | Tasks grouped by level (can run concurrently) |
| `critical_path()` | `&self -> Vec<TaskId>` | Path | Longest path through the graph |
| `weighted_critical_path()` | `&self, F: Fn(&str)->f64 -> Vec<TaskId>` | Weighted path | Path with highest cumulative weight |
| `bottlenecks()` | `&self -> Vec<(TaskId, usize)>` | Ranked list | Betweenness centrality via path counting |
| `to_dot()` | `&self -> String` | DOT string | GraphViz DOT format export |

Also implements `Default` (returns `new()`).

**Important:** `DependencyGraph` does **NOT** implement `Serialize`/`Deserialize`. It's a compute-only structure built fresh each time from tasks.

### 3.5 TaskCollection (`src/discovery.rs`)

Collection of tasks discovered from a directory:

```rust
#[derive(Debug, Default)]
pub struct TaskCollection {
    tasks: HashMap<String, Task>,        // Tasks indexed by ID
    paths: HashMap<String, PathBuf>,     // File paths indexed by ID
    errors: Vec<DiscoveryError>,         // Parse errors encountered
}
```

**Public API:**

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `new()` | `-> Self` | Empty collection | Constructor |
| `from_directory()` | `&Path -> Self` | Populated collection | Scan directory recursively for .md files |
| `get()` | `&self, &str -> Option<&Task>` | Task or None | Lookup by ID |
| `path()` | `&self, &str -> Option<&PathBuf>` | Path or None | File path for task ID |
| `tasks()` | `&self -> impl Iterator<Item = &Task>` | Iterator | All tasks |
| `ids()` | `&self -> impl Iterator<Item = &str>` | Iterator | All task IDs |
| `len()` | `&self -> usize` | Count | Number of tasks |
| `is_empty()` | `&self -> bool` | Boolean | Empty check |
| `errors()` | `&self -> &[DiscoveryError]` | Errors | Parse errors from discovery |
| `missing_dependencies()` | `&self -> HashMap<String, Vec<String>>` | Map | Task ID -> missing dep IDs |
| `validate()` | `&self -> ValidationResult` | Result | Full validation |

**Important:** `TaskCollection` does **NOT** implement `Serialize`/`Deserialize` either. It's built procedurally.

### 3.6 DiscoveryError (`src/discovery.rs`)

```rust
#[derive(Debug, Clone)]
pub struct DiscoveryError {
    pub path: PathBuf,
    pub message: String,
}
```

No serde derives. Simple struct for error reporting.

### 3.7 ValidationResult (`src/discovery.rs`)

```rust
#[derive(Debug)]
pub struct ValidationResult {
    pub task_count: usize,
    pub errors: Vec<DiscoveryError>,
    pub missing_dependencies: HashMap<String, Vec<String>>,
}
```

Methods: `is_valid() -> bool`, `issue_count() -> usize`

No serde derives on the Rust type itself, but it's converted to `ValidationOutput` (which does derive `Serialize`) in the validate command.

### 3.8 Config (`src/config.rs`)

```rust
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub project: ProjectConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectConfig {
    #[serde(default = "default_tasks_dir")]
    pub tasks_dir: String,  // default: "tasks"
}
```

**API:**

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `from_file()` | `&Path -> Result<Self>` | Config | Load from .taskgraph.toml |
| `find_and_load()` | `-> Option<Self>` | Config or None | Search up directory tree |
| `tasks_path()` | `&self -> PathBuf` | Path | Get tasks directory |

### 3.9 CLI Types (`src/cli.rs`)

```rust
#[derive(Clone, Copy, Debug, Default, ValueEnum)]
pub enum OutputFormat {
    Plain,   // default
    Json,
}

#[derive(Parser, Debug)]
pub struct Cli {
    pub path: Option<String>,
    pub format: OutputFormat,
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    Init { id, name, scope, risk },
    Validate { strict },
    List { status, tag },
    Show { id },
    Deps { id },
    Dependents { id },
    Topo { status },
    Cycles,
    Parallel,
    Critical,
    Bottleneck,
    Risk,
    Decompose,
    WorkflowCost { include_completed, limit },
    RiskPath,
    Graph { output },
    Completions { shell },
}
```

The `Cli::execute()` method dispatches all commands. It creates `TaskCollection` from directory for each command.

### 3.10 Lib.rs Public Re-exports

```rust
pub mod cli;
pub mod commands;
pub mod config;
pub mod discovery;
pub mod error;
pub mod graph;
pub mod task;

pub use config::Config;
pub use discovery::{DiscoveryError, TaskCollection, ValidationResult};
pub use error::{Error, Result};
pub use graph::DependencyGraph;
pub use task::{Task, TaskFrontmatter, TaskImpact, TaskLevel, TaskRisk, TaskScope, TaskStatus};
```

---

## 4. Functions/Methods to Expose via NAPI

### Priority 1: Core Data Types (Must Have)

These are the foundational types that everything else depends on:

| Rust Type | NAPI Class | Why |
|-----------|------------|-----|
| `Task` | `Task` | Central unit of work; must be creatable, readable, serializable from JS |
| `TaskFrontmatter` | Embedded in `Task` or separate class | All metadata is here; JS needs to read/write fields |
| `TaskStatus` | String enum mapping | Simple 5-variant enum; map to JS string union |
| `TaskScope` | String enum mapping | 5 variants with numeric mappings; map to JS string union |
| `TaskRisk` | String enum mapping | 5 variants with probability; map to JS string union |
| `TaskImpact` | String enum mapping | 4 variants with weight; map to JS string union |
| `TaskLevel` | String enum mapping | 5 variants; map to JS string union |

### Priority 2: Core Functions (Must Have)

| Rust Function | NAPI Method | Input | Output | Why |
|---------------|-------------|-------|--------|-----|
| `Task::from_markdown()` | `Task.fromMarkdown(content, source?)` | `string, string?` | `Task` | Parse task from markdown string |
| `Task::from_file()` | `Task.fromFile(path)` | `string` | `Task` | Parse task from file path |
| `Task::to_markdown()` | `task.toMarkdown()` | - | `string` | Serialize task back to markdown |
| `Task::id()` | `task.id` (getter) | - | `string` | Accessor |
| `Task::name()` | `task.name` (getter) | - | `string` | Accessor |
| `Task::status()` | `task.status` (getter) | - | `string` | Accessor |
| `Task::depends_on()` | `task.dependsOn` (getter) | - | `string[]` | Accessor |
| `TaskScope::token_estimate()` | `scope.tokenEstimate()` | - | `number` | Numeric mapping |
| `TaskScope::cost_estimate()` | `scope.costEstimate()` | - | `number` | Numeric mapping |
| `TaskRisk::success_probability()` | `risk.successProbability()` | - | `number` | Numeric mapping |
| `TaskImpact::weight()` | `impact.weight()` | - | `number` | Numeric mapping |

### Priority 3: Collection & Discovery (Must Have)

| Rust Function | NAPI Method | Input | Output | Why |
|---------------|-------------|-------|--------|-----|
| `TaskCollection::from_directory()` | `TaskCollection.fromDirectory(path)` | `string` | `TaskCollection` | Primary entry point: discover all tasks |
| `TaskCollection::new()` | `new TaskCollection()` | - | `TaskCollection` | Empty constructor for building manually |
| `TaskCollection::get()` | `collection.get(id)` | `string` | `Task\|null` | Lookup by ID |
| `TaskCollection::len()` | `collection.length` (getter) | - | `number` | Task count |
| `TaskCollection::ids()` | `collection.ids()` | - | `string[]` | All task IDs |
| `TaskCollection::tasks()` | `collection.tasks()` | - | `Task[]` | All tasks |
| `TaskCollection::errors()` | `collection.errors` (getter) | - | `DiscoveryError[]` | Parse errors |
| `TaskCollection::missing_dependencies()` | `collection.missingDependencies()` | - | `Record<string, string[]>` | Find broken deps |
| `TaskCollection::validate()` | `collection.validate()` | - | `ValidationResult` | Full validation |

### Priority 4: Graph Operations (Must Have)

| Rust Function | NAPI Method | Input | Output | Why |
|---------------|-------------|-------|--------|-----|
| `DependencyGraph::from_collection()` | `DependencyGraph.fromCollection(collection)` | `TaskCollection` | `DependencyGraph` | Build graph |
| `DependencyGraph::new()` | `new DependencyGraph()` | - | `DependencyGraph` | Empty graph constructor |
| `DependencyGraph::from_tasks()` | `DependencyGraph.fromTasks(tasks[])` | `Task[]` | `DependencyGraph` | Build from JS array |
| `add_task()` | `graph.addTask(id)` | `string` | `void` | Add node |
| `add_dependency()` | `graph.addDependency(from, to)` | `string, string` | `void` | Add edge |
| `has_cycles()` | `graph.hasCycles()` | - | `boolean` | Cycle detection |
| `find_cycles()` | `graph.findCycles()` | - | `string[][]` | Get actual cycles |
| `topological_order()` | `graph.topologicalOrder()` | - | `string[]\|null` | Execution order |
| `dependencies()` | `graph.dependencies(id)` | `string` | `string[]` | Direct deps |
| `dependents()` | `graph.dependents(id)` | `string` | `string[]` | What depends on this |
| `parallel_groups()` | `graph.parallelGroups()` | - | `string[][]` | Parallel work groups |
| `critical_path()` | `graph.criticalPath()` | - | `string[]` | Longest path |
| `weighted_critical_path()` | `graph.weightedCriticalPath(weightFn)` | `(id: string) => number` | `string[]` | Weighted longest path |
| `bottlenecks()` | `graph.bottlenecks()` | - | `[string, number][]` | Betweenness centrality |
| `to_dot()` | `graph.toDot()` | - | `string` | GraphViz DOT format |

### Priority 5: Config (Nice to Have)

| Rust Function | NAPI Method | Input | Output | Why |
|---------------|-------------|-------|--------|-----|
| `Config::from_file()` | `Config.fromFile(path)` | `string` | `Config` | Load config |
| `Config::find_and_load()` | `Config.findAndLoad()` | - | `Config\|null` | Auto-discover config |
| `Config::tasks_path()` | `config.tasksPath` (getter) | - | `string` | Get tasks dir |

### Priority 6: Workflow Cost Calculation (Nice to Have)

The `workflow_cost` command uses `calculate_task_ev()` which is a private function. Consider exposing:

| Function | NAPI Method | Input | Output | Why |
|----------|-------------|-------|--------|-----|
| `calculate_task_ev()` (currently private) | `calculateTaskEv(p, scopeCost, impactWeight)` | `number, number, number` | `number` | Expected value calculation |

This would need to be made `pub` or reimplemented in the NAPI layer.

### Notes on `weighted_critical_path` for NAPI

The `weighted_critical_path` takes a Rust closure `F: Fn(&str) -> f64`. For NAPI, this would need to:
1. Accept a JavaScript function callback, OR
2. Accept a `Record<string, number>` map of task ID -> weight

Option 2 is simpler and avoids cross-language callback overhead. For example:

```typescript
// NAPI signature option A (callback approach - complex)
graph.weightedCriticalPath((taskId: string) => number): string[]

// NAPI signature option B (map approach - simpler)
graph.weightedCriticalPath(weights: Record<string, number>): string[]
```

---

## 5. Serialization (Serde) Support

### Full Serde Support (Serialize + Deserialize)

| Type | Serialize | Deserialize | Notes |
|------|-----------|-------------|-------|
| `TaskStatus` | Yes | Yes | `rename_all = "kebab-case"` |
| `TaskScope` | Yes | Yes | `rename_all = "kebab-case"` |
| `TaskRisk` | Yes | Yes | `rename_all = "kebab-case"` |
| `TaskImpact` | Yes | Yes | `rename_all = "kebab-case"` |
| `TaskLevel` | Yes | Yes | `rename_all = "kebab-case"` |
| `TaskFrontmatter` | Yes | Yes | Rich serde attributes (skip_serializing_if, rename, default) |
| `Config` | Yes | Yes | Via TOML |
| `ProjectConfig` | Yes | Yes | Via TOML |

### No Serde Support

| Type | Serialize | Deserialize | Reason |
|------|-----------|-------------|--------|
| `Task` | No | No | `body` and `source` are separate from frontmatter; `to_markdown()` handles serialization manually |
| `DependencyGraph` | No | No | Computed structure; rebuilt from tasks each time |
| `TaskCollection` | No | No | Procedurally built from directory scanning |
| `DiscoveryError` | No | No | Error reporting struct |
| `ValidationResult` | No | No | Internal result type |
| `Error` | No | No | Error enum |
| `OutputFormat` | No | No | CLI-only (ValueEnum, not serde) |
| `Cli` | No | No | CLI-only (clap derive) |
| `Commands` | No | No | CLI-only enum |

### JSON Serialization in Commands (Ad-hoc)

Several command modules define private structs that derive `Serialize` for JSON output:

| File | Struct | Fields |
|------|--------|--------|
| `validate.rs` | `ValidationOutput` | valid, task_count, error_count, errors[], missing_deps |
| `validate.rs` | `ValidationError` | path, message |
| `list.rs` | `TaskSummary` | id, name, status, scope |
| `show.rs` | `TaskDetails` | id, name, status, depends_on, scope, risk, impact, level, tags, body |
| `deps.rs` | `DependencyInfo` | id, status, exists |
| `deps.rs` | `DependenciesOutput` | task_id, dependencies[] |
| `topo.rs` | `TopoTask` | position, id, name, status |
| `topo.rs` | `TopoOutput` | order[], has_cycles |
| `cycles.rs` | `CyclesOutput` | has_cycles, cycle_count, cycles[] |
| `workflow_cost.rs` | `TaskCost` | id, name, cost |

These are **private** to each command module and not part of the public API. For NAPI, we would define equivalent TypeScript interfaces or create new public serializable structs.

### Serialization Format Details

**YAML (frontmatter):** `TaskFrontmatter` uses `serde_yaml` with:
- `rename_all = "kebab-case"` on enums → `in-progress`, `narrow`, `high`, etc.
- `rename = "depends_on"` on the `depends_on` field (explicit)
- `default` on required-ish fields
- `skip_serializing_if = "Option::is_none"` for optional fields
- `skip_serializing_if = "Vec::is_empty"` for tags

**JSON (output):** Uses `serde_json::to_string_pretty()` in commands.

**TOML (config):** `Config` uses `toml::from_str()`.

**Roundtrip:** `Task::from_markdown()` + `Task::to_markdown()` should produce equivalent output (tested implicitly).

---

## 6. Error Types and Error Handling

### Library Error Type (`src/error.rs`)

```rust
#[derive(Error, Debug)]
pub enum Error {
    #[error("Task not found: {0}")]
    TaskNotFound(String),

    #[error("Task already exists: {0}")]
    TaskAlreadyExists(String),

    #[error("Circular dependency detected: {0}")]
    CircularDependency(String),

    #[error("Invalid frontmatter in {file}: {message}")]
    InvalidFrontmatter { file: String, message: String },

    #[error("Missing required field '{field}' in {file}")]
    MissingField { file: String, field: String },

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("YAML parsing error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Graph error: {0}")]
    Graph(String),
}

pub type Result<T> = std::result::Result<T, Error>;
```

**Error conversion:** `From` impls via `#[from]` for `std::io::Error`, `serde_yaml::Error`, `serde_json::Error`.

**Usage patterns:**
- Library code returns `crate::Result<T>` (= `Result<T, Error>`)
- `anyhow::Result` is used only in `main.rs` for the binary entry point
- `thiserror` provides `Display` impls automatically

### CLI Error Handling

The `Cli::execute()` method returns `anyhow::Result<()>`. Each command function returns `crate::Result<()>`. The `?` operator converts between them naturally.

**Error handling at boundaries:**
- `Task::from_file()`: IO errors → `Error::Io`, parse errors → `Error::InvalidFrontmatter`
- `TaskCollection::from_directory()`: Silently skips files without frontmatter, stores errors in `DiscoveryError` list (non-fatal)
- `Config::from_file()`: TOML parse errors → `Error::Graph(format!(...))` (note: reuses Graph variant)
- Command functions: `Error::TaskNotFound` when task ID missing, `Error::TaskAlreadyExists` on duplicate init

### NAPI Error Mapping Strategy

For the Node.js wrapper, we should map:

| Rust Error | Node.js Error | Notes |
|------------|---------------|-------|
| `TaskNotFound(id)` | Generic `Error` with message | JS: `throw new Error("Task not found: <id>")` |
| `TaskAlreadyExists(id)` | Generic `Error` with message | JS: `throw new Error("Task already exists: <id>")` |
| `CircularDependency(msg)` | Generic `Error` with message | JS: `throw new Error("Circular dependency: <msg>")` |
| `InvalidFrontmatter { file, message }` | Generic `Error` with message | JS: `throw new Error("Invalid frontmatter in <file>: <message>")` |
| `MissingField { file, field }` | Generic `Error` with message | JS: `throw new Error("Missing field <field> in <file>")` |
| `Io(err)` | Generic `Error` with message | JS: `throw new Error("IO error: <message>")` |
| `Yaml(err)` | Generic `Error` with message | JS: `throw new Error("YAML parsing error: <message>")` |
| `Json(err)` | Generic `Error` with message | JS: `throw new Error("JSON error: <message>")` |
| `Graph(msg)` | Generic `Error` with message | JS: `throw new Error("Graph error: <msg>")` |

Alternatively, we could create custom JS error classes for better programmatic handling:

```typescript
class TaskNotFoundError extends Error { taskId: string }
class CircularDependencyError extends Error { }
class InvalidFrontmatterError extends Error { file: string; message: string }
```

---

## 7. Input/Output Patterns

### Data Flow Overview

```
                    DISCOVERY
tasks/*.md files ──────────────> TaskCollection
   (disk)                       (HashMap<String, Task>)
                                     │
                                     │ from_collection() / from_tasks()
                                     ▼
                               DependencyGraph
                               (DiGraph<String, ()>)
                                     │
                    ┌────────────────┼────────────────────┐
                    │                 │                     │
                    ▼                 ▼                     ▼
              topological       parallel_groups      critical_path
              order()           ()                   ()
                    │                 │                     │
                    └────────────────┴─────────────────────┘
                                     │
                                     ▼
                              Output (plain/JSON)
```

### Input Patterns

1. **File-based input (primary):** `TaskCollection::from_directory(path)` scans a directory recursively for `.md` files, parses each, and builds the collection. This is the main entry point.

2. **String-based input:** `Task::from_markdown(content, source)` parses a single markdown string. Useful for programmatic construction.

3. **Path-based input:** `Task::from_file(path)` reads a single file and parses it.

4. **Programmatic construction:** `DependencyGraph::new()` + `add_task()` + `add_dependency()` for building graphs manually.

### Output Patterns

1. **Plain text (default):** Human-readable terminal output with tables, arrows, and formatting.

2. **JSON output (`--format json`):** Structured JSON using ad-hoc `Serialize` structs in each command. This is the primary programmatic output format.

3. **DOT format:** `DependencyGraph::to_dot()` returns GraphViz DOT format string.

4. **Markdown roundtrip:** `Task::to_markdown()` produces valid markdown with YAML frontmatter.

### Typical Usage Flow

```rust
// 1. Discover tasks
let collection = TaskCollection::from_directory(Path::new("./tasks"));

// 2. Validate
let result = collection.validate();
if !result.is_valid() { /* handle errors */ }

// 3. Build graph
let graph = DependencyGraph::from_collection(&collection);

// 4. Analyze
let has_cycles = graph.has_cycles();
let order = graph.topological_order();
let parallel = graph.parallel_groups();
let critical = graph.critical_path();
let bottlenecks = graph.bottlenecks();
```

### NAPI Data Flow Design

For the Node.js wrapper, the recommended data flow is:

```typescript
// Option A: File-based (mirrors Rust CLI)
const collection = TaskCollection.fromDirectory('./tasks');
const graph = DependencyGraph.fromCollection(collection);

// Option B: Programmatic (unique to NAPI)
const tasks = [
  Task.fromMarkdown('---\nid: t1\nname: Task 1\n---\nBody'),
  Task.fromMarkdown('---\nid: t2\nname: Task 2\ndepends_on: [t1]\n---\nBody'),
];
const graph = DependencyGraph.fromTasks(tasks);

// Option C: Manual graph construction
const graph = new DependencyGraph();
graph.addTask('t1');
graph.addTask('t2');
graph.addDependency('t1', 't2');
```

### Memory/Ownership Considerations for NAPI

- `Task` is `Clone` (cheap to clone; contains String, TaskFrontmatter, Option<String>)
- `TaskCollection` owns all `Task` objects (HashMap<String, Task>)
- `DependencyGraph` owns the graph structure (not the tasks themselves; only stores task IDs as node weights)
- `DependencyGraph::from_collection()` borrows `&TaskCollection` (doesn't take ownership)
- `Task::from_file()` and `from_markdown()` return owned `Task` values

For NAPI, we need to decide:
1. **Should `TaskCollection` hold JS-managed task objects or Rust-owned?** Probably Rust-owned (tasks are parsed from files/strings, not constructed in JS).
2. **Should graph operations return strings or Task references?** Currently returns `Vec<TaskId>` (strings). The JS side can look up tasks from the collection. This is efficient.
3. **Should `DependencyGraph` keep a reference to `TaskCollection`?** Currently no. This means JS must pass the collection alongside the graph for enriched output. We could create a combined `TaskGraph` class in the NAPI layer.

---

## 8. Existing Tests and Benchmarks

### Unit Tests (in-source)

| File | Test Count | Key Tests |
|------|-----------|-----------|
| `src/graph.rs` | 12 | Empty graph, add task/dep, missing deps, cycle detection, topo sort, parallel groups, critical path, bottleneck, DOT output, unknown task queries |
| `src/discovery.rs` | 5 | Single task discovery, skip files without frontmatter, duplicate ID detection, missing dependencies, validation result |
| `src/config.rs` | 2 | Default config, load from file |

### Integration Tests (`tests/integration/commands.rs`)

25 tests total using `assert_cmd`:

| Test | Command | What It Verifies |
|------|---------|-----------------|
| `test_list_command` | `list` | Lists all 3 fixture tasks |
| `test_list_with_status_filter` | `list --status completed` | Filters correctly |
| `test_show_command` | `show task-one` | Shows task details |
| `test_show_missing_task` | `show missing-task` | Fails on missing |
| `test_validate_command` | `validate` | Succeeds on valid fixtures |
| `test_validate_with_missing_dependency` | `validate` (invalid) | Reports missing deps |
| `test_topo_command` | `topo` | Outputs topological order |
| `test_deps_command` | `deps task-two` | Shows task-one as dependency |
| `test_dependents_command` | `dependents task-one` | Shows tasks two and three |
| `test_cycles_command_no_cycles` | `cycles` | No cycles in valid fixtures |
| `test_cycles_command_with_cycles` | `cycles` (cycles fixtures) | Detects cycle |
| `test_parallel_command` | `parallel` | Shows generation groups |
| `test_critical_command` | `critical` | Shows critical path |
| `test_graph_command` | `graph` | Outputs DOT format |
| `test_bottleneck_command` | `bottleneck` | Shows bottleneck tasks |
| `test_init_command` | `init new-task` | Creates file |
| `test_init_duplicate_task` | `init task-one` | Fails on duplicate |
| `test_init_with_options` | `init --scope narrow --risk low` | Writes scope/risk to file |
| `test_risk_command` | `risk` | Distribution with counts |
| `test_risk_command_empty` | `risk` (empty dir) | "No tasks found" |
| `test_decompose_command` | `decompose` | Flags high-risk/broad-scope tasks |
| `test_decompose_command_none_needed` | `decompose` (low-risk tasks) | "No tasks need decomposition" |
| `test_workflow_cost_command` | `workflow-cost` | Shows cost analysis |
| `test_workflow_cost_command_empty` | `workflow-cost` (empty) | "No tasks found" |
| `test_risk_path_command` | `risk-path` | Shows risk path |
| `test_risk_path_command_empty` | `risk-path` (empty) | "No tasks found" |
| `test_help_flag` | `--help` | Shows help text |
| `test_version_flag` | `--version` | Succeeds |
| `test_completions_bash` | `completions bash` | Bash completion output |
| `test_completions_zsh` | `completions zsh` | Zsh completion output |
| `test_completions_fish` | `completions fish` | Fish completion output |

### Benchmark Suite (`benches/graph_benchmarks.rs`)

Uses Criterion. Two benchmark groups:

1. **`load_tasks`**: Measures `TaskCollection::from_directory()` + `DependencyGraph::from_collection()` for 50, 100, 500, 1000 tasks.

2. **`graph_ops`**: On 1000-task graph, measures:
   - `topological_sort_1000`
   - `cycle_detection_1000`
   - `critical_path_1000`
   - `bottlenecks_1000`

Test data: linear chain of tasks (task-i depends on task-(i-1)).

### Performance Numbers (from README)

| Tasks | Load Time | Topo Sort | Cycles | Critical Path |
|-------|-----------|-----------|--------|---------------|
| 50 | 3ms | 3ms | 2ms | 8ms |
| 500 | 19ms | 21ms | 14ms | 52ms |
| 1,000 | 34ms | 42ms | 26ms | 82ms |

(Benchmarked on AMD EPYC 9004 series)

### CI Pipeline (`.github/workflows/ci.yml`)

Two jobs:
1. **Test**: checkout -> install Rust (with rustfmt, clippy) -> cache -> fmt check -> clippy -> test -> build release
2. **Coverage**: checkout -> install Rust -> cache -> install cargo-llvm-cov -> generate lcov -> upload to Codecov

### Test Coverage

Reported at 89% (meeting the 80% target from AGENTS.md).

---

## Appendix A: Complete Type Reference for NAPI Mapping

### Enums to JS String Unions

```typescript
// task.ts
type TaskStatus = "pending" | "in-progress" | "completed" | "failed" | "blocked";
type TaskScope = "single" | "narrow" | "moderate" | "broad" | "system";
type TaskRisk = "trivial" | "low" | "medium" | "high" | "critical";
type TaskImpact = "isolated" | "component" | "phase" | "project";
type TaskLevel = "planning" | "decomposition" | "implementation" | "review" | "research";
```

### Proposed NAPI Class Structure

```typescript
// task.ts
class Task {
  // Static constructors
  static fromMarkdown(content: string, source?: string): Task;
  static fromFile(path: string): Task;

  // Getters
  get id(): string;
  get name(): string;
  get status(): TaskStatus;
  get dependsOn(): string[];
  get body(): string;
  get source(): string | null;

  // Frontmatter access (via JS object)
  get frontmatter(): TaskFrontmatter;

  // Serialization
  toMarkdown(): string;
}

interface TaskFrontmatter {
  id: string;
  name: string;
  status: TaskStatus;
  dependsOn: string[];
  priority?: string;
  tags: string[];
  created?: string;     // ISO 8601
  modified?: string;    // ISO 8601
  assignee?: string;
  due?: string;
  scope?: TaskScope;
  risk?: TaskRisk;
  impact?: TaskImpact;
  level?: TaskLevel;
}

// collection.ts
class TaskCollection {
  static fromDirectory(path: string): TaskCollection;
  get(id: string): Task | null;
  get length(): number;
  ids(): string[];
  tasks(): Task[];
  get errors(): DiscoveryError[];
  missingDependencies(): Record<string, string[]>;
  validate(): ValidationResult;
}

interface DiscoveryError {
  path: string;
  message: string;
}

interface ValidationResult {
  taskCount: number;
  errors: DiscoveryError[];
  missingDependencies: Record<string, string[]>;
  isValid(): boolean;
  issueCount(): number;
}

// graph.ts
class DependencyGraph {
  static fromCollection(collection: TaskCollection): DependencyGraph;
  static fromTasks(tasks: Task[]): DependencyGraph;

  addTask(id: string): void;
  addDependency(from: string, to: string): void;
  hasCycles(): boolean;
  findCycles(): string[][];
  topologicalOrder(): string[] | null;
  dependencies(taskId: string): string[];
  dependents(taskId: string): string[];
  parallelGroups(): string[][];
  criticalPath(): string[];
  weightedCriticalPath(weights: Record<string, number>): string[];
  bottlenecks(): [string, number][];
  toDot(): string;
}

// config.ts
class Config {
  static fromFile(path: string): Config;
  static findAndLoad(): Config | null;
  get tasksPath(): string;
}

// workflow.ts
function calculateTaskEv(p: number, scopeCost: number, impactWeight: number): number;
```

### Key Decisions for NAPI Implementation

1. **Task mutability:** The Rust `Task` struct is `Clone` but has no setters. For NAPI, we should either:
   - Make the JS `Task` immutable (read-only after creation) - simpler, matches Rust
   - Add a `TaskBuilder` pattern for constructing tasks programmatically

2. **Enum representation:** Use JS string literals (not numeric enums) to match the `kebab-case` serde serialization.

3. **Error handling:** Throw JS `Error` objects from NAPI. Consider custom error classes for `TaskNotFound` and `InvalidFrontmatter`.

4. **DateTime handling:** `chrono::DateTime<Utc>` maps to ISO 8601 strings in JS. No need for JS `Date` objects in the NAPI layer.

5. **Graph lifetime:** The Rust `DependencyGraph` borrows nothing (stores owned `String` node weights). It can be freely moved/owned in NAPI.

6. **Collection lifetime:** `TaskCollection` owns its tasks. The NAPI class should hold the Rust struct. Returning `Task` references from `collection.get()` requires careful lifetime management - consider returning clones.

7. **`weighted_critical_path` callback:** Replace the Rust closure with a JS `Record<string, number>` dict lookup to avoid FFI callback overhead and complexity.

---

## Appendix B: Notable Implementation Details

### Bottleneck Algorithm

The current `bottlenecks()` implementation uses an O(n^2 * P) algorithm where P is the number of paths between nodes. It enumerates all paths between all pairs, then counts how many paths each task appears on. This is **not** true betweenness centrality (which uses Brandes' O(VE) algorithm) but a simpler path-counting approach. For large graphs, this could be slow. The benchmark only tests up to 1000 nodes with linear topology.

### Critical Path Algorithm

Uses recursive memoized longest-path computation. Works well for DAGs but will return empty/incorrect results if cycles exist (the `parallel_groups` method also silently breaks if cycles exist).

### Missing: Task Serialization

`Task` does not implement `Serialize`/`Deserialize`. The `to_markdown()` method manually concatenates YAML frontmatter + markdown body. If we need JSON serialization of the full `Task` (including body), we should add a new serializable struct like:

```rust
#[derive(Serialize)]
pub struct SerializableTask {
    pub frontmatter: TaskFrontmatter,
    pub body: String,
    pub source: Option<String>,
}
```

Or implement `Serialize` for `Task` directly.

### Missing: Task Mutability

There are no methods to update a task's status, dependencies, etc. in place. The current design assumes files are the source of truth and are edited directly. For an NAPI wrapper, we may want to add:
- `task.set_status(status: TaskStatus)`
- `task.set_depends_on(deps: Vec<String>)`
- etc.

Or use a builder pattern for creating new tasks.

### Missing: Partial Graph Building

`DependencyGraph::from_collection()` adds edges only for dependencies that exist as nodes in the graph. Missing dependencies are silently ignored (no error, no warning). This matches the `add_dependency()` behavior which checks `index_map` before adding edges.

### walkdir::FollowLinks(false)

`TaskCollection::from_directory()` does not follow symlinks. This is intentional for safety.

---

## Appendix C: Dependency Version Compatibility Notes

| Crate | Version | Notes for NAPI |
|-------|---------|---------------|
| `petgraph` | `0.7` | Stable API; `DiGraph` and algorithms are well-defined |
| `gray_matter` | `0.2` | Minor version; API may change in `0.3` |
| `serde` | `1.0` | Very stable; `derive` feature needed |
| `serde_json` | `1.0` | Very stable |
| `serde_yaml` | `0.9` | Note: `serde_yaml` 0.9 is the last version before potential breaking changes |
| `chrono` | `0.4` | Stable; `serde` feature for serialization |
| `clap` | `4.5` | CLI-only; not needed in NAPI lib |
| `thiserror` | `2.0` | Error derive; v2 is newer than commonly seen |
| `toml` | `0.8` | For config loading |
| `walkdir` | `2.5` | For directory scanning |

For NAPI, we can exclude from the build:
- `clap` / `clap_complete` (CLI-only, not needed for library)
- `tracing` / `tracing-subscriber` (logging, optional)
- `dirs` (platform directories, only for CLI default paths)

This could be done with feature flags:
```toml
[features]
default = ["cli"]
cli = ["clap", "clap_complete", "tracing", "tracing-subscriber", "dirs"]
napi = []  # Minimal dependencies for Node.js binding
```
