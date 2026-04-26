---
status: draft
last_updated: 2026-04-26
---

# Build & Distribution

Dependencies, project structure, build targets, and performance notes.

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
│   │   ├── decompose.ts       # shouldDecomposeTask
│   │   └── defaults.ts        # resolveDefaults, enum numeric methods
│   ├── frontmatter/
│   │   ├── index.ts           # parseFrontmatter, parseTaskFile, parseTaskDirectory, serializeFrontmatter
│   │   ├── parse.ts           # YAML/frontmatter parsing + typebox validation
│   │   └── serialize.ts       # TaskInput → markdown with frontmatter
│   └── error/
│       └── index.ts           # TaskgraphError, TaskNotFoundError, CircularDependencyError, InvalidInputError, DuplicateNodeError, DuplicateEdgeError
├── test/
│   ├── graph.test.ts
│   ├── analysis.test.ts
│   ├── schema.test.ts
│   ├── frontmatter.test.ts
│   └── cost-benefit.test.ts
└── docs/
    └── architecture/          # This architecture document set
```

The structure reflects the decomposition decision: `src/analysis/` contains standalone functions, `src/graph/` contains the TaskGraph data class. This is not an accident — it enforces at the filesystem level that analysis functions are separate from the graph class.

## Build & Distribution

- **Package**: `@alkdev/taskgraph` on npm
- **Module**: ESM primary, CJS compat
- **Targets**: Node 18+, Deno, Bun — pure JS, no native addons
- **Build**: `tsc` for declarations + bundler for distribution
- **No platform-specific binaries** — this is the whole point of the pivot from NAPI/Rust

## Performance Notes

From graphology's performance tips:
- Prefer callback iteration (`forEachNode`, `forEachEdge`) over array-returning methods (`nodes()`, `edges()`) when iterating
- Use `addEdgeWithKey` with deterministic `${source}->${target}` keys instead of `addEdge` to skip the automatic key generation overhead — see [ADR-006](decisions/006-deterministic-edge-keys.md)
- Avoid callback nesting in hot loops; hoist inner callbacks
- For bulk construction, `graph.import(serializedData)` is faster than N individual add calls

Realistic task graphs (10–200 nodes) make all of this academic, but the patterns are free to adopt.

## Constraints

- **Pure JavaScript** — no Rust, no WASM, no native addons. This is non-negotiable — it's the core design decision.
- **ESM primary** — CJS compat is a distribution concern, not a design choice. Consumers should import as ESM.
- **No platform-specific binaries** — the library must work in Node, Deno, and Bun without compilation steps.