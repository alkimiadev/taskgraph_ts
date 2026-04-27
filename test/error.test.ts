import { describe, it, expect } from 'vitest';
import {
  TaskgraphError,
  TaskNotFoundError,
  CircularDependencyError,
  InvalidInputError,
  DuplicateNodeError,
  DuplicateEdgeError,
} from '../src/error/index.js';

describe('TaskgraphError', () => {
  it('is an instance of Error', () => {
    const err = new TaskgraphError('base error');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaskgraphError);
  });

  it('sets name to TaskgraphError', () => {
    const err = new TaskgraphError('base error');
    expect(err.name).toBe('TaskgraphError');
  });

  it('preserves the message', () => {
    const err = new TaskgraphError('something went wrong');
    expect(err.message).toBe('something went wrong');
  });
});

describe('TaskNotFoundError', () => {
  it('is an instance of Error, TaskgraphError, and TaskNotFoundError', () => {
    const err = new TaskNotFoundError('task-1');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaskgraphError);
    expect(err).toBeInstanceOf(TaskNotFoundError);
  });

  it('sets name to TaskNotFoundError', () => {
    const err = new TaskNotFoundError('task-1');
    expect(err.name).toBe('TaskNotFoundError');
  });

  it('exposes taskId field', () => {
    const err = new TaskNotFoundError('task-42');
    expect(err.taskId).toBe('task-42');
  });

  it('includes taskId in the message', () => {
    const err = new TaskNotFoundError('task-42');
    expect(err.message).toContain('task-42');
  });
});

describe('CircularDependencyError', () => {
  it('is an instance of Error, TaskgraphError, and CircularDependencyError', () => {
    const err = new CircularDependencyError([['a', 'b', 'a']]);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaskgraphError);
    expect(err).toBeInstanceOf(CircularDependencyError);
  });

  it('sets name to CircularDependencyError', () => {
    const err = new CircularDependencyError([['a', 'b', 'a']]);
    expect(err.name).toBe('CircularDependencyError');
  });

  it('exposes cycles field as string[][]', () => {
    const cycles = [
      ['a', 'b', 'c', 'a'],
      ['x', 'y', 'x'],
    ];
    const err = new CircularDependencyError(cycles);
    expect(err.cycles).toEqual(cycles);
    expect(err.cycles).toHaveLength(2);
    expect(err.cycles[0]).toEqual(['a', 'b', 'c', 'a']);
    expect(err.cycles[1]).toEqual(['x', 'y', 'x']);
  });

  it('includes cycle path descriptions in the message', () => {
    const err = new CircularDependencyError([['a', 'b', 'c']]);
    expect(err.message).toContain('a → b → c');
  });

  it('handles multiple cycles in message', () => {
    const err = new CircularDependencyError([
      ['a', 'b', 'a'],
      ['x', 'y', 'x'],
    ]);
    expect(err.message).toContain('a → b → a');
    expect(err.message).toContain('x → y → x');
  });
});

describe('InvalidInputError', () => {
  it('is an instance of Error, TaskgraphError, and InvalidInputError', () => {
    const err = new InvalidInputError('name', 'is required');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaskgraphError);
    expect(err).toBeInstanceOf(InvalidInputError);
  });

  it('sets name to InvalidInputError', () => {
    const err = new InvalidInputError('name', 'is required');
    expect(err.name).toBe('InvalidInputError');
  });

  it('exposes field and message fields', () => {
    const err = new InvalidInputError('dependsOn', 'must be an array');
    expect(err.field).toBe('dependsOn');
    expect(err.message).toBe('must be an array');
  });

  it('exposes field and message as separate properties', () => {
    const err = new InvalidInputError('name', 'is required');
    // message field on InvalidInputError shadows Error.message and holds the
    // validation-specific message (per architecture spec: field + message)
    expect(err.field).toBe('name');
    expect(err.message).toBe('is required');
  });

  it('creates from TypeBox Value.Errors() output via static method', () => {
    const typeboxError = {
      path: '/dependsOn',
      message: 'Expected array, received string',
    };
    const err = InvalidInputError.fromTypeBoxError(typeboxError);
    expect(err).toBeInstanceOf(InvalidInputError);
    expect(err.field).toBe('dependsOn');
    expect(err.message).toBe('Expected array, received string');
  });

  it('strips leading slash from TypeBox path in fromTypeBoxError', () => {
    const typeboxError = {
      path: '/risk',
      message: 'Invalid enum value',
    };
    const err = InvalidInputError.fromTypeBoxError(typeboxError);
    expect(err.field).toBe('risk');
  });

  it('handles nested path in fromTypeBoxError', () => {
    const typeboxError = {
      path: '/attributes/risk',
      message: 'Invalid enum value',
    };
    const err = InvalidInputError.fromTypeBoxError(typeboxError);
    expect(err.field).toBe('attributes/risk');
  });

  it('handles path without leading slash in fromTypeBoxError', () => {
    const typeboxError = {
      path: 'name',
      message: 'Required',
    };
    const err = InvalidInputError.fromTypeBoxError(typeboxError);
    expect(err.field).toBe('name');
  });
});

