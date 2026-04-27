// Graph validation — validateSchema, validateGraph, validate
//
// Standalone validation functions operating on the inner graphology graph.
// These are also exposed as instance methods on TaskGraph.

import { Value } from '@alkdev/typebox/value';
import type { TaskGraphInner } from './construction.js';
import { TaskGraphNodeAttributes as TaskGraphNodeAttributesSchema } from '../schema/index.js';
import { findCycles as _findCycles } from './queries.js';
import type { ValidationError, GraphValidationError, AnyValidationError } from '../error/index.js';

/**
 * Validate all node attributes against the TaskGraphNodeAttributes schema.
 *
 * Uses TypeBox `Value.Check()` and `Value.Errors()` on each node's attributes.
 * Returns structured `ValidationError[]` with `type: "schema"`, `taskId`,
 * `field`, `message`, and optional `value`.
 *
 * Validation never throws — it collects all issues and returns them.
 */
export function validateSchema(graph: TaskGraphInner): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const node of graph.nodes()) {
    const attrs = graph.getNodeAttributes(node);

    if (!Value.Check(TaskGraphNodeAttributesSchema, attrs)) {
      const errorIter = Value.Errors(TaskGraphNodeAttributesSchema, attrs);
      for (const error of errorIter) {
        const field = error.path.startsWith('/') ? error.path.slice(1) : error.path;

        errors.push({
          type: 'schema',
          taskId: node,
          field: field || '(root)',
          message: error.message,
          value: error.value,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate graph-level invariants: cycles and dangling references.
 *
 * Runs `findCycles()` and checks for dangling dependency references
 * (edges where at least one endpoint doesn't exist as a node).
 *
 * Returns structured `GraphValidationError[]` with:
 * - Cycle errors: `category: "cycle"`, with cycle paths in `details`
 * - Dangling reference errors: `category: "dangling-reference"`, with `taskId`
 *
 * Validation never throws — it collects all issues and returns them.
 */
export function validateGraph(graph: TaskGraphInner): GraphValidationError[] {
  const errors: GraphValidationError[] = [];

  // Check for cycles
  const cycles = _findCycles(graph);
  if (cycles.length > 0) {
    errors.push({
      type: 'graph',
      category: 'cycle',
      message: `Graph contains ${cycles.length} cycle${cycles.length === 1 ? '' : 's'}`,
      details: cycles,
    });
  }

  // Check for dangling dependency references
  // An edge references a node that doesn't exist in the graph.
  for (const edge of graph.edges()) {
    const source = graph.source(edge);
    const target = graph.target(edge);

    if (!graph.hasNode(source)) {
      errors.push({
        type: 'graph',
        category: 'dangling-reference',
        taskId: source,
        message: `Edge references non-existent source node: ${source}`,
      });
    }
    if (!graph.hasNode(target)) {
      errors.push({
        type: 'graph',
        category: 'dangling-reference',
        taskId: target,
        message: `Edge references non-existent target node: ${target}`,
      });
    }
  }

  return errors;
}

/**
 * Run both schema and graph validation, returning combined results.
 *
 * Convenience function that runs `validateSchema()` and `validateGraph()`
 * and concatenates the results into a single array.
 *
 * Validation never throws — it collects all issues and returns them.
 */
export function validate(graph: TaskGraphInner): AnyValidationError[] {
  return [...validateSchema(graph), ...validateGraph(graph)];
}