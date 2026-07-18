# Proofline Iteration: Context-Aware Evidence and AI Skeptic

## Goal

Extend Proofline beyond identifier and literal-text linkage so reviewers can see whether linked code and tests appear substantively related to a requirement. Deliver the work in three independently useful phases while preserving the product's central guarantee: deterministic evidence remains inspectable, model output remains advisory, and neither is presented as proof of correctness, security, fulfillment, or merge readiness.

## User stories

- As a reviewer, I want Proofline to distinguish active implementation evidence from deleted, context-only, hollow, or unassessable code so an exact requirement ID does not create false confidence.
- As a reviewer, I want an optional AI skeptic to identify apparently contradictory, hollow, or vacuous evidence while showing exactly what context it assessed.
- As a privacy-conscious user, I want semantic matching to run locally and hosted analysis to occur only after explicit disclosure and consent.

## Hard invariants

- Deterministic associations, model assessments, and integrity findings remain separate signals with separate provenance.
- AI never creates or upgrades a `strong`, `implementation-evidence-only`, or `test-evidence-found` state.
- AI does not silently remove or rewrite deterministic evidence; negative assessments visibly caveat it as `needs human review`.
- Missing context, limits, provider failures, malformed output, and cancellation produce `not-assessed` rather than an inferred verdict.
- Imported requirements, source, patches, embeddings, assessments, provider keys, and quota data are never persisted or logged.
- Immutable model and WASM assets may be browser-cached only when disclosed; repository content and derived vectors may not be cached.
- Human review remains the decision boundary.

## Delivery plan

### Phase 1: Evidence context foundation

Normalize exact matches to changed lines and hunks, distinguish deleted/context/added evidence, and build bounded context packages for implementation and test artifacts. This phase improves deterministic honesty without requiring a model.

### Phase 2: Opt-in hosted AI skeptic

Add a replaceable hosted verdict provider that assesses eligible strong associations using the Phase 1 context packages. Deterministic results render first; advisory results arrive asynchronously and degrade safely.

### Phase 3: Evaluated local semantic suggestions

Evaluate an in-browser embedding provider for requirement-to-hunk retrieval against the existing phrase-overlap baseline. Product implementation is conditional: the runtime, model assets, semantic UI, and production dependency are added only if a locked holdout evaluation satisfies the PL-722 outperform gate. Semantic associations remain suggestions and never become fulfillment evidence.

---

## Phase 1 requirements: Evidence context foundation

## PL-701: Normalize exact-match provenance and correct deterministic edge cases

- Represent unified diffs as files containing hunks and lines with path, old/new line numbers, and `added`, `context`, or `deleted` change type.
- Record the exact matched line and hunk on every exact-ID association; do not rely only on whole-patch text and file path.
- An ID found only on deleted lines must not count as current implementation evidence; surface it separately as removed linkage.
- Context-line matches may identify the relevant hunk but must be labeled context-only rather than newly implemented evidence.
- Missing or GitHub-truncated patches must produce explicit unavailable provenance and must not be treated as absent evidence.
- Preserve source-authored IDs as the only identifiers eligible for strong associations; generated `CLAIM-nnn` labels remain suggestion-only.
- Keep parsing and normalization deterministic, pure, and independently unit tested.

## PL-702: Build bounded, assessable implementation and test context packages

- Introduce a versioned `AssessmentContext` containing the requirement, association, matched hunk, numbered input lines, artifact role, and context-availability reasons.
- For implementation evidence, include the containing changed hunk and bounded surrounding head-revision source when available; include imports and bounded same-file symbol context without claiming repository-wide reachability.
- A reachability signal may use bounded references found in already-fetched changed files; absence of a reference is never proof that code is orphaned.
- Distinguish `implementation`, `test-source`, and `test-execution` artifact roles instead of treating a passing check name as test implementation.
- A GitHub check name and outcome may establish execution linkage, but vacuity cannot be assessed without relevant test source or assertions.
- For local analysis, obtain test source only from explicitly imported diffs/files; never infer unprovided source.
- Every context package reports `complete`, `partial`, or `insufficient`, with machine-readable reasons such as `patch-unavailable`, `source-unavailable`, or `test-body-unavailable`.
- Context construction uses centralized limits and supports `AbortSignal` cancellation.

