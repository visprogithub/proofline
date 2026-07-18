# Skeptic Engineer Report

**Scope:** Whole repository: 72 TypeScript, TSX, and MJS source/test files under `src/`, `api/`, and `scripts/`, plus package/configuration files and iteration requirements  
**Reviewed:** 72 code and test files  
**Verdict:** The confirmed AI-skeptic shortcuts from the audit have been removed. The remaining warm-instance quota limitation is an explicitly accepted hackathon tradeoff, not deployment-wide cost enforcement.

## Summary

| Category | Confirmed | Suspected |
|---|---:|---:|
| Fake / stubbed | 0 | 0 |
| Reinvented wheel | 0 | 0 |
| Over-engineered | 0 | 0 |
| AI-tells / dead code | 0 | 0 |

## Findings

No confirmed or suspected AI-slop findings remain from this audit.

## Remediation evidence

- [src/app/analysis/analyze-github.ts](src/app/analysis/analyze-github.ts) now fetches bounded head-revision source for associated GitHub artifacts. [src/domain/evidence/assessment-context.ts](src/domain/evidence/assessment-context.ts) adds nearby source and imports and has a real `complete` path. A regression test proves the resulting context.
- [src/server/skeptic-handler.ts](src/server/skeptic-handler.ts) combines request cancellation with the provider timeout through `AbortSignal.any`; [scripts/local-dev.mjs](scripts/local-dev.mjs) propagates connection aborts. A server test aborts the caller and verifies the provider's exact signal becomes aborted.
- [src/domain/evidence/model-provider.ts](src/domain/evidence/model-provider.ts) defines one closed service-error vocabulary. [src/app/analysis/augment-analysis.ts](src/app/analysis/augment-analysis.ts) stops queued calls after systemic configuration, routing, rejection, timeout, quota, or service failures. A serial-queue regression test proves a routing failure results in only one provider call.
- [src/app/ReviewWorkspace.tsx](src/app/ReviewWorkspace.tsx) tracks attempts separately, prioritizes unattempted excerpts, and skips secret-blocked excerpts. Collapsed requirement rows now expose AI-reviewed, not-assessed, and human-review-flagged summaries. The UI test proves one eligible request is sent, the blocked excerpt is not sent, and the next batch is empty afterward.
- [src/app/analysis/analyze-local.ts](src/app/analysis/analyze-local.ts) and [src/app/analysis/patch-lines.ts](src/app/analysis/patch-lines.ts) derive changed lines from the normalized evidence diff parser instead of maintaining a third line-number parser.
- [src/config/limits.ts](src/config/limits.ts) no longer advertises unused timeout/retry knobs. Source-fetch, hosted-count, hosted-input, and concurrency limits all have production consumers.
- [src/integrations/model/proofline-skeptic.ts](src/integrations/model/proofline-skeptic.ts) validates server error codes with the shared Zod enum instead of force-casting arbitrary strings.
- The uncalled `src/integrations/github/issue-links.ts` helper and its self-contained test were removed. The task plan now marks the production linked-issue flow as deferred rather than leaving tested dead code behind.

## Accepted tradeoff

Hosted request and estimated-token counters remain process-local to each warm function instance. The owner explicitly accepted this for the hackathon because the selected Hugging Face model uses free inference and deployments are owner-controlled. README and UI language call these **best-effort warm-instance budgets**; they are not described as durable or deployment-global enforcement.

## Verification

- `npm test -- --run`: 28 files, 91 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vercel build --yes`: passed and produced `.vercel/output`.

## What looks good

- Deterministic evidence states remain isolated from advisory model verdicts; the model cannot upgrade evidence strength or approve a change.
- The hosted path uses the official Hugging Face client, server-only credentials, bounded payloads, strict response/citation validation, cancellation, and typed failure policy.
- GitHub reads are bounded and use caching, request deduplication, ETags, progressive document discovery, optional OAuth, and visible failures instead of canned production responses.
- The synthetic fixture is clearly labeled and exercises production evidence and integrity logic rather than a separate demo-only implementation.
