---
id: error/error-hierarchy
name: Implement typed error class hierarchy
status: completed
depends_on:
  - setup/project-init
scope: narrow
risk: trivial
impact: phase
level: implementation
---

## Description

Implement the custom error classes in `src/error/index.ts` per [errors-validation.md](../../../docs/architecture/errors-validation.md). All errors extend `TaskgraphError` which extends `Error`. Each subclass adds typed fields for programmatic error recovery.

## Acceptance Criteria

- [x] `src/error/index.ts` exports:
  - `TaskgraphError extends Error` — base class
  - `TaskNotFoundError extends TaskgraphError` with `taskId: string` field
  - `CircularDependencyError extends TaskgraphError` with `cycles: string[][]` field
  - `InvalidInputError extends TaskgraphError` with `field: string` and `message: string` fields
  - `DuplicateNodeError extends TaskgraphError` with `taskId: string` field
  - `DuplicateEdgeError extends TaskgraphError` with `prerequisite: string` and `dependent: string` fields
- [x] Each error class sets `this.name` to the class name
- [x] Each error class properly extends the prototype chain (`Object.setPrototypeOf(this, new.target.prototype)`)
- [x] `InvalidInputError` supports construction from TypeBox `Value.Errors()` output (receives structured field/path/value info)
- [x] `CircularDependencyError` receives `string[][]` where each inner array is an ordered cycle path
- [x] Unit tests verifying: correct `instanceof` chain, field access, `.name` property, error messages

## References

- docs/architecture/errors-validation.md — error types, when each is thrown
- docs/architecture/api-surface.md — error documentation on specific methods

## Notes

InvalidInputError overrides `message` property to provide the validation-specific message while still calling `super()` with a combined message for the Error base. A static `fromTypeBoxError()` factory method converts TypeBox `Value.Errors()` output (with `/path` format) to the proper `field` string by stripping the leading slash.

## Summary

Implemented the full typed error class hierarchy in `src/error/index.ts`.
- Modified: `src/error/index.ts` — rewrote skeleton to add typed fields, prototype chain setup, and TypeBox factory method
- Created: `test/error.test.ts` — 31 unit tests covering instanceof chain, field access, .name property, error messages, and TypeBox integration
- Tests: 36 passing (31 error-specific + 5 existing placeholders), all lint clean