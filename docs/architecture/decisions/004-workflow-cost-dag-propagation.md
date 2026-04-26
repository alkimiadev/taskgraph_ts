# ADR-004: DAG-propagation as default workflow cost model

**Status**: Accepted

## Context

The Rust CLI computes expected value per-task independently — no upstream quality degradation. The Python research model implements DAG-propagation where each parent's failure degrades the child's effective probability. The independent model is dangerously optimistic for non-trivial workflows: poor planning (p=0.65) shows a 213% cost increase vs good planning (p=0.92) with the propagation model, but barely any difference with the independent model.

## Decision

**DAG-propagation is the default mode.** The independent model is a degenerate case accessible via `propagationMode: 'independent'` or `defaultQualityRetention: 1.0`.

## Consequences

### Positive
- More accurate cost estimates — captures the structural reality that upstream failures multiply downstream damage
- Per-task output includes both `pIntrinsic` and `pEffective` so consumers can see the degradation effect
- The independent model is still available as an opt-in degenerate case
- Per-edge `qualityRetention` allows fine-grained modeling of how much quality is preserved through each dependency

### Negative
- More complex implementation than simple sum
- Results differ from the Rust CLI — consumers migrating from CLI to library will see different numbers
- Requires `qualityRetention` per edge (default 0.9) which adds a concept the Rust CLI didn't have

### Mitigation

The `propagationMode` option allows consumers to start with the independent model and migrate to DAG-propagation when ready. The per-task `pIntrinsic`/`pEffective` split makes the propagation effect transparent.