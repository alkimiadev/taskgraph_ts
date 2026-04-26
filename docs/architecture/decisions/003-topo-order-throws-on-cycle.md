# ADR-003: topologicalOrder throws CircularDependencyError on cyclic graphs

**Status**: Accepted

## Context

When a graph has cycles, topological sort cannot produce a complete ordering. Options: return `null`, return a partial ordering, or throw an error with cycle information.

## Decision

**Throw `CircularDependencyError`** with `cycles` populated from `findCycles()`. Do not return a partial ordering or `null`.

## Consequences

### Positive
- Prevents silent ignoring of cycles — consumers get explicit error information
- `CircularDependencyError.cycles` provides the actual cycle paths for error reporting
- Simpler return type — `string[]` instead of `string[] | null` or `string[][]`
- Both consumers treat cycles as bugs: alkhub data comes from validated DB schema; OpenCode plugin data comes from frontmatter that should be validated before graph construction

### Negative
- Callers who want "best effort" ordering on cyclic graphs must catch the error and call `findCycles()` separately
- Cannot get partial results — if you want "topo sort of the acyclic portions," that requires filtering first

### Mitigation

`findCycles()` and `hasCycles()` are available for consumers that want to handle cycles gracefully before calling `topologicalOrder()`.