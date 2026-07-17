# Proofline Iteration: Semantic + AI-Skeptic Evidence Augmentation

## Context
Proofline's matcher is deterministic: a **strong** link means an exact requirement ID
appears in a diff or passing check; a **suggested** link means ≥35% keyword overlap.
This proves *linkage, not fulfillment* — an unrelated ID mention, an ID on an empty
stub, or a vacuous passing test all read as "strong" today, and keyword overlap misses
semantic matches. This iteration adds two model-assisted signals without breaking the
product's values, building the boundary already reserved in PL-602. Hard invariant:
AI never mutates the deterministic EvidenceState; it is an advisory overlay that can
caveat ("needs human look") but not upgrade or silently downgrade the conclusion.

## Provider boundary and configuration

## PL-701: Introduce a replaceable semantic-analysis provider boundary
- A single typed interface abstracts every model call (embeddings and chat verdicts).
- The deterministic analysis runs unchanged when no provider is configured.
- Providers are selected in one place; swapping a provider requires no analyzer changes.
- The boundary lives in `src/domain/evidence/` as pure TypeScript with no React or DOM.

## PL-702: Default to a zero-cost, in-browser embedding provider
- A small embedding model runs locally via WASM/WebGPU (e.g. transformers.js).
- Requirement text and diff hunks are embedded in the browser; no data leaves the page.
- Model assets are lazy-loaded and cached; first-load download size and time are bounded and shown.
- The provider runs with no API key and places no network model call.

## PL-703: Offer an opt-in hosted model provider, defaulting to Hugging Face
- A hosted provider uses an OpenAI-compatible chat-completions endpoint and is available only after explicit opt-in.
- Default configuration targets a low-cost or free Hugging Face Inference model; endpoint, model, and key are configurable.
- Opt-in is off by default and re-confirmed each session; it is never persisted (see PL-601).
- The exact data to be sent (requirement text plus the specific hunk) is disclosed before the first call.

## PL-704: Centralize AI operational limits and cost guards
- Max hunk size, max requirement-artifact pairs per run, per-call token/character caps, and call concurrency live in the typed limits module (`src/config/limits.ts`).
- A hard cap bounds hosted-model calls per analysis; exceeding it stops safely and explains the limit.
- Every model call supports timeout and `AbortController` cancellation.

## Semantic suggested tier (embeddings)

## PL-711: Add a semantic-overlap suggested association rule
- When keyword phrase-overlap does not fire, cosine similarity above a configured threshold between requirement and artifact embeddings produces a `suggested` association.
- The rule is recorded as `semantic-overlap` with its similarity score as provenance.
- A semantic association is never promoted to strong evidence (upholds PL-303).

## PL-712: Keep semantic matches explainable
- Each semantic association shows its similarity score and the top contributing terms or hunk snippet.
- Semantic and keyword suggestions are visually distinguished, and both are labeled as heuristic, not verified.

## AI skeptic pass (fulfillment check on strong links)

## PL-721: Run an advisory skeptic check on every strong association
- For each exact-ID strong pair, the requirement text and the specific matched hunk are sent to the configured verdict provider.
- The provider returns exactly one of `consistent`, `contradicts`, `hollow-stub`, or `cant-tell`, plus a one-line rationale.
- The skeptic runs only when a provider is configured; otherwise strong links display exactly as they do today.

## PL-722: Surface skeptic verdicts as an overlay without mutating deterministic state
- The `EvidenceState` enum and its derivation rules are unchanged; the verdict is an annotation attached to the association.
- A `contradicts` or `hollow-stub` verdict visibly caveats the strong link as "needs human look" and is called out in the gap summary.
- `cant-tell`, timeouts, and provider errors never upgrade or downgrade the underlying evidence; they show as "not assessed."

## PL-723: Detect vacuous tests linked by ID
- For a strong test association, the skeptic assesses whether the test meaningfully asserts the requirement behavior or is empty/trivial.
- A vacuous-test verdict is surfaced as an advisory caveat on the test evidence, not a state change.

## Honesty, privacy, and reporting

## PL-731: Preserve the no-correctness-claim guarantee for AI output
- AI verdicts are labeled advisory and probabilistic, never proof of correctness or fulfillment.
- The disclaimer states that model output may be wrong and that human review remains the decision boundary (extends PL-603).

## PL-732: Keep AI data handling in memory and disclosed
- Hunks, embeddings, and verdicts are held in page memory only and cleared on refresh or close (extends PL-601).
- The hosted provider states what is sent and to which endpoint before any call; the in-browser provider states that nothing leaves the browser.
- No API key is persisted; a session key lives in memory only.

## PL-733: Include AI signals in exports, clearly separated
- Markdown and JSON exports include semantic associations and skeptic verdicts in dedicated, labeled sections.
- Exports record provider identity, model, and that the signals are advisory; deterministic evidence remains the primary record.

## PL-734: Degrade gracefully when AI is unavailable
- Provider errors, rate limits, timeouts, or offline state never break the deterministic analysis.
- The UI shows AI results as pending or unavailable while the deterministic report stands alone.

## Quality

## PL-741: Test new logic without the UI and behind a fake provider
- The provider interface has an in-test fake; the semantic rule, the skeptic overlay, and deterministic-state preservation are unit tested without network (extends PL-605).
- No live model call occurs in the unit suite.
- Any new dependency (embedding runtime, provider client) is flagged for explicit review before adoption.

## Non-goals
- No autonomous merging, code modification, or "AI approves this PR."
- AI never creates or upgrades a `strong` / `test-evidence-found` state.
- No server, database, or persisted keys; the hosted path is opt-in only.

## Suggested stack (subject to PL-741 dependency review)
- In-browser embeddings: `@huggingface/transformers` with a small model such as
  `Xenova/bge-small-en-v1.5` or `Xenova/all-MiniLM-L6-v2` (WASM, optional WebGPU).
- Hosted verdicts: OpenAI-compatible `/v1/chat/completions`, default base URL the
  Hugging Face Inference router, model configurable; OpenAI or any compatible endpoint
  drops in by config only. Constrain verdicts to a strict JSON schema (validate with `zod`).

## Where this maps in the code
- `src/domain/evidence/types.ts` — extend `EvidenceAssociation` with optional advisory
  `verdict`; add `semantic-overlap` rule and a provider interface type.
- `src/domain/evidence/association-engine.ts` — add the semantic rule after the existing
  `phrase-overlap` path; leave exact-ID and state logic untouched.
- `src/domain/evidence/state-derivation.ts` — states unchanged; only attach verdict annotations.
- `src/config/limits.ts` — add AI caps (PL-704).
- `src/app/analysis/analyze-github.ts` / `analyze-local.ts` — invoke provider after
  `associateEvidence`, gated by opt-in/config.
- `src/domain/evidence/review-report.ts` — add labeled AI sections to exports (PL-733).
- New provider files under `src/integrations/model/`.