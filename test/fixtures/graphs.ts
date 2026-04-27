/**
 * Shared test fixtures for graph construction.
 *
 * Provides:
 * - TaskInput type matching the architecture spec (inline until schema module is implemented)
 * - createTaskGraph() helper for one-liner graph setup from TaskInput[]
 * - Pre-built graph fixtures for common test patterns
 *
 * When the schema and graph modules are implemented, these fixtures will work
 * with TaskGraph.fromTasks() directly. Until then, createTaskGraph() builds
 * a graphology DirectedGraph with the same semantics.
 */

import Graph from 'graphology';
import { hasCycle } from 'graphology-dag';

// ---------------------------------------------------------------------------
// Types — mirrors src/schema/task.ts and src/schema/graph.ts architecture
// ---------------------------------------------------------------------------

/** Categorical enum values matching DB and frontmatter conventions */
export type TaskScope = 'single' | 'narrow' | 'moderate' | 'broad' | 'system';
export type TaskRisk = 'trivial' | 'low' | 'medium' | 'high' | 'critical';
export type TaskImpact = 'isolated' | 'component' | 'phase' | 'project';
export type TaskLevel = 'planning' | 'decomposition' | 'implementation' | 'review' | 'research';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked';

/**
 * Universal input shape for a task.
 * Mirrors the TaskInput schema from docs/architecture/schemas.md.
 * Categorical fields are optional and nullable (null = "not yet assessed").
 */
export interface TaskInput {
  id: string;
  name: string;
  dependsOn: string[];
  status?: TaskStatus | null;
  scope?: TaskScope | null;
  risk?: TaskRisk | null;
  impact?: TaskImpact | null;
  level?: TaskLevel | null;
  priority?: TaskPriority | null;
  tags?: string[];
  assignee?: string | null;
  due?: string | null;
  created?: string | null;
  modified?: string | null;
}

/**
 * Node attributes stored on the graphology graph.
 * Mirrors TaskGraphNodeAttributes from docs/architecture/schemas.md.
 * After construction, null values are stripped to undefined (absent = "not assessed").
 */
export interface TaskGraphNodeAttributes {
  name: string;
  scope?: TaskScope;
  risk?: TaskRisk;
  impact?: TaskImpact;
  level?: TaskLevel;
  priority?: TaskPriority;
  status?: TaskStatus;
}

/**
 * Edge attributes on graph edges.
 * qualityRetention defaults to 0.9 if not specified.
 */
export interface TaskGraphEdgeAttributes {
  qualityRetention?: number;
}

// ---------------------------------------------------------------------------
// Helper: strip null → undefined for node attributes
// ---------------------------------------------------------------------------

function stripNulls(input: TaskInput): TaskGraphNodeAttributes {
  const attrs: TaskGraphNodeAttributes = { name: input.name };
  if (input.scope != null) attrs.scope = input.scope;
  if (input.risk != null) attrs.risk = input.risk;
  if (input.impact != null) attrs.impact = input.impact;
  if (input.level != null) attrs.level = input.level;
  if (input.priority != null) attrs.priority = input.priority;
  if (input.status != null) attrs.status = input.status;
  return attrs;
}

// ---------------------------------------------------------------------------
// Helper: create a graphology DirectedGraph from TaskInput[]
// ---------------------------------------------------------------------------

/**
 * Build a graphology DirectedGraph from an array of TaskInputobjects.
 *
 * Uses graph.import(serializedData) for bulk construction (faster than N
 * individual addNode/addEdge calls per architecture recommendation).
 *
 * Edges use deterministic `${source}->${target}` keys per ADR-006.
 * Edge qualityRetention defaults to 0.9 (matching fromTasks convention).
 *
 * @param tasks - Array of TaskInput objects
 * @returns A graphology DirectedGraph with nodes and edges populated
 */
export function createTaskGraph(tasks: TaskInput[]): Graph<TaskGraphNodeAttributes, TaskGraphEdgeAttributes> {
  const graph = new Graph<TaskGraphNodeAttributes, TaskGraphEdgeAttributes>({ type: 'directed' });

  // Build node map for lookups
  const taskMap = new Map<string, TaskInput>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // Build serialized format for bulk import
  const nodes: Array<{ key: string; attributes: TaskGraphNodeAttributes }> = [];
  const edges: Array<{ key: string; source: string; target: string; attributes: TaskGraphEdgeAttributes }> = [];

  // Edge set to prevent duplicates
  const edgeSet = new Set<string>();

  for (const task of tasks) {
    nodes.push({ key: task.id, attributes: stripNulls(task) });

    for (const dep of task.dependsOn) {
      const edgeKey = `${dep}->${task.id}`;
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey);
        edges.push({
          key: edgeKey,
          source: dep,
          target: task.id,
          attributes: { qualityRetention: 0.9 },
        });
      }
    }
  }

  // Import in bulk
  graph.import({ nodes, edges });

  // Handle dangling references: fromTasks silently creates orphan nodes
  // for dependsOn targets not in the tasks array (per architecture spec).
  // We need to add those nodes now.
  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (!graph.hasNode(dep)) {
        graph.addNode(dep, { name: dep });
      }
    }
  }

  return graph;
}