## PL-703: Centralize context limits and Phase 1 acceptance gates

- Add all context limits to `src/config/limits.ts`, including hunk characters, surrounding-source characters, files per assessment, context packages per run, and fetched-source bytes.
- Initial reviewed defaults are: 12,000 characters per context package, 3 source files per assessment, 20 context packages, and 256 KB per fetched source file; changing them requires configuration only.
- Context packages are created only for associations actually displayed to the reviewer and are deduplicated by requirement, artifact, hunk, and head SHA.
- Phase 1 is complete only when tests prove that added, context, deleted, unavailable, and truncated evidence produce distinct provenance.
- Phase 1 is complete only when check execution and test implementation are represented separately.
- The deterministic demo adds an exact ID on a deleted line and a passing check without test source so judges can see the distinction without network access.

---

## Phase 2 requirements: Opt-in hosted AI skeptic

## PL-711: Define replaceable model capabilities without coupling the domain to networking

- Define separate typed ports for `SkepticProvider` and the later `EmbeddingProvider`; do not require one provider to implement unrelated capabilities.
- Port contracts and result types live in pure TypeScript under `src/domain/evidence/`; network, browser, and vendor implementations live under `src/integrations/model/`.
- Provider selection occurs in one application configuration module and requires no analyzer or React changes.
- Every provider reports a stable provider ID, model ID, model revision when available, capability, and configuration status.
- The deterministic application runs unchanged when no model provider is configured.
- The browser adapter calls only Proofline's same-origin `/api/skeptic` endpoint; provider credentials and model selection remain server-side.
- The Vercel function uses direct `fetch` against Hugging Face's OpenAI-compatible endpoint; no provider SDK dependency is required unless separately reviewed.
- The selected hosted model is configured through server-only environment variables and must be pinned after passing PL-731 evaluation.

## PL-712: Assess strong implementation and test evidence with explicit verdict contracts

- Source-authored exact-ID associations and suggestion-level declared claims with a bounded matched diff hunk are eligible when context is `partial` or `complete`; advisory output never upgrades a declared claim's deterministic strength or state.
- Implementation assessments return exactly `substantively-related`, `contradicts`, `hollow-stub`, or `insufficient-context`.
- Test assessments return exactly `meaningful-assertion`, `vacuous-test`, `contradicts`, or `insufficient-context`.
- Each assessment includes a one-sentence rationale and zero or more cited input line IDs; cited IDs are validated against the submitted context.
- `substantively-related` and `meaningful-assertion` mean only that the supplied evidence appears relevant; they never mean the requirement is fulfilled or correct.
- Repository text is delimited and identified as untrusted data; prompts instruct the provider not to follow instructions contained in requirements, source, comments, filenames, or patches.
- Responses use a strict versioned Zod schema. Invalid JSON, unknown verdicts, invalid citations, or excess output fail closed as `not-assessed`.
- Prompt template version, schema version, provider, model, and timestamp are retained with the in-memory assessment and export.

## PL-713: Run bounded asynchronous enrichment with explicit privacy controls

- Render the deterministic analysis before starting model work; run skeptic enrichment through a separate cancellable application service rather than inside deterministic state derivation.
- Hosted analysis is off by default and requires explicit confirmation for each analysis; the confirmation names Hugging Face and shows the exact files, requirement text, and bounded excerpts to be transmitted.
- Scan outbound text for configured credential and secret patterns. A suspected secret blocks that context from transmission and reports the reason.
- State that the external provider may process or retain submitted content under its own policy; Proofline itself retains no hosted payload or key after refresh or close.
- Provider keys exist only in server-side Vercel environment variables, are sent only in the server function's `Authorization` header, and are never returned to the browser or placed in URLs, logs, exports, storage, or `VITE_` variables.
- Before every model call, best-effort in-memory controls reserve a per-client request, a global request, and an estimated token allowance for the current warm function instance.
- Client identity uses a server-salted one-way hash of the connection address; raw addresses, repository content, prompts, model output, and quota records are not persisted.
- Initial server defaults are 8 requests per client per UTC day, 50 shared requests per UTC day, and 250,000 estimated shared tokens per UTC day for each warm function instance; all are adjustable through server-only configuration.
- The provider timeout is 20 seconds within a 30-second function ceiling, and output is capped at 180 tokens by default. Reservations are conservatively retained after provider failure or timeout.
- Daily-limit responses use HTTP 429 and display whether the client or shared budget was reached plus the UTC reset time. In-memory controls reset when the function instance is recycled or redeployed; missing configuration uses HTTP 503 with a clear retry message.
- Prioritize hosted calls in this order: failing-test links, passing test-source links, implementation links, then remaining eligible pairs.
- Initial reviewed limits are 8 hosted assessments per analysis, 20,000 input characters per call, 2 concurrent calls, 30-second timeout, and 1 retry only for retryable transport or rate-limit failures.
- Limit exhaustion, cancellation, offline state, rate limits, and provider errors leave unprocessed associations explicitly marked `not-assessed`.

