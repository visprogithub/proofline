# Skeptic Engineer Report

**Scope:** Whole repository: all 73 TypeScript/TSX/MJS source and test files under `src/`, `api/`, and `scripts/`, plus package/configuration files and the current iteration requirements
**Reviewed:** 73 code and test files
**Verdict:** The deterministic core is real and well tested, but the AI-skeptic layer still has several demo-grade shortcuts. Do not present source-aware reachability, cancellation, or deployment-wide cost protection as finished yet.

## Summary

| Category | Confirmed | Suspected |
|---|---:|---:|
| Fake / stubbed | 4 | 1 |
| Reinvented wheel | 1 | 0 |
| Over-engineered | 0 | 0 |
| AI-tells / dead code | 3 | 0 |

All 86 tests, TypeScript, ESLint, and the production build pass. Those gates are useful, but several findings below sit outside what the current tests actually prove.

## Findings

### 🔴 Fake / stubbed functionality

#### [src/domain/evidence/assessment-context.ts:100](src/domain/evidence/assessment-context.ts#L100) — `complete` assessment context is an unreachable costume

**What I see:** `AssessmentContextStatus` advertises `complete`, `partial`, and `insufficient`, but the only status assignment is a binary choice between `insufficient` and `partial`. Every implementation context with a patch is also tagged `source-unavailable`. The supposedly centralized source limits at [src/config/limits.ts:35](src/config/limits.ts#L35) and [src/config/limits.ts:37](src/config/limits.ts#L37) have no production caller, and neither GitHub nor local analysis fetches surrounding head-revision source, imports, symbols, or references before calling `buildAssessmentContexts`.

**Why it matters:** This is the largest gap relative to Proofline's value proposition. A requirement ID can still sit on orphaned, unreachable, or contextually useless code, while the skeptic sees only one diff hunk. The model can detect an obvious empty body, but it cannot honestly evaluate reachability or surrounding implementation when that context is never supplied.

**Fix:** Either implement bounded source enrichment and reference signals, with a real path to `complete`, or remove `complete` and the unused source-limit knobs and state plainly that Phase 2 assesses diff hunks only. Add a test proving when and why a context becomes complete.

#### [src/app/ReviewWorkspace.tsx:298](src/app/ReviewWorkspace.tsx#L298) — Cancel does not cancel the paid provider call

**What I see:** The UI aborts the browser `fetch` through `ProoflineSkeptic`, but the server creates a new controller at [src/server/skeptic-handler.ts:216](src/server/skeptic-handler.ts#L216) and passes only that timeout signal to Hugging Face at [src/server/skeptic-handler.ts:220](src/server/skeptic-handler.ts#L220). It never listens to `request.signal`. The local adapter also creates a new `Request` without tying it to the incoming connection. The server test at [src/server/skeptic-handler.test.ts:39](src/server/skeptic-handler.test.ts#L39) merely checks that some `AbortSignal` exists; it does not prove propagation.

**Why it matters:** The user sees cancellation and the browser stops waiting, but Hugging Face can continue generating and consuming the reserved quota. That is a button that only cancels the receipt, not the purchase.

**Fix:** Combine the provider timeout with `request.signal` using `AbortSignal.any`, pass the combined signal to the SDK, and propagate incoming disconnects in `scripts/local-dev.mjs`. Add a test that aborts the request and asserts the exact signal observed by `HostedChatClient` becomes aborted.

#### [src/app/analysis/augment-analysis.ts:86](src/app/analysis/augment-analysis.ts#L86) — Systemic provider failures are retried across the entire selected batch

**What I see:** The worker halts on quota and `service-unavailable`, but not on `provider-timeout` or `provider-error`. Meanwhile, routing errors, invalid model configuration, provider rejection, malformed envelopes, invalid JSON, and bad citations are all collapsed into `provider-error` by [src/server/skeptic-handler.ts:228](src/server/skeptic-handler.ts#L228) through [src/server/skeptic-handler.ts:263](src/server/skeptic-handler.ts#L263). A bad model route can therefore be called once for every selected excerpt. The official SDK retry is disabled, so this fan-out is application behavior, not library retry behavior.

**Why it matters:** One broken deployment can burn all eight per-client reservations, spend shared capacity, and make the user wait through repeated failures that could never succeed for a different excerpt.

**Fix:** Return distinct typed codes for configuration/routing/systemic failures versus per-excerpt output failures. Halt the queue on configuration, routing, authentication, and timeout failures; continue only for input-specific failures such as oversized or malformed model output.

#### [src/app/ReviewWorkspace.tsx:159](src/app/ReviewWorkspace.tsx#L159) — “Select next batch” can keep selecting the same failed excerpts

**What I see:** `selectNextBatch` excludes only `assessed` contexts. Permanent failures such as `secret-detected` remain eligible forever, and retryable failures stay at the front of the same ordered list. If the first eight contexts all fail, “Select next batch” selects those same eight again and never advances. Claim-level selection at [src/app/ReviewWorkspace.tsx:143](src/app/ReviewWorkspace.tsx#L143) likewise selects the first eight contexts in a claim without considering prior attempts.

**Why it matters:** The control was added specifically so users could cycle through evidence instead of sending the same payloads repeatedly. In the failure case, it does exactly what it promised to stop doing.

**Fix:** Track attempted context IDs separately from advisory status. Select never-attempted contexts first, skip permanently blocked contexts, and expose an explicit “Retry failures” action for provider errors. Claim selection should follow the same ordering.

#### [src/server/skeptic-handler.ts:88](src/server/skeptic-handler.ts#L88) — Suspected: “global daily” budgets are only per warm function instance

**What I see:** `globalRequests` and `globalTokens` are process-local variables. `api/skeptic.ts` creates one store per function instance. Scaling, cold starts, and redeployments create fresh “global” counters. The README does disclose the warm-instance limitation, so this is not hidden, but environment names such as `AI_GLOBAL_DAILY_LIMIT` and the user-facing “shared hosted skeptic budget” message overstate the scope.

**Why it matters:** This is a speed bump, not reliable cost containment. Concurrent serverless instances or repeated cold starts can exceed the nominal global request and token ceilings.

**Fix:** If the Hugging Face account has a hard provider spending cap and the risk is accepted for the hackathon, rename these to `INSTANCE_*` and describe them as abuse friction. Otherwise use a small durable atomic rate-limit store before presenting the limit as shared or global.

### 🟡 Reinvented wheels

#### [src/app/analysis/analyze-local.ts:21](src/app/analysis/analyze-local.ts#L21) — Unified-diff parsing is implemented three times

**What I see:** Local analysis has `parseUnifiedDiff`, GitHub integrity scanning has `changedLinesFromFiles` at [src/app/analysis/patch-lines.ts:7](src/app/analysis/patch-lines.ts#L7), and evidence provenance has `parseDiffEvidence` at [src/domain/evidence/diff-evidence.ts:6](src/domain/evidence/diff-evidence.ts#L6). All three independently track hunk headers and line numbers. They have already drifted: `parseDiffEvidence` explicitly ignores `\ No newline at end of file`, while `changedLinesFromFiles` treats it like context and increments the line counter.

**Why it matters:** Diff parsing is foundational evidence logic. Three parsers mean three places for rename, binary-patch, no-newline, CRLF, and hunk-number bugs to diverge.

**Fix:** Keep one normalized diff parser. Split multi-file local patches into file fragments, call `parseDiffEvidence` for each, and derive integrity `ChangedLine` records from normalized added lines instead of reparsing raw text.

### 🔵 Over-engineered logic

No separate findings. The main complexity problem is config and dead-code residue, recorded below rather than padded into this category.

### ⚪ AI-tells / dead code

#### [src/config/limits.ts:13](src/config/limits.ts#L13) — Central configuration contains knobs that production ignores

**What I see:** `maxAssessmentSourceFiles`, `maxAssessmentSourceBytes`, `maxHostedInputChars`, `aiTimeoutMs`, and `maxAiRetries` are validated and tested but never read by production code. Equivalent behavior is hardcoded elsewhere: 18,000 characters in the browser adapter, 20,000 in the server handler, a separate environment timeout, and SDK retries explicitly disabled.

**Why it matters:** This is configuration theater. A maintainer can change a validated setting, watch its unit test pass, and observe no production behavior change. It also makes the unfinished source-enrichment and retry features look implemented.

**Fix:** Wire each supported limit into its consumer and test the behavioral effect, or delete/defer the unused fields until the corresponding feature exists. Avoid keeping tested no-op configuration as a roadmap placeholder.

#### [src/integrations/model/proofline-skeptic.ts:112](src/integrations/model/proofline-skeptic.ts#L112) — The client casts arbitrary server error strings into a closed union

**What I see:** `errorSchema` accepts any string and then force-casts it to `SkepticServiceErrorCode`. The server actually returns `input-too-large` and `invalid-request`, neither of which exists in the union at [src/domain/evidence/model-provider.ts:21](src/domain/evidence/model-provider.ts#L21).

**Why it matters:** The type system says callers handled every error code when they did not. This is exactly how the queue lost the ability to distinguish one oversized excerpt from systemic provider failures.

**Fix:** Define one shared Zod enum and inferred TypeScript type containing every server code. Remove the cast and make queue policy exhaustive by code.

#### [src/integrations/github/issue-links.ts:14](src/integrations/github/issue-links.ts#L14) — Linked-issue parsing is tested dead production code

**What I see:** `findLinkedIssues` has a dedicated test but no production import or caller. GitHub analysis never retrieves linked issues or uses this parser. The roadmap still lists linked-issue retrieval as future work.

**Why it matters:** A tested helper can make an unfinished feature look more complete than it is. It also expands the maintenance surface for code that currently changes no user-visible behavior.

**Fix:** Remove it until linked-issue retrieval is implemented, or place it in an explicit experimental/evaluation area. When the feature is built, add the real GitHub retrieval and user-confirmation flow before moving it into production integrations.

## Verified intentional fixtures

`src/demo/demo-fixture.ts` deliberately contains `TODO` and `mockResponse` strings as inert input to the integrity scanner. The UI labels the dossier synthetic, and those strings are not imported into a production response path.

The semantic evaluation is also honestly incomplete: `evaluation/semantic/results.md` says `NOT RUN`, and no embedding dependency or semantic UI was smuggled into production. That is appropriate conditional scope, not a stub pretending to ship.

## What looks good

- Deterministic evidence states and advisory model verdicts are kept separate; model output cannot promote an association to strong evidence.
- The hosted adapter uses the official Hugging Face client, server-only credentials, strict response validation, citation checks, bounded payloads, and explicit provider provenance.
- GitHub reads have real pagination/bounds, ETag caching, in-flight deduplication, optional OAuth, and visible failure states rather than canned production responses.
- The synthetic demo is clearly labeled and exercises the same domain logic as imported and GitHub analyses.
