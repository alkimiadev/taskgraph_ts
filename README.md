# @alkdev/taskgraph

Directed acyclic graph analysis, risk scoring, and YAML frontmatter parsing for task management.

Built on [graphology](https://github.com/graphology/graphology) — pure TypeScript, no native addons, works in Node.js / Deno / Bun.

## Install

```sh
npm install @alkdev/taskgraph
```

## Quick Start

```ts
import { TaskGraph, parallelGroups, criticalPath } from '@alkdev/taskgraph';

const graph = TaskGraph.fromTasks([
  { id: 'design', name: 'Design API', dependsOn: [], risk: 'low', scope: 'narrow' },
  { id: 'impl', name: 'Implement', dependsOn: ['design'], risk: 'medium', scope: 'moderate' },
  { id: 'test', name: 'Write tests', dependsOn: ['impl'], risk: 'low', scope: 'narrow' },
  { id: 'docs', name: 'Write docs', dependsOn: ['design'], risk: 'trivial', scope: 'narrow' },
]);

const groups = parallelGroups(graph);
// [['design'], ['impl', 'docs'], ['test']]

const path = criticalPath(graph);
// ['design', 'impl', 'test']
```

## TaskGraph

The primary data structure. Wraps a graphology `DirectedGraph` with validation and typed access.

### Construction

```ts
// From task inputs (convenience — edges created from dependsOn)
const g1 = TaskGraph.fromTasks([...tasks]);

// From explicit tasks + edges (per-edge qualityRetention)
const g2 = TaskGraph.fromRecords([...tasks], [...edges]);

// From serialized data (round-trip with export())
const data = g1.export();
const g3 = TaskGraph.fromJSON(data);

// Incremental building
const g4 = new TaskGraph();
g4.addTask('a', { name: 'Task A' });
g4.addTask('b', { name: 'Task B' });
g4.addDependency('a', 'b'); // a → b (a is prerequisite)
```

### Queries

```ts
graph.topologicalOrder();     // string[] — prerequisite → dependent order
graph.dependencies('impl');    // ['design'] — prerequisites of impl
graph.dependents('design');    // ['impl', 'docs'] — dependents of design
graph.hasCycles();             // boolean
graph.findCycles();           // string[][] — cycle paths
graph.taskCount();             // number
graph.getTask('design');       // TaskGraphNodeAttributes | undefined
```

### Validation

```ts
graph.validate();        // AnyValidationError[] — combined schema + graph
graph.validateSchema();   // ValidationError[] — per-field TypeBox validation
graph.validateGraph();    // GraphValidationError[] — cycles, dangling refs
```

### Mutation

```ts
graph.removeTask('id');
graph.removeDependency('prereq', 'dependent');
graph.updateTask('id', { risk: 'high' });
graph.updateEdgeAttributes('prereq', 'dependent', { qualityRetention: 0.8 });
```

### Export

```ts
const data = graph.export();      // TaskGraphSerialized (graphology JSON)
const json = JSON.stringify(graph); // uses toJSON() alias
```

## Analysis Functions

All analysis functions take a `TaskGraph` instance as their first argument.

### Critical Path

```ts
import { criticalPath, weightedCriticalPath } from '@alkdev/taskgraph';

criticalPath(graph); // longest path by edge count

weightedCriticalPath(graph, (id, attrs) => {
  // custom weight per node
  return riskWeight(attrs.risk ?? 'medium') * impactWeight(attrs.impact ?? 'isolated');
});
```

### Parallel Groups

```ts
import { parallelGroups } from '@alkdev/taskgraph';

parallelGroups(graph); // string[][] — tasks at each topological depth
```

### Bottleneck Analysis

```ts
import { bottlenecks } from '@alkdev/taskgraph';

const scores = bottlenecks(graph);
// [{ taskId: 'design', score: 0.83 }, ...] — sorted descending
```

### Risk Analysis

```ts
import { riskPath, riskDistribution } from '@alkdev/taskgraph';

riskPath(graph);
// { path: ['design', 'impl', 'test'], totalRisk: 4.2 }

riskDistribution(graph);
// { trivial: [...], low: [...], medium: [...], high: [...], critical: [...], unspecified: [...] }
```

### Expected Value & Workflow Cost

```ts
import { calculateTaskEv, workflowCost } from '@alkdev/taskgraph';

calculateTaskEv(0.8, 3.0, 1.5);
// { ev: 4.2, pSuccess: 0.8, expectedRetries: 0.25 }

const result = workflowCost(graph, {
  propagationMode: 'dag-propagate', // or 'independent'
  defaultQualityRetention: 0.9,
  includeCompleted: false,
});
// result.tasks  — per-task EV entries
// result.totalEv — aggregate
// result.averageEv
```

### Decomposition

```ts
import { shouldDecomposeTask } from '@alkdev/taskgraph';

shouldDecomposeTask({ name: 'Refactor', risk: 'high', scope: 'broad' });
// { shouldDecompose: true, reasons: ['risk: high — ...', 'scope: broad — ...'] }
```

### Categorical Numeric Methods

```ts
import {
  scopeCostEstimate, scopeTokenEstimate,
  riskSuccessProbability, riskWeight,
  impactWeight, resolveDefaults,
} from '@alkdev/taskgraph';

scopeCostEstimate('moderate');    // 3.0
scopeTokenEstimate('broad');      // 6000
riskSuccessProbability('high');   // 0.65
riskWeight('high');               // 0.35
impactWeight('project');          // 3.0

resolveDefaults({ name: 'Task', risk: 'high' });
// { scope: 'narrow', risk: 'high', ..., costEstimate: 2.0, ... }
```

## Frontmatter

Parse and serialize YAML frontmatter in markdown files.

```ts
import {
  parseFrontmatter, serializeFrontmatter,
  parseTaskFile, parseTaskDirectory,
} from '@alkdev/taskgraph';

// Parse a markdown string with --- frontmatter
const task = parseFrontmatter(`---
id: my-task
name: My Task
dependsOn: []
risk: medium
---
Task body here`);

// Serialize back to markdown
const md = serializeFrontmatter(task, 'Task body here');

// File I/O (Node.js only)
const task2 = await parseTaskFile('/path/to/task.md');
const tasks = await parseTaskDirectory('/path/to/tasks/');
```

## Schemas & Types

All schemas are TypeBox schemas and all types are inferred from them.

```ts
import type {
  TaskInput, DependencyEdge,
  TaskGraphNodeAttributes, TaskGraphEdgeAttributes, TaskGraphSerialized,
  RiskPathResult, DecomposeResult, WorkflowCostOptions, WorkflowCostResult,
  EvConfig, EvResult, RiskDistributionResult, ResolvedTaskAttributes,
} from '@alkdev/taskgraph';

import type {
  TaskScope, TaskRisk, TaskImpact, TaskLevel, TaskPriority, TaskStatus,
} from '@alkdev/taskgraph';
```

### Enums

```ts
// Type values (also usable as TypeScript types)
type Scope = 'single' | 'narrow' | 'moderate' | 'broad' | 'system';
type Risk = 'trivial' | 'low' | 'medium' | 'high' | 'critical';
type Impact = 'isolated' | 'component' | 'phase' | 'project';
type Level = 'planning' | 'decomposition' | 'implementation' | 'review' | 'research';
type Priority = 'low' | 'medium' | 'high' | 'critical';
type Status = 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked';
```

## Error Classes

```ts
import {
  TaskgraphError,          // base class
  TaskNotFoundError,        // .taskId
  CircularDependencyError, // .cycles: string[][]
  InvalidInputError,        // .field, .message
  DuplicateNodeError,      // .taskId
  DuplicateEdgeError,      // .prerequisite, .dependent
} from '@alkdev/taskgraph';
```

## License

Licensed under either of [Apache License, Version 2.0](LICENSE-APACHE) or [MIT License](LICENSE-MIT) at your option.

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.