// Error classes — TaskgraphError, TaskNotFoundError, CircularDependencyError,
// InvalidInputError, DuplicateNodeError, DuplicateEdgeError

export class TaskgraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskgraphError';
  }
}

export class TaskNotFoundError extends TaskgraphError {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

export class CircularDependencyError extends TaskgraphError {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class InvalidInputError extends TaskgraphError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export class DuplicateNodeError extends TaskgraphError {
  constructor(nodeId: string) {
    super(`Duplicate node: ${nodeId}`);
    this.name = 'DuplicateNodeError';
  }
}

export class DuplicateEdgeError extends TaskgraphError {
  constructor(source: string, target: string) {
    super(`Duplicate edge: ${source} → ${target}`);
    this.name = 'DuplicateEdgeError';
  }
}