describe('DuplicateNodeError', () => {
  it('is an instance of Error, TaskgraphError, and DuplicateNodeError', () => {
    const err = new DuplicateNodeError('task-1');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaskgraphError);
    expect(err).toBeInstanceOf(DuplicateNodeError);
  });

  it('sets name to DuplicateNodeError', () => {
    const err = new DuplicateNodeError('task-1');
    expect(err.name).toBe('DuplicateNodeError');
  });

  it('exposes taskId field', () => {
    const err = new DuplicateNodeError('task-99');
    expect(err.taskId).toBe('task-99');
  });

  it('includes taskId in the message', () => {
    const err = new DuplicateNodeError('task-99');
    expect(err.message).toContain('task-99');
  });
});

describe('DuplicateEdgeError', () => {
  it('is an instance of Error, TaskgraphError, and DuplicateEdgeError', () => {
    const err = new DuplicateEdgeError('prereq', 'dep');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TaskgraphError);
    expect(err).toBeInstanceOf(DuplicateEdgeError);
  });

  it('sets name to DuplicateEdgeError', () => {
    const err = new DuplicateEdgeError('prereq', 'dep');
    expect(err.name).toBe('DuplicateEdgeError');
  });

  it('exposes prerequisite and dependent fields', () => {
    const err = new DuplicateEdgeError('prereq-task', 'dep-task');
    expect(err.prerequisite).toBe('prereq-task');
    expect(err.dependent).toBe('dep-task');
  });

  it('includes prerequisite and dependent in the message', () => {
    const err = new DuplicateEdgeError('prereq-task', 'dep-task');
    expect(err.message).toContain('prereq-task');
    expect(err.message).toContain('dep-task');
  });
});

describe('prototype chain', () => {
  it('all subclasses are properly linked in the prototype chain', () => {
    const errors = [
      new TaskgraphError('base'),
      new TaskNotFoundError('id'),
      new CircularDependencyError([['a', 'b']]),
      new InvalidInputError('field', 'msg'),
      new DuplicateNodeError('id'),
      new DuplicateEdgeError('src', 'tgt'),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TaskgraphError);
      // Verify Object.setPrototypeOf worked correctly
      expect(Object.getPrototypeOf(err)).not.toBe(Error.prototype);
    }
  });

  it('catch clause works correctly for subclasses', () => {
    const throwTaskNotFound = (): never => {
      throw new TaskNotFoundError('missing');
    };

    expect(() => {
      try {
        throwTaskNotFound();
      } catch (e) {
        // Should be catchable as TaskgraphError
        if (e instanceof TaskgraphError) {
          throw e;
        }
        throw new Error('unexpected');
      }
    }).toThrow(TaskNotFoundError);
  });

  it('field access works after catching as TaskgraphError', () => {
    const err: TaskgraphError = new TaskNotFoundError('task-1');
    // After narrowing via instanceof, fields should be accessible
    if (err instanceof TaskNotFoundError) {
      expect(err.taskId).toBe('task-1');
    }
  });
});