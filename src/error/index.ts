// Error classes — TaskgraphError, TaskNotFoundError, CircularDependencyError,
// InvalidInputError, DuplicateNodeError, DuplicateEdgeError
//
// All errors extend TaskgraphError (which extends Error) and set this.name
// to their class name. Object.setPrototypeOf is called in each constructor
// to ensure instanceof works correctly across the prototype chain when
// transpiled to ES5 targets or when extending built-ins.

export class TaskgraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskgraphError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TaskNotFoundError extends TaskgraphError {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
    this.taskId = taskId;
  }
}

export class CircularDependencyError extends TaskgraphError {
  readonly cycles: string[][];

  constructor(cycles: string[][]) {
    const cycleDescriptions = cycles
      .map((cycle) => cycle.join(' → '))
      .join('; ');
    super(`Circular dependency detected: ${cycleDescriptions}`);
    this.name = 'CircularDependencyError';
    Object.setPrototypeOf(this, new.target.prototype);
    this.cycles = cycles;
  }
}

export class InvalidInputError extends TaskgraphError {
  readonly field: string;
  override readonly message: string;

  constructor(field: string, message: string) {
    super(`Invalid input for field "${field}": ${message}`);
    this.name = 'InvalidInputError';
    Object.setPrototypeOf(this, new.target.prototype);
    this.field = field;
    this.message = message;
  }

  /**
   * Create an InvalidInputError from a TypeBox Value.Errors() iterator entry.
   * TypeBox error entries have `path` (e.g. "/dependsOn") and `message` fields.
   * The path is stripped of the leading "/" to produce the field name.
   */
  static fromTypeBoxError(error: { path: string; message: string }): InvalidInputError {
    const field = error.path.startsWith('/') ? error.path.slice(1) : error.path;
    return new InvalidInputError(field, error.message);
  }
}

export class DuplicateNodeError extends TaskgraphError {
  readonly taskId: string;

  constructor(taskId: string) {
    super(`Duplicate node: ${taskId}`);
    this.name = 'DuplicateNodeError';
    Object.setPrototypeOf(this, new.target.prototype);
    this.taskId = taskId;
  }
}

export class DuplicateEdgeError extends TaskgraphError {
  readonly prerequisite: string;
  readonly dependent: string;

  constructor(prerequisite: string, dependent: string) {
    super(`Duplicate edge: ${prerequisite} → ${dependent}`);
    this.name = 'DuplicateEdgeError';
    Object.setPrototypeOf(this, new.target.prototype);
    this.prerequisite = prerequisite;
    this.dependent = dependent;
  }
}

// ---------------------------------------------------------------------------
// Validation error return types (validation never throws — returns arrays)
// ---------------------------------------------------------------------------

/**
 * Schema validation error returned by `validateSchema()`.
 *
 * Represents a single field-level issue found by TypeBox `Value.Errors()`.
 * Schema validation catches missing required fields, invalid enum values,
 * type mismatches, etc.
 */
export interface ValidationError {
  /** Discriminator: always "schema" */
  type: 'schema';
  /** Which task has the issue (if applicable) */
  taskId?: string;
  /** Which field is invalid */
  field: string;
  /** Human-readable description of the issue */
  message: string;
  /** The invalid value (if safe to include) */
  value?: unknown;
}

/**
 * Graph-level validation error returned by `validateGraph()`.
 *
 * Represents a structural graph issue (cycles, dangling references)
 * rather than a per-field schema issue.
 */
export interface GraphValidationError {
  /** Discriminator: always "graph" */
  type: 'graph';
  /** Category of graph issue */
  category: 'cycle' | 'dangling-reference';
  /** Which task is involved (for dangling references) */
  taskId?: string;
  /** Human-readable description */
  message: string;
  /** Additional details (e.g., cycle paths for cycle errors) */
  details?: unknown;
}

/**
 * Union type for any validation error (schema or graph).
 *
 * Used as the return type for `TaskGraph.validate()` which combines
 * both `ValidationError[]` and `GraphValidationError[]`.
 */
export type AnyValidationError = ValidationError | GraphValidationError;