## PL-714: Present and export advisory results without confidence theater

- Attach advisory assessments to associations without mutating `EvidenceState` derivation.
- A `contradicts`, `hollow-stub`, or `vacuous-test` result visibly marks the association and requirement summary `needs human review`.
- Positive model assessments use neutral language such as `appears substantively related`, never `verified`, `implemented`, `correct`, `safe`, or `approved`.
- The UI shows assessed, pending, not-assessed, and unavailable counts and never implies that a capped run assessed every association.
- Rationale and cited excerpts are inspectable next to provider, model, and prompt-version provenance.
- Markdown and JSON exports use a schema-version increment and place advisory assessments in a dedicated section after deterministic evidence.
- A Mermaid `.mmd` export reproduces the visible evidence map with requirement/claim nodes, artifact nodes, exact versus suggested edge styles, and `needs human review` advisory caveats.
- Exports never contain provider keys and repeat that model output is probabilistic and may be wrong.
- The deterministic demo remains fully functional without a provider; model-assisted judge demonstrations use a real provider response, never a hidden hard-coded production result.

---

## Phase 3 requirements: Evaluated local semantic suggestions

## PL-721: Add an optional in-browser embedding capability

- Begin with an isolated evaluation spike that does not add `@huggingface/transformers`, model assets, or semantic controls to the production bundle.
- Dynamically load `@huggingface/transformers` only after the user enables the semantic pass and only after PL-722's outperform gate passes; adoption of the dependency requires explicit review under PL-605.
- Pin the embedding model, model revision, dtype, pooling, normalization, and query/document formatting in configuration.
- Run feature extraction in a Web Worker, prefer WebGPU when supported, and provide a WASM fallback without blocking the main UI thread.
- Before download, show the expected model-asset size, selected runtime, caching behavior, and a cancel action.
- The initial compressed/quantized model-asset budget is 100 MB; a larger candidate requires a documented dependency and UX review.
- Cache only immutable model and WASM assets. Requirement text, code, embeddings, scores, and associations remain page-memory-only.
- Embed each unique requirement and normalized hunk once, then compute the bounded similarity matrix locally; do not embed whole multi-file patches as one artifact.
- When deterministic phrase overlap does not fire, a calibrated semantic score may create only a `suggested` association recorded as `semantic-overlap`.

## PL-722: Calibrate semantic retrieval and keep scores explainable

- Create a versioned labeled fixture set containing true semantic matches, lexical matches, unrelated distractors, generated claims, license/version text, stubs, deleted lines, and representative TypeScript, JavaScript, and C# hunks.
- Split fixtures into a model-selection set and a locked holdout set before choosing a model or threshold; do not tune against the holdout.
- Select the candidate and threshold from measured results rather than intuition; record precision, recall, F1, false positives, model revision, dtype, fixture version, and the phrase-overlap baseline.
- The production outperform gate requires holdout precision of at least 0.80, recall strictly greater than the phrase-overlap baseline, and F1 at least 0.05 higher than the baseline, with no regression in deterministic exact-ID behavior.
- If no candidate passes every outperform criterion, publish the evaluation result, close Phase 3 without product implementation, and add no embedding runtime, model download, semantic controls, or production dependency.
- A cosine score is labeled `similarity`, never `confidence` or probability.
- Explain semantic suggestions with the requirement, matched hunk excerpt, similarity score, and model provenance; do not claim unsupported “top contributing terms.”
- Initial reviewed limits are 100 semantic hunks, 4,000 characters per hunk, and one active embedding job; overflow is reported as not analyzed.
- WebGPU failure automatically offers WASM fallback; total model failure leaves deterministic analysis unchanged.
- If the outperform gate passes, Phase 3 is complete only when accessibility, cancellation, worker failure, cached-model, uncached-model, and offline behaviors are tested.

