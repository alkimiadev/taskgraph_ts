---
id: error/error-hierarchy
name: Implement typed error class hierarchy
status: pending
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

- [ ] `src/error/index.ts` exports:
  - `TaskgraphError extends Error` — base class
  - `TaskNotFoundError extends TaskgraphError` with `taskId: string` field
  - `CircularDependencyError extends TaskgraphError` with `cycles: string[][]` field
  - `InvalidInputError extends TaskgraphError` with `field: string` and `message: string` fields
  - `DuplicateNodeError extends TaskgraphError` with `taskId: string` field
  - `DuplicateEdgeError extends TaskgraphError` with `prerequisite: string` and `dependent: string` fields
- [ ] Each error class sets `this.name` to the class name
- [ ] Each error class properly extends the prototype chain (`Object.setPrototypeOf(this, new.target.prototype)`)
- [ ] `InvalidInputError` supports construction from TypeBox `Value.Errors()` output (receives structured field/path/value info)
- [ ] `CircularDependencyError` receives `string[][]` where each inner array is an ordered cycle path
- [ ] Unit tests verifying: correct `instanceof` chain, field access, `.name` property, error messages

## References

- docs/architecture/errors-validation.md — error types, when each is thrown
- docs/architecture/api-surface.md — error documentation on specific methods

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion