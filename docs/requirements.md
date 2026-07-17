# Proofline Requirements (Example for Testing)

Stable-ID requirements for Proofline. Each requirement uses an identifier (`PL-###`)
that Proofline's own parser recognizes, followed by acceptance-criteria bullets. This
file is intentionally written in the format the tool ingests, so Proofline can analyze
its own change set.

Requirement states referenced below: **test evidence found**, **implementation evidence
only**, **failing test evidence**, **no evidence found**, and **ambiguous evidence**.

## Sources and ingestion

## PL-101: Analyze a public GitHub change as the primary action
- The landing page leads with analyzing a public GitHub change.
- A single URL field accepts the change and starts analysis on submit.
- Analysis in progress is announced to assistive technology.

## PL-102: Accept pull-request, commit, and comparison URLs
- Canonical public pull-request URLs are accepted.
- Single-commit URLs are accepted.
- `base...head` comparison URLs are accepted.
- Changed files, patches, head commit, and available check results are retrieved.

## PL-103: Support optional GitHub authentication without personal tokens
- Public reads work anonymously within GitHub's unauthenticated rate limit.
- Optional Supabase-managed GitHub OAuth raises the authenticated allowance.
- A personal access token is never requested, pasted, or stored.

## PL-104: Import local evidence in memory
- Accept Markdown or text requirements, a unified diff or patch, and JUnit-style XML.
- Imported files are analyzed without leaving the browser.
- An import above the configured size limit fails with specific guidance.

## PL-105: Provide a preloaded synthetic demo path
- A one-action demo reaches the core evidence result without any network call.
- The demo uses synthetic requirements and a synthetic change set only.
- The demo reaches the core result in under ninety seconds.

## Requirement discovery

## PL-201: Discover requirement documents without a required repository layout
- Candidate documents are found without users adopting a Proofline-specific structure.
- Candidates are ranked by explainable path, filename, size, and content signals.

## PL-202: Treat descriptions and linked issues as requirement sources
- The pull-request description or commit message is considered a requirement source.
- Full GitHub issue URLs and `fixes`, `closes`, or `resolves` references are treated as linked sources.
- Bare `#123`-style mentions require confirmation before use.

## PL-203: Bound discovery with centralized limits
- Operational limits live in one typed, validated configuration module.
- Defaults are 100 changed files, 20 candidate documents, 256 KB per candidate, and 5 MB per local import.
- Exceeding a limit stops safely, names the limit, and points to the local-import fallback.

## PL-204: Extract stable requirement identifiers
- Stable IDs are extracted from requirement documents while retaining source lines.
- Adjacent acceptance-criteria bullets are captured with each requirement.

## PL-205: Fall back to author-declared change claims when no IDs exist
- When no source-authored stable IDs exist, a bounded set of author-declared change claims is extracted.
- Generated claim IDs are shown as labels only.
- A generated ID never creates strong evidence.

## Evidence and association

## PL-301: Associate evidence with deterministic, explainable rules
- An exact stable-ID match in a diff, file, test name, or result is treated as strong evidence.
- Phrase and keyword similarity is treated only as a suggested association.
- Every association records its rule, strength, and provenance.

## PL-302: Assign neutral evidence states
- Each requirement receives exactly one state from the five defined states.
- States are derived from explicit association and test-outcome rules, not opaque scoring.
- Evidence states do not rely on color alone to be understood.

## PL-303: Never promote suggestions into verified evidence
- A suggested association cannot independently produce the test-evidence-found state.
- Strong and suggested associations are displayed separately.

## PL-304: Let a reviewer inspect exact supporting evidence
- Selecting a requirement reveals the exact artifacts, rules, and matched text behind its state.
- Requirements with missing or contradictory evidence are visible, not hidden.

## PL-305: Present an interactive evidence graph
- An interactive requirement-to-code-to-test graph or matrix is displayed.
- The graph reflects the same states shown in the requirement list.

## Implementation integrity

## PL-401: Scan changed lines for bounded integrity signals
- Only added or changed lines are scanned.
- Signals include explicit stubs, empty handlers or catches, mock or fixture leakage, and placeholder behavior.
- Findings describe observed syntax, not intent or correctness.

## PL-402: Keep integrity findings separate from traceability
- Integrity findings are reported apart from requirement traceability.
- Each finding names the file, line, impact, and a remediation step.

## Reporting and export

## PL-501: Export the analysis on explicit user action
- The analysis exports as a human-readable Markdown report.
- The analysis exports as a machine-readable JSON evidence record.
- Exports are initiated only by an explicit user download.

## PL-502: Summarize gaps for review
- The report surfaces uncovered requirements and failing checks.
- The report repeats the disclaimer that evidence is not proof of correctness.

## Privacy, security, and quality

## PL-601: Keep all data in memory only
- Imported source and analysis data stay in page memory.
- Refreshing or closing the page clears everything.
- No localStorage, IndexedDB, cookies, or server storage is used for imported data.

## PL-602: Run without paid inference
- The tool runs without an OpenAI API key.
- No paid runtime model inference is required to analyze a change.
- Any future model-assisted explanation sits behind a replaceable provider boundary and is not part of the MVP.

## PL-603: Never claim correctness
- The interface never presents detected evidence as proof of correctness, security, or merge readiness.
- Human review remains the stated decision boundary.

## PL-604: Meet WCAG 2.2 AA fundamentals
- The primary flow is fully keyboard operable with visible focus.
- Structure is semantic and controls are programmatically labeled.
- Contrast is sufficient and state is never conveyed by color alone.

## PL-605: Test new logic and document public methods
- All new analyzer logic has unit tests that run without the UI.
- Public methods carry documentation.
- No dependency is added without explicit review.
