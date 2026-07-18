# Implementation Tasks: Context-Aware Evidence and AI Skeptic

**Specification:** `iterationrequirements.md`
**Project standards:** repository `AGENTS.md`

## Overview

Implement the iteration in dependency order: normalize deterministic evidence and assessment context, add bounded opt-in hosted enrichment, then run the conditional semantic evaluation before considering a browser model dependency.

## Phase 1 — Evidence context foundation

### Files to create

- `src/domain/evidence/diff-evidence.ts`
- `src/domain/evidence/diff-evidence.test.ts`
- `src/domain/evidence/assessment-context.ts`
- `src/domain/evidence/assessment-context.test.ts`

### Files to modify

- `src/domain/evidence/types.ts`
- `src/domain/evidence/association-engine.ts`
- `src/app/analysis/analyze-github.ts`
- `src/app/analysis/analyze-local.ts`
- `src/app/analysis/patch-lines.ts`
- `src/config/limits.ts`
- `src/demo/demo-fixture.ts`

### Tasks

- [ ] Implement unified-diff hunk and line normalization with added/context/deleted provenance.
- [ ] Attach exact-match line and hunk provenance to associations.
- [ ] Prevent deleted-only identifiers from producing current implementation evidence.
- [ ] Represent missing patches and context-only identifiers explicitly.
- [ ] Separate implementation, test-source, and test-execution artifact roles.
- [ ] Build bounded, deduplicated `AssessmentContext` values for displayed strong associations.
- [ ] Add reviewed Phase 1 limits to the centralized Zod configuration.
- [ ] Add deterministic demo cases for removed linkage and unavailable test bodies.

**Tests:** added/context/deleted lines, multiple hunks, missing patch, exact match provenance, check-only execution, test-source context, limits, and state preservation.

**Success criteria:** Phase 1 PL-701 through PL-703 acceptance gates pass without network or model calls.

## Phase 2 — Hosted skeptic

### Files to create

- `src/domain/evidence/model-provider.ts`
- `src/domain/evidence/advisory-assessment.ts`
- `src/domain/evidence/advisory-assessment.test.ts`
- `src/integrations/model/proofline-skeptic.ts`
- `src/integrations/model/proofline-skeptic.test.ts`
- `src/server/skeptic-handler.ts`
- `src/server/skeptic-handler.test.ts`
- `api/skeptic.ts`
- `src/app/analysis/augment-analysis.ts`
- `src/app/analysis/augment-analysis.test.ts`

### Files to modify

- `src/domain/evidence/types.ts`
- `src/domain/evidence/review-report.ts`
- `src/app/App.tsx`
- `src/app/ReviewWorkspace.tsx`
- `src/styles/global.css`

### Tasks

- [ ] Define separate skeptic and embedding provider ports with versioned Zod results.
- [ ] Implement a same-origin browser adapter and server-only Hugging Face proxy using bound `fetch` and abortable timeouts.
- [ ] Delimit repository content as untrusted input and validate verdict citations.
- [ ] Block outbound contexts containing configured secret patterns.
- [ ] Implement prioritized, concurrency-limited, cancellable enrichment after deterministic rendering.
- [ ] Add a per-analysis disclosure/confirmation surface with no browser key input.
- [ ] Enforce best-effort salted per-client, global-request, and global-token daily limits in the warm function instance before provider calls.
- [ ] Return clear 429 reset guidance and document the per-instance reset limitation.
- [ ] Render pending, assessed, not-assessed, and needs-human-review overlays.
- [ ] Add schema-versioned advisory sections to Markdown and JSON exports.
- [ ] Add a Mermaid `.mmd` evidence-map serializer and download control with safe labels, edge strengths, and advisory caveats.

**Tests:** fake provider, hollow/vacuous/contradictory verdicts, malformed JSON, invalid citations, prompt injection fixture, secret blocking, timeout, cancellation, limits, exports, and unchanged deterministic states.

**Success criteria:** Phase 2 works with fake quota and model providers in automated tests, degrades cleanly without server configuration, and can be manually smoke-tested with a server-only Vercel token.

## Phase 3 — Conditional semantic evaluation

### Files to create

- `evaluation/semantic/fixtures.selection.json`
- `evaluation/semantic/fixtures.holdout.json`
- `evaluation/semantic/evaluate.ts`
- `evaluation/semantic/README.md`
- `evaluation/semantic/results.md`

### Tasks

- [ ] Lock labeled model-selection and holdout fixtures before threshold selection.
- [ ] Implement the phrase-overlap baseline evaluator and precision/recall/F1 report.
- [ ] Evaluate candidate pinned embedding models outside the production bundle.
- [ ] Apply the PL-722 outperform gate on the untouched holdout set.
- [ ] If the gate fails, publish results and add no production dependency or UI.
- [ ] If the gate passes, request dependency review before implementing the worker, runtime fallback, caching disclosure, semantic rule, UI, and tests.

**Success criteria:** the evaluation is reproducible and Phase 3 product work is impossible to enable without a passing recorded gate.

## Verification

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run browser smoke and accessibility checks for changed flows.
- [ ] Run the skeptical-engineer review before requesting human PR review.

## Summary

| Layer | Implementation groups | Test groups |
|---|---:|---:|
| Evidence domain | 7 | 8 |
| Provider integration | 4 | 7 |
| Application/UI | 5 | 5 |
| Semantic evaluation | 5 | 2 |
| **Total** | **21** | **22** |

Implementation remains sequential across phases. The server persists quota counters only; no analysis content is persisted. Autonomous review action, private-repository work, and semantic promotion to strong evidence remain excluded.
