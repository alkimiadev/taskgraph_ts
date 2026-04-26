# ADR-001: Pivot from NAPI/Rust to TypeScript + graphology

**Status**: Accepted

## Context

The original design specified a Rust core with napi-rs bindings, extracting the graph logic from the existing taskgraph CLI. This would provide high performance but introduced significant complexity.

## Decision

Pivot to pure TypeScript with graphology as the graph engine. No Rust compilation, no native addons, no platform-specific binaries.

## Consequences

### Positive
- Cross-platform builds eliminated — pure JS works in Node, Deno, and Bun
- graphology already provides all needed DAG algorithms, and is already in our dependency tree
- Publishing is simple (`npm publish` with no CI matrix for platform binaries)
- Future UI path is straightforward — graphology powers sigma.js/react-sigma
- Near 1:1 petgraph ↔ graphology mapping means porting back to Rust is tractable

### Negative
- Raw algorithm performance is slower than Rust for very large graphs
- graphology's API differences require adaptation (not a drop-in petgraph replacement)

### Neutral
- The Rust CLI continues to exist for human/offline use — this is not a replacement, it's a parallel implementation for different consumers

## Trade-off

Performance at realistic graph sizes (10–200 nodes) is negligible between Rust and JS. The build/publish complexity savings of pure JS massively outweigh the theoretical performance gain.