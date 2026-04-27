---
id: review/schemas-and-errors
name: Review schema, enum, and error implementations for consistency
status: pending
depends_on:
  - schema/enums
  - schema/input-schemas
  - schema/graph-schemas
  - schema/result-types
  - schema/numeric-methods-and-defaults
  - error/error-hierarchy
scope: narrow
risk: low
impact: phase
level: review
---

## Description

Review the schema and error layer implementations before building the graph and analysis layers on top. This is a critical checkpoint because everything downstream depends on these types being correct and consistent with the architecture docs.

## Acceptance Criteria

- [ ] All TypeBox schemas match [schemas.md](../../../docs/architecture/schemas.md) exactly
- [ ] All `Static<typeof>` type aliases correctly derived — no manual type definitions
- [ ] Nullable helper used consistently in TaskInput (not in TaskGraphNodeAttributes)
- [ ] Enum values match DB/frontmatter conventions exactly
- [ ] Numeric method tables match spec tables exactly
- [ ] `resolveDefaults` correctly separates "nullable categorical→default" from "label-only nullable→stays nullable"
- [ ] Error class hierarchy is correct: all extend TaskgraphError, all have proper `name` and typed fields
- [ ] `InvalidInputError` can be constructed from `Value.Errors()` output
- [ ] `CircularDependencyError.cycles` type is `string[][]`
- [ ] No Zod, no gray-matter, no js-yaml in any dependency
- [ ] `package.json` lists only approved dependencies
- [ ] All tests pass

## References

- docs/architecture/schemas.md
- docs/architecture/errors-validation.md
- docs/architecture/frontmatter.md — supply chain constraints

## Notes

> To be filled by implementation agent

## Summary

> To be filled on completion