// ---------------------------------------------------------------------------
// Fixture Graphs
// ---------------------------------------------------------------------------

/**
 * Simple linear chain graph: A → B → C → D
 *
 * All tasks have medium risk, narrow scope, isolated impact.
 * Useful for testing topological ordering, basic path traversal.
 */
export const linearChainTasks: TaskInput[] = [
  { id: 'A', name: 'Task A', dependsOn: [] },
  { id: 'B', name: 'Task B', dependsOn: ['A'] },
  { id: 'C', name: 'Task C', dependsOn: ['B'] },
  { id: 'D', name: 'Task D', dependsOn: ['C'] },
];

/** Pre-built linear chain graph */
export const linearChain = createTaskGraph(linearChainTasks);

/**
 * Diamond dependency graph:
 *       A
 *      / \
 *     B   C
 *      \ /
 *       D
 *
 * A → B, A → C, B → D, C → D
 * Useful for testing parallel groups, bottleneck detection, merge points.
 */
export const diamondTasks: TaskInput[] = [
  { id: 'A', name: 'Task A', dependsOn: [] },
  { id: 'B', name: 'Task B', dependsOn: ['A'] },
  { id: 'C', name: 'Task C', dependsOn: ['A'] },
  { id: 'D', name: 'Task D', dependsOn: ['B', 'C'] },
];

/** Pre-built diamond graph */
export const diamond = createTaskGraph(diamondTasks);

/**
 * Mixed categorical fields graph:
 * Some tasks have assessed fields, some have null (not assessed).
 * Useful for testing resolveDefaults, riskDistribution, and other
 * analysis functions that handle nullable categorical fields.
 */
export const mixedCategoryTasks: TaskInput[] = [
  { id: 'auth', name: 'Auth module', dependsOn: [], risk: 'high', scope: 'broad', impact: 'phase', status: 'pending' },
  { id: 'db', name: 'Database setup', dependsOn: [], risk: 'medium', scope: 'moderate', impact: null, status: 'completed' },
  { id: 'api', name: 'API layer', dependsOn: ['auth', 'db'], risk: null, scope: null, impact: 'component', status: null },
  { id: 'tests', name: 'Test suite', dependsOn: ['api'], risk: 'low', scope: null, impact: null, status: null },
  { id: 'deploy', name: 'Deploy pipeline', dependsOn: ['tests'], risk: 'critical', scope: 'system', impact: 'project', status: 'blocked' },
];

/** Pre-built mixed category graph */
export const mixedCategory = createTaskGraph(mixedCategoryTasks);

/**
 * Graph with cycles for testing cycle detection:
 *   A → B → C → A  (cycle)
 *   A → D           (non-cyclic branch)
 *
 * Useful for testing hasCycles(), findCycles(), and that
 * topologicalOrder() throws CircularDependencyError.
 */
export const cyclicTasks: TaskInput[] = [
  { id: 'A', name: 'Task A', dependsOn: ['C'] },   // A depends on C (creates cycle)
  { id: 'B', name: 'Task B', dependsOn: ['A'] },   // B depends on A
  { id: 'C', name: 'Task C', dependsOn: ['B'] },   // C depends on B
  { id: 'D', name: 'Task D', dependsOn: ['A'] },   // D depends on A (non-cyclic)
];

/** Pre-built cyclic graph */
export const cyclic = createTaskGraph(cyclicTasks);

/**
 * Larger graph (20+ nodes) for performance and bottleneck testing.
 * Represents a realistic project structure with multiple parallel
 * workstreams converging.
 *
 * Structure:
 *   - 3 foundation tasks (no deps)
 *   - 3 core services (depend on foundation)
 *   - 5 feature tasks (depend on core services)
 *   - 3 integration tasks (merge features)
 *   - 2 testing tasks
 *   - 5 polish tasks
 *   - 1 release task (depends on everything)
 */
export const largeGraphTasks: TaskInput[] = [
  // Foundation (3 tasks)
  { id: 'infra-setup', name: 'Infrastructure setup', dependsOn: [], scope: 'broad', risk: 'high', impact: 'project', level: 'implementation' },
  { id: 'db-schema', name: 'Database schema design', dependsOn: [], scope: 'moderate', risk: 'medium', impact: 'phase', level: 'planning' },
  { id: 'auth-design', name: 'Auth system design', dependsOn: [], scope: 'moderate', risk: 'high', impact: 'component', level: 'planning' },

  // Core services (3 tasks)
  { id: 'auth-impl', name: 'Auth implementation', dependsOn: ['infra-setup', 'auth-design'], scope: 'broad', risk: 'high', impact: 'phase', level: 'implementation' },
  { id: 'data-layer', name: 'Data access layer', dependsOn: ['db-schema', 'infra-setup'], scope: 'moderate', risk: 'medium', impact: 'component', level: 'implementation' },
  { id: 'api-gateway', name: 'API gateway', dependsOn: ['auth-impl', 'data-layer'], scope: 'broad', risk: 'medium', impact: 'phase', level: 'implementation' },

  // Feature tasks (4 tasks)
  { id: 'feature-users', name: 'User management', dependsOn: ['auth-impl', 'data-layer'], scope: 'narrow', risk: 'low', impact: 'component', level: 'implementation' },
  { id: 'feature-notifications', name: 'Notification system', dependsOn: ['api-gateway', 'data-layer'], scope: 'narrow', risk: 'low', impact: 'isolated', level: 'implementation' },
  { id: 'feature-search', name: 'Search functionality', dependsOn: ['data-layer'], scope: 'moderate', risk: 'medium', impact: 'component', level: 'implementation' },
  { id: 'feature-permissions', name: 'Permissions system', dependsOn: ['auth-impl'], scope: 'moderate', risk: 'high', impact: 'phase', level: 'implementation' },
  { id: 'feature-analytics', name: 'Analytics dashboard', dependsOn: ['data-layer', 'api-gateway'], scope: 'moderate', risk: 'medium', impact: 'component', level: 'implementation' },

  // Integration tasks (3 tasks)
  { id: 'integrate-auth', name: 'Auth integration test', dependsOn: ['feature-users', 'feature-permissions'], scope: 'narrow', risk: 'medium', impact: 'component', level: 'review' },
  { id: 'integrate-api', name: 'API integration test', dependsOn: ['feature-notifications', 'feature-search', 'api-gateway'], scope: 'moderate', risk: 'medium', impact: 'phase', level: 'review' },
  { id: 'integrate-e2e', name: 'End-to-end integration', dependsOn: ['integrate-auth', 'integrate-api'], scope: 'broad', risk: 'high', impact: 'project', level: 'review' },

  // Testing tasks (2 tasks)
  { id: 'perf-tests', name: 'Performance testing', dependsOn: ['integrate-e2e'], scope: 'moderate', risk: 'medium', impact: 'component', level: 'review' },
  { id: 'security-audit', name: 'Security audit', dependsOn: ['auth-impl', 'integrate-auth'], scope: 'broad', risk: 'critical', impact: 'project', level: 'review' },

  // Polish tasks (3 tasks)
  { id: 'docs-api', name: 'API documentation', dependsOn: ['api-gateway'], scope: 'moderate', risk: 'trivial', impact: 'isolated', level: 'implementation' },
  { id: 'docs-user', name: 'User documentation', dependsOn: ['feature-users'], scope: 'narrow', risk: 'trivial', impact: 'isolated', level: 'implementation' },
  { id: 'i18n', name: 'Internationalization', dependsOn: ['feature-users', 'feature-notifications'], scope: 'moderate', risk: 'low', impact: 'component', level: 'implementation' },
  { id: 'accessibility', name: 'Accessibility compliance', dependsOn: ['feature-users', 'feature-analytics'], scope: 'moderate', risk: 'low', impact: 'component', level: 'implementation' },
  { id: 'error-handling', name: 'Error handling polish', dependsOn: ['api-gateway', 'data-layer'], scope: 'narrow', risk: 'low', impact: 'isolated', level: 'implementation' },
  { id: 'config-system', name: 'Configuration system', dependsOn: ['data-layer'], scope: 'narrow', risk: 'low', impact: 'isolated', level: 'implementation' },

  // Release (1 task)
  { id: 'release', name: 'Production release', dependsOn: ['perf-tests', 'security-audit', 'docs-api', 'docs-user', 'i18n', 'accessibility', 'error-handling', 'config-system'], scope: 'system', risk: 'critical', impact: 'project', level: 'implementation' },
];

/** Pre-built large graph (23 nodes) */
export const largeGraph = createTaskGraph(largeGraphTasks);

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

/**
 * All fixture graphs as a record for iteration in tests.
 * Keys: 'linearChain', 'diamond', 'mixedCategory', 'cyclic', 'large'
 */
export const allGraphs: Record<string, Graph<TaskGraphNodeAttributes, TaskGraphEdgeAttributes>> = {
  linearChain,
  diamond,
  mixedCategory,
  cyclic,
  large: largeGraph,
};

/**
 * All fixture TaskInput arrays as a record for iteration in tests.
 * Keys: 'linearChain', 'diamond', 'mixedCategory', 'cyclic', 'large'
 */
export const allTasks: Record<string, TaskInput[]> = {
  linearChain: linearChainTasks,
  diamond: diamondTasks,
  mixedCategory: mixedCategoryTasks,
  cyclic: cyclicTasks,
  large: largeGraphTasks,
};