# Semantic retrieval evaluation

Phase 3 is conditional. `fixtures.selection.json` may be used for model and threshold selection; `fixtures.holdout.json` is locked and must not be inspected for tuning after candidate evaluation begins.

Candidate predictions are evaluated with `binaryEvaluationMetrics` and `semanticOutperformGate` from `src/domain/evidence/semantic-evaluation.ts`.

Production integration requires all of the following on the locked holdout:

- precision at least 0.80;
- recall greater than the current phrase-overlap baseline;
- F1 at least 0.05 above that baseline;
- no deterministic exact-ID regression.

No browser embedding dependency or model assets may be added merely to run this harness. A candidate runtime requires explicit dependency review.