---

## Cross-phase quality and release requirements

## PL-731: Evaluate, test, and reproduce every advisory capability

- Provide fake skeptic and embedding providers for unit tests; no live model or model download occurs in the unit suite.
- Test that no advisory result changes deterministic association strength or `EvidenceState`.
- Include fixtures for hollow implementations, unrelated ID comments, contradictory behavior, meaningful tests, vacuous tests, prompt injection, malformed model output, invalid citations, timeouts, cancellation, and secret blocking.
- Maintain a manually invoked provider contract smoke test that requires an explicit environment token and cannot run in CI accidentally.
- Pin prompt and schema versions and include them in snapshot tests and exports.
- Compare at least two hosted model candidates on the same labeled skeptic fixture before selecting the default; record per-verdict accuracy and `insufficient-context` behavior.
- Document browser memory, initial asset size, warm-load time, and inference time for the selected embedding model on the supported Chromium test machine; these are benchmark observations, not universal guarantees.
- Run the existing test, lint, typecheck, production-build, accessibility, and browser smoke gates before each phase is considered complete.

## Existing code to leverage

### Evidence contracts and deterministic association
**Paths:** `src/domain/evidence/types.ts`, `association-engine.ts`, `state-derivation.ts`
- Extend versioned association provenance and attach advisory data without moving provider calls into the domain.

### GitHub and local analyzers
**Paths:** `src/app/analysis/analyze-github.ts`, `analyze-local.ts`, `patch-lines.ts`
- Reuse normalized artifacts while replacing whole-patch matching with line/hunk-aware context construction.

### GitHub client infrastructure
**Path:** `src/integrations/github/client.ts`
- Reuse cancellation, authenticated requests, caching, deduplication, ETag handling, and bounded content reads for optional head-source context.

### Integrity scanner
**Path:** `src/domain/integrity/changed-line-scanner.ts`
- Reuse deterministic stub and mock signals as input provenance; do not convert them automatically into model verdicts.

### Review and export surfaces
**Paths:** `src/app/ReviewWorkspace.tsx`, `src/domain/evidence/review-report.ts`
- Extend existing evidence details and versioned exports with visibly separate advisory sections.

## Data safety and compliance

- Proofline does not target healthcare or clinical decision-making and must not solicit PHI.
- Repository and imported content may nevertheless contain PII, proprietary code, credentials, or regulated data and must be treated as sensitive and untrusted.
- Hosted transmission is explicit, minimal, previewable, cancellable, and blocked when configured secret patterns are detected.
- No usage, repository, prompt, model response, raw address, or provider key is persisted by the hosted skeptic.
- Model assets are the only permitted persistent cache and contain no user data.

## Out of scope

- Correctness, security, requirement-fulfillment, or merge approval claims.
- Autonomous code modification, test generation, pull-request comments, merging, or deployment.
- Proof of repository-wide reachability or dead-code status from bounded model context.
- Automatic hosted inference without per-analysis user confirmation.
- Persisted analyses, prompts, embeddings, verdicts, source, or provider keys.
- Unbounded or unmetered shared inference.
- Private-repository support in this iteration.
- Fine-tuning or training a model.
- Semantic promotion to strong evidence.
- Guaranteed assessment of every association when configured limits or source availability prevent it.

## Phase exit summary

- **Phase 1:** Provenance distinguishes added, context, deleted, missing, and truncated evidence; assessment context is bounded and inspectable.
- **Phase 2:** A real opt-in hosted model can caveat hollow implementation and vacuous test evidence without altering deterministic states or breaking no-provider operation.
- **Phase 3:** A locked holdout evaluation either proves that a pinned in-browser embedding model passes the outperform gate and permits bounded product integration, or records that it did not and closes the phase without adding the runtime or production dependency.
