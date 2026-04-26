# ADR-005: No depth-escalation heuristic in v1

**Status**: Accepted

## Context

In the DAG-propagation model, each hop compounds another `<1.0` factor. This implicitly captures depth effects — deeper chains have more compounding. An explicit depth-escalation heuristic (increasing risk at deeper chain levels) would add another multiplicative penalty on top.

## Decision

**Defer depth-escalation to v2.** The multiplicative propagation model already captures depth effects implicitly. Adding an explicit depth heuristic would double-count the depth effect until we have empirical calibration data from actual task outcomes.

## Consequences

### Positive
- No double-counting of depth effects
- Simpler model to explain, implement, and debug
- Architecture supports future depth-escalation via per-edge `qualityDegradation` adjustments or `risk` categorical escalation without API changes

### Negative
- May underestimate cost for very deep dependency chains where risk genuinely escalates with depth
- The model treats all "hops" as equivalent — a 5-hop chain where each step is moderate risk may actually be worse than the model predicts

### Future

If empirical data from actual task outcomes shows that depth-escalation is needed, it can be added without API changes — either by adjusting `qualityDegradation` per depth, or by escalating the `risk` categorical. This is a calibration question, not an architecture question.