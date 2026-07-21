# Skeptic Engineer Report

**Scope:** The model-interpreted integrity feature (commit `27c230b`) — `src/domain/integrity/interpreted-findings.ts`, `src/app/analysis/interpret-integrity.ts` + test, `src/server/skeptic-handler.ts` (integrity mode), `src/integrations/model/proofline-skeptic.ts` (`send`/`interpret`), `src/domain/evidence/model-provider.ts`, `src/app/analysis/types.ts`, `analyze-local.ts`, `analyze-github.ts`, `src/demo/demo-fixture.ts`, `src/domain/integrity/changed-line-scanner.ts`, `src/app/ReviewWorkspace.tsx`, `src/styles/global.css`
**Reviewed:** 13 in-scope files, plus ~12 supporting files read to verify call chains (`augment-analysis.ts`, `limits.ts`, `patch-lines.ts`, `outbound-safety.ts`, `huggingface-client.ts`, `diff-evidence.ts`, `review-report.ts`, `skeptic-handler.test.ts`, `proofline-skeptic.test.ts`, `ReviewWorkspace.test.tsx`, tsconfigs)
**Verdict:** The plumbing is real and the safety posture is right — but the lane over-promises in the UI and under-reports every way it silently does less. Several confirmed defects, one of which (an empty batch guaranteed to 400) is a straight bug. Fix the honesty gaps before this ships in a product whose entire pitch is "the code doesn't match the claim."

> **Blocker for verification:** `npm test` does not run in this working copy. All **31/31** test files fail during collection with `TypeError: Cannot read properties of undefined (reading 'config')` at the first `describe()` — reproduced with a two-line `expect(1).toBe(1)` file under a clean config with no setup files, so it is the toolchain, not the repo code. Vitest 4.1.10 / Node 24.13.0, single `@vitest/runner` copy. The previous `SLOP_REPORT.md` records "28 files, 91 tests passed", so this regressed after that run. **Every finding below is from reading code, not from executing it.** Try `rm -rf node_modules && npm ci` before trusting any "tests pass" claim about this feature.

## Summary

| Category | Confirmed | Suspected |
|---|---:|---:|
| Fake / stubbed (claims not backed by code) | 8 | 0 |
| Reinvented wheel / duplication | 3 | 0 |
| Over-engineered / wrong shape | 2 | 0 |
| AI-tells / dead code | 5 | 0 |

## Findings

### 🔴 Fake / stubbed — claims the code does not back

#### [src/app/ReviewWorkspace.tsx:463](src/app/ReviewWorkspace.tsx#L463) — "sends all {changedLineCount} changed lines" is false three ways
**What I see:** The intro copy tells the user the pass "sends all {N} changed lines to the hosted model," where `changedLineCount` is `currentAnalysis.changedLines?.length`. What actually gets sent is filtered by `isSourcePath` (so `.md`, `.json`, `.yml`, `.sql` lines counted in N are never sent), then re-bounded by `batches.slice(0, limits.maxHostedAssessments)` — 20 batches × 60 lines = **1,200 lines maximum, ever**. A PR with 3,000 added source lines sends 40% of them and tells the user it sent 100%.
**Why it matters:** This is Proofline flagging hollow implementations while making a hollow implementation claim in its own UI. A reviewer reads "no additional shortcut signals" and believes the whole diff was read. It wasn't. If a demo audience diffs the network tab against that sentence, the product's core credibility claim goes with it.
**Fix:** Compute the real number before rendering — run `buildIntegrityBatches` in a `useMemo` and display `batches.reduce((n, b) => n + b.lines.length, 0)` of `changedLineCount`, e.g. "reads 1,200 of 3,047 changed lines (source files only, bounded to 20 batches)". Never state a coverage number you didn't derive from the thing that produces coverage.

#### [src/app/analysis/interpret-integrity.ts:60](src/app/analysis/interpret-integrity.ts#L60) — batches past the limit are dropped and not even counted
**What I see:** `return batches.slice(0, limits.maxHostedAssessments)`. Everything past batch 20 vanishes. It is not added to `skipped`, not represented in `InterpretedIntegrityRun`, not surfaced anywhere. Because batching walks `changedLines` in file order, the first few files consume the entire budget and later files get **zero** coverage with no trace.
**Why it matters:** Your sibling lane already got this right — [augment-analysis.ts:57-58](src/app/analysis/augment-analysis.ts#L57) explicitly records `notAssessed('limit-reached', context)` for exactly this case. The new lane dropped that discipline and replaced it with a `.slice()`. Silent truncation in an audit tool is worse than no audit.
**Fix:** Mirror the sibling: build all batches, take the first `maxHostedAssessments`, and record the remainder as a `limitReached: number` (or per-path list) on `InterpretedIntegrityRun`. Render it.

#### [src/app/analysis/interpret-integrity.ts:83,105,130](src/app/analysis/interpret-integrity.ts#L83) + [ReviewWorkspace.tsx:474](src/app/ReviewWorkspace.tsx#L474) — `skipped` is computed, stored, and never shown
**What I see:** `skipped` accumulates three distinct failure modes — credential-blocked batches (line 83), aborted batches (line 105), and provider errors (line 130). It lands on `InterpretedIntegrityRun.skipped`. The summary line renders findings, `duplicatesDropped`, and `interpreted` — and omits `skipped` entirely. `grep skipped src/app/ReviewWorkspace.tsx` matches only an unrelated CSS class.
**Why it matters:** Combined with the next finding, a run in which every single batch failed renders as a clean bill of health. That is phantom robustness: the counter exists so the code *looks* like it tracks failures, but no human ever sees the number.
**Fix:** Add `· {interpretedRun.skipped} not read` to the summary at line 477, and break `skipped` into its three causes so "blocked for credentials" doesn't read the same as "provider died."

#### [src/app/ReviewWorkspace.tsx:495](src/app/ReviewWorkspace.tsx#L495) — a fully failed run renders as "no signals found"
**What I see:** `{interpretedRun && !interpretedRun.findings.length && <p>The model reported no additional shortcut signals in the reviewed excerpts.</p>}`. This fires whenever `findings` is empty — including when zero batches were eligible, when every batch was credential-blocked, and when the run halted on the first quota error. The button's guard (`disabled={... || !changedLineCount}`, line 456) checks *changed lines*, not *eligible source batches*, so a docs-only PR enables the button, sends nothing, and prints the reassuring sentence.
**Why it matters:** "The model reported no signals in the reviewed excerpts" when zero excerpts were reviewed is the textbook false-negative. A reviewer takes this as evidence of cleanliness.
**Fix:** Gate on `interpretedRun.interpreted > 0` for the clean-result copy; otherwise render "No excerpts were read" with the skip reason. Disable the button on `!buildIntegrityBatches(currentAnalysis).length`, not on `!changedLineCount`.

#### [src/app/analysis/interpret-integrity.ts:50](src/app/analysis/interpret-integrity.ts#L50) — any added line over 6,000 chars emits an empty batch that is guaranteed to 400
**What I see:**
```ts
if (current.length >= MAX_BATCH_LINES || characters + line.content.length > MAX_BATCH_CHARS) {
  batches.push({ id: ..., path, lines: current })   // current is [] on the first iteration
```
On the first line of a file, `current` is `[]` and `characters` is `0`. A 7,000-char line makes `0 + 7000 > 6000` true, so it pushes a batch with **zero lines** before starting a new one. `batchText([])` is `''`, `scanOutboundText('')` returns `[]`, so the empty batch passes the safety gate and is sent. The server's `lines: z.array(lineSchema).min(1)` ([skeptic-handler.ts:27](src/server/skeptic-handler.ts#L27)) rejects it → 400 `invalid-request` → "The assessment context is incomplete or invalid."
**Why it matters:** `isSourcePath` matches `\.js$`, so any vendored/minified JS, generated file, long base64 data URI, or big inline regex triggers it. And because `serviceError ??= error` keeps the *first* error, that bogus 400 becomes the run's headline message even if everything else succeeded — it will mask a real quota-exhaustion message that arrives later.
**Fix:** Guard the flush: `if (current.length && (...))`. Separately, truncate over-long lines at build time rather than relying on `interpret()`'s 4,000-char `truncate` downstream.

#### [src/integrations/model/proofline-skeptic.ts:148](src/integrations/model/proofline-skeptic.ts#L148) — `interpret()` bypasses the serialized-size budget that `assess()` enforces
**What I see:** `assess()` routes through `this.compact()` → `hostedContext(context, maxHostedInputChars - 2000)`, which measures the **actual** `JSON.stringify(...).length` and sheds content when it's over budget ([lines 60-79](src/integrations/model/proofline-skeptic.ts#L60)). `interpret()` calls `send()` directly and only applies per-field `truncate()`. Nothing measures the assembled request. Meanwhile `MAX_BATCH_CHARS` counts **raw** content length, but the wire carries **JSON-escaped** content — a quote-and-backslash-heavy 6,000-char batch can serialize to ~12,000, plus 60 line IDs (up to 200 chars each per the server schema) plus ~50 chars of per-line JSON overhead. That clears the server's `serialized.length > 20_000` → 413 `input-too-large` ([skeptic-handler.ts:211](src/server/skeptic-handler.ts#L211)).
**Why it matters:** The refactor pulled the network call into a shared `send()` but left the size discipline behind on one caller — a classic "shared helper, unshared invariant" regression. And `input-too-large` is **not** in the halt list at [interpret-integrity.ts:133-138](src/app/analysis/interpret-integrity.ts#L133), so every subsequent batch retries into the same wall.
**Fix:** Have `interpret()` measure the payload the same way `hostedContext` does and shed lines until it fits `this.limits.maxHostedInputChars - 2000`. Add `input-too-large` and `invalid-request` to the halt set, or better, make the halt set "everything except transient `provider-error`."

#### [src/app/analysis/interpret-integrity.ts:117](src/app/analysis/interpret-integrity.ts#L117) — dedupe cannot fire on an uncited finding
**What I see:**
```ts
if (citedLines.length && citedLines.every(({ id }) => alreadyFlagged.has(id))) { duplicates += 1; continue }
findings.push(createInterpretedFinding({ ... citedLines ... }))
```
The server permits `citedLineIds: []` (its validation is `.some(id => !validLines.has(id))`, which is `false` for an empty array). So a model that returns a verdict with no citations — routine behavior — produces a finding with `citedLines: []` that short-circuits past dedupe entirely. The UI then hides the excerpt block (`{finding.citedLines.length > 0 && ...}`, [line 486](src/app/ReviewWorkspace.tsx#L486)) and renders a verdict with no evidence at all.
**Why it matters:** The UI promises the pass "discards anything the rules above already report" ([line 465](src/app/ReviewWorkspace.tsx#L465)). That promise is unenforceable for exactly the findings you can't check. It also violates the product's own rule that a finding must point at observed lines — an advisory card with a verdict, a rationale, and zero citations is the model's opinion dressed as evidence.
**Fix:** Drop findings with empty `citedLines` outright (count them as `invalid-response`), or tighten the server to `citedLineIds: z.array(z.string()).min(1).max(12)` for `mode: 'integrity'`. Also note the dedupe only matches *exact* line-level overlap — cite the line next to a TODO and it survives; soften the UI copy accordingly.

#### [src/app/analysis/interpret-integrity.ts:129](src/app/analysis/interpret-integrity.ts#L129) — the catch swallows everything that isn't a `SkepticServiceError`
**What I see:** `catch (error) { skipped += 1; if (error instanceof SkepticServiceError) { ... } }`. A `TypeError` in the response-mapping code, an abort `DOMException`, an OOM on a huge batch — all become an invisible `skipped++` with no message, no console, no rethrow. The `try` block also wraps the post-response mapping, so a bug in *your* code is indistinguishable from a provider failure.
**Why it matters:** This is the phantom-robustness pattern: nothing ever throws, so nothing ever looks broken. Note the sibling lane at [augment-analysis.ts:96-107](src/app/analysis/augment-analysis.ts#L96) at least classifies the error into a typed reason — the new lane discarded that too.
**Fix:** Narrow the `try` to the `await interpreter.interpret(...)` call only, and record a typed reason per batch (you already declared the enum for it — see the dead-code section). Let non-`SkepticServiceError` failures propagate so `handleInterpretIntegrity`'s `catch` can surface them.

### 🟡 Reinvented wheels / duplication

#### [src/app/analysis/interpret-integrity.ts:16](src/app/analysis/interpret-integrity.ts#L16) — batch limits hardcoded around the project's own limits registry
**What I see:** `const MAX_BATCH_CHARS = 6_000` and `MAX_BATCH_LINES = 60` as module constants, in a function that **takes `limits: OperationalLimits` as a parameter** and then only uses it for one `.slice()`. Meanwhile `src/config/limits.ts` is a zod-validated, frozen registry already holding `maxSemanticHunkChars: 4_000`, `maxAssessmentContextChars: 12_000`, `maxHostedInputChars: 20_000` — the exact same class of knob.
**Why it matters:** The previous audit specifically called out limits.ts for advertising unused knobs and got it cleaned up; this change re-fragments it in the other direction. Two of the three numbers that govern how much of a diff gets reviewed now live outside the place the repo says limits live, and can't be overridden by `createOperationalLimits`.
**Fix:** Add `maxIntegrityBatchChars` and `maxIntegrityBatchLines` to `limitsSchema`/`DEFAULT_LIMITS` and read them off the `limits` param.

#### [src/app/analysis/interpret-integrity.ts:19](src/app/analysis/interpret-integrity.ts#L19) — third copy of the path normalizer, and one redundant call
**What I see:** `function normalize(path) { return path.replaceAll('\\', '/') }`. That exact expression already exists twice in `changed-line-scanner.ts` — once inside [`isSourcePath` (line 71)](src/domain/integrity/changed-line-scanner.ts#L71) and once inline in [`scanChangedLines` (line 87)](src/domain/integrity/changed-line-scanner.ts#L87). Because `isSourcePath` normalizes internally, [line 39](src/app/analysis/interpret-integrity.ts#L39) normalizes an already-normalized path.
**Why it matters:** Small, but the dedupe at line 89 depends on this normalization matching the scanner's byte-for-byte. Three copies of a correctness-critical string transform is three chances to drift, and drift here fails *silently* — `alreadyFlagged.has(id)` just starts returning `false` and duplicate findings quietly reappear.
**Fix:** Export `normalizePath` from `changed-line-scanner.ts` (or a small `domain/integrity/paths.ts`) and use it in all three places.

#### [src/app/analysis/interpret-integrity.ts:99-147](src/app/analysis/interpret-integrity.ts#L99) — the worker pool is a near-verbatim copy of `augment-analysis.ts`
**What I see:** The `let cursor = 0` / `async function worker()` / `while (cursor < eligible.length)` / `Promise.all(Array.from({ length: Math.min(limits.maxAiConcurrency, eligible.length) }, () => worker()))` block is line-for-line the same shape as [augment-analysis.ts:64-114](src/app/analysis/augment-analysis.ts#L64) — right down to the identical four-code halt list and the same `if (!x) continue` guard that can never fire. What got dropped in the copy is the per-item reason tracking, which is precisely the part that made the original honest.
**Why it matters:** Copy-paste concurrency means the next fix to the halt policy lands in one file and not the other. It already has: `augment-analysis` halts on `provider-timeout`, `provider-configuration`, `provider-routing`, and `provider-rejected`; `interpret-integrity` does not. Same failure, two behaviors.
**Fix:** Extract `runBounded<T>(items, concurrency, worker, signal)` into a shared module and have both lanes call it. Put the halt-code set in one exported constant next to `SKEPTIC_SERVICE_ERROR_CODES`.

*(For the record — the concurrency itself is **sound**. `const batch = eligible[cursor]; cursor += 1` has no `await` between read and increment, so on JS's single-threaded loop it's effectively atomic, and the same holds for `interpreted++`/`skipped++`/`duplicates++`/`findings.push`. No shared-counter race here.)*

### 🔵 Over-engineered / wrong shape

#### [src/integrations/model/proofline-skeptic.ts:153](src/integrations/model/proofline-skeptic.ts#L153) — the `CHANGED-LINES` pseudo-requirement is a hack, and it already bites
**What I see:** To reuse `/api/skeptic`, `interpret()` must fabricate a requirement the integrity prompt then throws away: `requirement: { id: 'CHANGED-LINES', title: batch.path, acceptanceCriteria: [] }`, `status: 'complete'`, `artifactRole: 'implementation'`. `requestSchema` ([skeptic-handler.ts:15-30](src/server/skeptic-handler.ts#L15)) demands all three unconditionally, and `status: 'complete'` is specifically chosen to dodge the `parsed.data.context.status === 'insufficient'` rejection at [line 217](src/server/skeptic-handler.ts#L217). `promptFor`'s integrity branch never reads `context.requirement`.
**Why it matters:** Two concrete bites already present, not hypothetical:
1. **The role is a lie for test files.** `isSourcePath` happily matches `foo.test.ts`, and every batch is labeled `artifactRole: 'implementation'` — while the integrity verdict set includes `vacuous-test`. You are telling the model "this is implementation code" and asking it "is this a vacuous test?"
2. **`sourceLine` must be positive.** [patch-lines.ts:10](src/app/analysis/patch-lines.ts#L10) emits `line: line.newLine ?? 0`, and the server's `sourceLine: z.number().int().positive()` rejects `0`. Any malformed patch that yields line 0 turns the whole batch into an opaque 400 counted as a silent skip.

Every future change to the requirement contract now has to keep a fake requirement working.
**Fix:** Make `requestSchema` a discriminated union on `mode` — integrity requests carry `{ mode: 'integrity', path, lines }` with no `requirement`/`status` — and pass the **real** artifact role (`isTestPath(batch.path) ? 'test-source' : 'implementation'`) so the verdict set and the prompt agree with reality.

#### [src/domain/integrity/interpreted-findings.ts:7](src/domain/integrity/interpreted-findings.ts#L7) + [skeptic-handler.ts:134](src/server/skeptic-handler.ts#L134) — two hardcoded copies of the closed verdict set, three of the reportable subset
**What I see:** `INTERPRETED_VERDICTS` is exported and consumed by nothing outside its own file (it only derives local types). The server re-declares the identical five strings as `INTEGRITY_VERDICTS`. The reportable subset is encoded a *third* time as the keys of the `COPY` table, and `isReportableVerdict` is implemented as `verdict in COPY` — so "is this verdict allowed" is silently coupled to "did someone write display copy for it."
**Why it matters:** The server enum drives guided decoding ([huggingface-client.ts:58](src/server/huggingface-client.ts#L58)), so if the two lists drift, the model is constrained to verdicts the client will silently discard at [interpret-integrity.ts:111](src/app/analysis/interpret-integrity.ts#L111) — no error, findings just stop appearing. Nothing tests that the lists match. `src/server/` is inside the `tsconfig.app.json` `include`, so importing the shared constant is entirely feasible (`interpreted-findings.ts` has only a type-only import, which erases — mind the `.js` suffix convention the handler uses).
**Fix:** Import `INTERPRETED_VERDICTS` in `skeptic-handler.ts` and delete `INTEGRITY_VERDICTS`. Type `COPY` as `Record<ReportableVerdict, ...>` (already done) but derive `isReportableVerdict` from an explicit `REPORTABLE_VERDICTS` array so a missing copy entry is a compile error, not a disappearing feature.

### ⚪ AI-tells / dead code

#### [src/domain/integrity/interpreted-findings.ts:18](src/domain/integrity/interpreted-findings.ts#L18) — `InterpretedNotAssessedReason` is declared and never used
**What I see:** A six-value union (`insufficient-context | secret-detected | limit-reached | cancelled | invalid-response | provider-error`) — a near-copy of the working `AdvisoryNotAssessedReason` — imported by nothing and constructed nowhere. The run object keeps three bare integers instead.
**Why it matters:** It makes the module *look* like it does per-batch reason tracking. It is the design that findings #3, #4 and #8 above are all asking for; it was declared and then never wired. Reviewers skim types and assume the behavior exists.
**Fix:** Either wire it (attach a reason to each skipped batch and render it, matching the sibling lane) or delete it. Do not leave a taxonomy standing in for the feature.

#### [src/app/analysis/interpret-integrity.ts:37](src/app/analysis/interpret-integrity.ts#L37) — `if (changed.change !== 'added') continue` can never be true
**What I see:** Both producers of `changedLines` — `changedLinesFromPatch` ([patch-lines.ts:8-12](src/app/analysis/patch-lines.ts#L8)) and the demo fixture — emit **only** `change: 'added'`. The filter is unreachable.
**Why it matters:** Harmless on its own, but it's the copied-defensiveness tell, and it makes the reader believe context/deleted lines are in play when the type is effectively a lie.
**Fix:** Drop it, or narrow the `ChangedLine` type on `AnalysisCase` so the compiler says what's true.

#### [src/app/analysis/interpret-integrity.ts:103](src/app/analysis/interpret-integrity.ts#L103) — `if (!batch) continue` is unreachable
**What I see:** Guarded by `while (cursor < eligible.length)` immediately above. Copied from `augment-analysis.ts:69`, where it's equally unreachable. It exists to appease `noUncheckedIndexedAccess`.
**Fix:** `const batch = eligible[cursor++]!` with a short comment, or keep it — but don't let it read as real error handling.

#### [src/app/analysis/interpret-integrity.test.ts:52](src/app/analysis/interpret-integrity.test.ts#L52) — the headline safety assertions cannot fail
**What I see:**
```ts
expect(after.integrity).toEqual(before.integrity)
expect(after.evidence.requirements[0]?.state).toBe(before.evidence.requirements[0]?.state)
```
`interpretIntegrity` returns `{ ...analysis, interpretedIntegrity: run }`. `after.integrity` **is** `before.integrity` — same object reference, by construction. This asserts that object spread works. The second line compares a value to itself, and would also pass as `undefined === undefined` on an empty requirements array.
**Why it matters:** This is a `vacuous-test` — the exact verdict this feature exists to detect, in the feature's own test file. The test named "reports an advisory finding without changing deterministic results" proves the first half and nothing of the second.
**Fix:** Snapshot `structuredClone(before.integrity)` before the call and compare against that, or (better) assert the function never *writes* by freezing the input: `Object.freeze(before.integrity.findings)`.

#### Test coverage stops at the one boundary that can actually break
**What I see:** `interpret-integrity.test.ts` is the only new test, and it stubs `IntegrityInterpreter` with `{ interpret: vi.fn() }`. Nothing anywhere tests:
- `ProoflineSkeptic.interpret()`'s synthesized payload against the real `requestSchema` — `skeptic-handler.test.ts` has **zero** references to `mode`, `integrity`, or `interpret`, and `proofline-skeptic.test.ts` has none either. The fabricated-requirement contract (finding above) is entirely unexercised.
- Batch boundaries — no test crosses 60 lines or 6,000 chars, which is why the empty-batch bug survived.
- The `maxHostedAssessments` truncation.
- Abort, or the halt-on-quota path.
- The new UI lane — `ReviewWorkspace.test.tsx` has no reference to `interpret` at all.

The mock's `response()` helper always returns `citedLineIds: [batch.lines[0].id]`, so the empty-citation path that defeats dedupe is never reached. `expect(after.interpretedIntegrity?.skipped).toBeGreaterThan(0)` is the weakest form of that assertion.
**Why it matters:** Six green tests that all describe a fake you wrote in the same file. The real risk in this feature is the client→server contract, and it has no test at all.
**Fix:** Add a handler test posting a payload produced by the actual `ProoflineSkeptic.interpret()` (inject a fake `chatClient`, assert 200 and that the prompt contains no requirement text); add a `buildIntegrityBatches` test at 61 lines and at 6,001 chars; add a `ReviewWorkspace` test that clicks the button with consent off/on.

#### Minor, no action needed
- Re-clicking "Interpret excerpts" replaces `interpretedIntegrity` wholesale and re-sends every batch — up to 20 more hosted calls against a 50/day per-client budget, with no resume and no "already ran" guard ([ReviewWorkspace.tsx:453-460](src/app/ReviewWorkspace.tsx#L453)). The requirement lane avoids this with `attemptedContextIds`. Worth a guard before the demo.
- No Cancel button for this lane, though the sibling has one at [line 354](src/app/ReviewWorkspace.tsx#L354); abort only happens via `reset()`. And since `interpretIntegrity` resolves normally on abort, `setCurrentAnalysis` still writes the empty run into state — the `if (!controller.signal.aborted)` guard at [line 197](src/app/ReviewWorkspace.tsx#L197) never fires because nothing throws.
- `global.css` is fine. `#7a6f57` / `#efe8db` are raw hex, but the file already uses one-off tints (`#e7dfd0`, `#9aa937`) for exactly this, so it matches the house pattern. Not a finding.
- Interpreted findings don't appear in any export — but neither do deterministic integrity findings (all three exporters serialize `currentAnalysis.evidence` only), so this is consistent, not a regression.

## What looks good

- **The safety posture is genuinely right.** `scanOutboundText` runs on the assembled batch text *before* the provider call, not after; the server validates the verdict against a closed set *and* checks every cited line ID against the submitted set; guided decoding constrains the verdict enum at the JSON-schema level. Three independent gates, none of them theater.
- **The advisory/deterministic separation holds in the code, not just the copy.** `interpretIntegrity` returns a new field and touches nothing else — no path exists by which a model verdict upgrades an evidence state. That's the product's whole integrity claim and the implementation actually honors it.
- **The prompt is unusually well-built.** `alreadyReportedByPatternRules` tells the model exactly which categories the deterministic scanner owns so it doesn't waste the call re-reporting TODOs, and `untrustedContentNotice` is present on both branches. That's real prompt engineering, not a wall of adjectives.
- **The concurrency is correct.** I went looking for a shared-counter race and there isn't one — the cursor read and increment are uninterrupted by `await`. Copied, but correct.
- **The dedupe test is a real test.** "drops a finding the deterministic scanner already reports" builds its case through `analyzeLocalBundle` and the actual scanner, asserts the scanner found the TODO first, then proves the interpreted duplicate was dropped. That one would fail if you broke it. Write more like it and fewer like line 52.
