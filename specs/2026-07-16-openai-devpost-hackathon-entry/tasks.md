# Implementation Tasks: Proofline

**Specification:** `spec.md`
**Project Standards:** Current `AGENTS.md` instructions supplied to the session; no repository `CLAUDE.md` or existing application patterns were found.

## Overview

Build a greenfield static React/TypeScript application with a framework-independent evidence engine, browser-side GitHub adapter, in-memory state, accessible review workspace, deterministic demo, and local report exports. Implement foundational contracts and tests before adapters and UI.

---

## Foundation and Architecture

### Files to Create

- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `eslint.config.js`
- `vitest.config.ts`
- `index.html`
- `src/main.tsx`
- `src/app/App.tsx`
- `src/config/limits.ts`
- `src/config/limits.test.ts`
- `docs/architecture.md`

### Tasks

- [ ] **Initialize the project and feature branch**
  - Create a Git repository if one is not present and work on `feature/BUILDWEEK-001-proofline`.
  - Scaffold Vite, React, and strict TypeScript without adding unreviewed runtime services.
- [ ] **Document the browser-only architecture**
  - File: `docs/architecture.md`
  - Define domain, GitHub adapter, parsers, in-memory orchestration, presentation, and export boundaries.
  - Record privacy boundaries, data flow, failure isolation, and deferred GitHub App/OAuth authentication.
- [ ] **Implement centralized operational limits**
  - File: `src/config/limits.ts`
  - Export a readonly validated configuration with defaults for 100 changed files, 6 candidate documents, 256 KB candidate size, and 5 MB local imports.
  - Ensure feature code consumes this object rather than duplicating numeric values.

**Tests**

- [ ] **Write configuration tests**
  - File: `src/config/limits.test.ts`
  - Cover defaults, valid overrides, invalid values, and stable user-facing limit descriptions.

**Success Criteria**

- The application builds and tests locally, architectural boundaries are documented, and limit values have one source of truth.

---

## Core Evidence Domain

### Files to Create

- `src/domain/evidence/types.ts`
- `src/domain/evidence/requirements-parser.ts`
- `src/domain/evidence/junit-parser.ts`
- `src/domain/evidence/association-engine.ts`
- `src/domain/evidence/state-derivation.ts`
- `src/domain/evidence/review-report.ts`
- `src/domain/evidence/*.test.ts`

### Tasks

- [ ] **Define evidence-domain contracts**
  - File: `src/domain/evidence/types.ts`
  - Model requirement provenance, source locations, code/test evidence, strong and suggested associations, and the five neutral evidence states.
- [ ] **Implement bounded Markdown requirement parsing**
  - File: `src/domain/evidence/requirements-parser.ts`
  - Extract stable requirement IDs and acceptance criteria while preserving exact source locations and provenance.
- [ ] **Implement bounded JUnit XML parsing**
  - File: `src/domain/evidence/junit-parser.ts`
  - Parse suites, cases, outcomes, requirement IDs in names/properties, malformed XML, and configured size limits without executing embedded content.
- [ ] **Implement deterministic evidence association**
  - File: `src/domain/evidence/association-engine.ts`
  - Produce strong associations only for exact requirement-ID matches.
  - Produce visibly suggested associations for normalized phrase or keyword overlap; never promote suggestions to strong evidence.
- [ ] **Implement neutral state derivation**
  - File: `src/domain/evidence/state-derivation.ts`
  - Derive `test-evidence-found`, `implementation-evidence-only`, `failing-test-evidence`, `no-evidence-found`, and `ambiguous-evidence` from explicit rules.
- [ ] **Implement report serialization**
  - File: `src/domain/evidence/review-report.ts`
  - Generate stable Markdown and versioned JSON representations with provenance, evidence, limitations, and no correctness claims.

**Tests**

- [ ] **Write evidence-domain unit tests**
  - Files: `src/domain/evidence/*.test.ts`
  - Cover valid, empty, malformed, conflicting, oversized, and adversarial inputs; verify identical inputs yield identical results.

**Success Criteria**

- Fixtures deterministically produce every evidence state, all associations explain their rule and location, and domain tests require neither React nor network access.

---

## GitHub and Input Integration

### Files to Create

- `src/integrations/github/client.ts`
- `src/integrations/github/change-url.ts`
- `src/integrations/github/issue-links.ts` (deferred; create only with the linked-issue retrieval flow)
- `src/integrations/github/document-discovery.ts`
- `src/integrations/github/types.ts`
- `src/integrations/github/*.test.ts`
- `src/integrations/local/file-import.ts`
- `src/integrations/local/file-import.test.ts`

### Tasks

- [x] **Implement canonical GitHub change URL validation**
  - File: `src/integrations/github/change-url.ts`
  - Accept public pull-request, commit, and `base...head` comparison URLs and reject ambiguous hosts, credentials, fragments, and unsupported forms.
- [x] **Implement the public GitHub REST client**
  - File: `src/integrations/github/client.ts`
  - Fetch PR metadata, files and patches, head SHA, repository tree, and available checks anonymously or through optional GitHub OAuth.
  - Handle pagination, unavailable/truncated patches, GitHub errors, rate limits, abort signals, configured file bounds, page-session caching, in-flight deduplication, and ETag revalidation.
- [ ] **Implement linked-issue recognition**
  - Deferred: create `src/integrations/github/issue-links.ts` only when the production linked-issue retrieval and confirmation flow is implemented; do not retain an uncalled parser.
  - Automatically recognize full GitHub issue URLs and case-insensitive `fixes`, `closes`, or `resolves` references.
  - Return bare `#123` mentions as confirmation-required candidates.
- [ ] **Implement explainable requirement-document discovery**
  - File: `src/integrations/github/document-discovery.ts`
  - Rank PR text, linked issues, and repository documents by path, filename, extension, size, and content signals.
  - Fetch at most 6 candidates no larger than 256 KB and return rank explanations and ambiguity states.
- [ ] **Implement bounded local file import**
  - File: `src/integrations/local/file-import.ts`
  - Accept supported specification, diff, and JUnit files up to 5 MB with file-type, decoding, and parser error handling.

**Tests**

- [ ] **Write integration-adapter tests with mocked fetch**
  - Files: `src/integrations/github/*.test.ts`, `src/integrations/local/file-import.test.ts`
  - Cover pagination, rate limiting, aborts, malformed payloads, linked-issue rules, ranking ties, bounds, and fallback guidance without contacting GitHub.

**Success Criteria**

- A public PR can be transformed into bounded domain inputs, every remote failure has an actionable local fallback, and tests make no live network calls.

---

## Implementation Integrity

### Files to Create

- `src/domain/integrity/types.ts`
- `src/domain/integrity/changed-line-scanner.ts`
- `src/domain/integrity/report-adapters.ts`
- `src/domain/integrity/*.test.ts`

### Tasks

- [ ] **Implement bounded changed-line integrity rules**
  - Detect explicit stub markers, unimplemented exceptions, empty handlers/catches, hardcoded mock responses, and production imports from mock/fixture paths.
  - Preserve file, changed line, matched text, confirmed/suspected classification, impact, and remediation.
- [ ] **Implement standard report adapters**
  - Normalize supported lint, coverage, dead-code, duplication, and complexity findings without recreating the underlying analyzers.
- [ ] **Integrate integrity evidence without changing traceability states**
  - Present integrity findings as a separate dimension and include them in Markdown/JSON exports.

**Tests**

- [ ] **Write detector and adapter tests**
  - Cover each positive rule, representative false positives, malformed reports, bounds, and stable output.

**Success Criteria**

- Every integrity signal is reproducible and evidence-backed, suspected findings are visibly distinct, and no heuristic changes a requirement evidence state.

---

## Application State and Demo Data

### Files to Create

- `src/app/analysis/analysis-controller.ts`
- `src/app/analysis/use-analysis.ts`
- `src/app/analysis/analysis-controller.test.ts`
- `src/demo/demo-fixture.ts`
- `src/demo/fixtures/*`
- `src/demo/demo-fixture.test.ts`

### Tasks

- [ ] **Implement the in-memory analysis workflow**
  - Files: `src/app/analysis/analysis-controller.ts`, `src/app/analysis/use-analysis.ts`
  - Orchestrate imports, candidate confirmation, parsing, analysis, cancellation, reset, and errors without browser or server persistence.
- [ ] **Create the synthetic demonstration fixture**
  - Files: `src/demo/fixtures/*`, `src/demo/demo-fixture.ts`
  - Include representative PR data with test evidence found, implementation evidence only, failing or missing evidence, and ambiguous suggested evidence.
  - Label all sample content clearly and make the demo independent of GitHub.

**Tests**

- [ ] **Write orchestration and demo contract tests**
  - Verify transitions, reset behavior, refresh-safe non-persistence, cancellation, deterministic results, and coverage of the intended 90-second reveal.

**Success Criteria**

- The bundled demo reaches the evidence matrix in one action, covers all important states, and no imported content is persisted or logged.

---

## UI and Accessibility

### Files to Create

- `src/app/routes/LandingPage.tsx`
- `src/app/routes/ReviewPage.tsx`
- `src/components/import/PrImportForm.tsx`
- `src/components/import/RequirementSourcePicker.tsx`
- `src/components/evidence/EvidenceMatrix.tsx`
- `src/components/evidence/EvidenceDetail.tsx`
- `src/components/evidence/EvidenceStateBadge.tsx`
- `src/components/report/ExportControls.tsx`
- `src/components/feedback/AnalysisStatus.tsx`
- `src/styles/*`
- `src/**/*.test.tsx`

### Tasks

- [ ] **Implement the landing and import experience**
  - Make **Analyze a GitHub change** the primary action and **Try the demo** equally discoverable.
  - Provide local import fallback, validation, rate-limit guidance, and clear privacy messaging.
- [ ] **Implement requirement-source confirmation**
  - Show candidate rank, provenance, and selection rationale; require explicit choice for ambiguity and bare issue mentions.
- [ ] **Implement the review workspace**
  - Display PR identity, filters, evidence matrix, neutral state labels, and selected requirement details with exact patches, tests, provenance, and association rationale.
- [ ] **Implement local report downloads**
  - File: `src/components/report/ExportControls.tsx`
  - Create Markdown and JSON downloads using browser-generated blobs without uploading or persisting content.
- [ ] **Implement accessible responsive presentation**
  - Meet WCAG 2.2 AA fundamentals for keyboard flow, visible focus, semantics, labels, contrast, status announcements, and non-color state cues.
  - Support the primary workflow on common desktop and mobile viewport widths.

**Tests**

- [ ] **Write component and accessibility tests**
  - Cover keyboard operation, labels, focus, status announcements, error recovery, state filtering, source selection, and export controls.

**Success Criteria**

- The complete workflow is keyboard-operable, states are understandable without color, exports work locally, and the demo's primary reveal fits within 90 seconds.

---

## Delivery, QA, and Submission

### Files to Create

- `README.md`
- `LICENSE`
- `vercel.json` (only if routing requires it)
- `.github/workflows/ci.yml`
- `docs/demo-script.md`
- `docs/codex-build-log.md`

### Tasks

- [ ] **Configure continuous verification**
  - File: `.github/workflows/ci.yml`
  - Run formatting/linting, type checks, unit/component tests, and production build on pushes and pull requests.
- [ ] **Write complete judge-facing documentation**
  - File: `README.md`
  - Document setup, architecture, inputs, limits/configuration, privacy, evidence semantics, demo path, Codex/GPT-5.6 usage, and private-repository authentication as a future GitHub App/OAuth enhancement.
- [ ] **Document Codex-assisted decisions**
  - File: `docs/codex-build-log.md`
  - Record where Codex accelerated work and which scope, architecture, evidence, privacy, and safety decisions remained human-directed.
- [ ] **Prepare and rehearse the submission demo**
  - File: `docs/demo-script.md`
  - Script a public narrated video under three minutes and retrieve the required `/feedback` session ID.
- [ ] **Deploy and run final QA**
  - Deploy the static application to Vercel, verify the public demo and repository instructions, test a supported public PR, run accessibility and responsive checks, and confirm no sensitive content appears in logs or artifacts.

**Tests**

- [ ] **Run the complete release verification suite**
  - Confirm clean install, lint, type check, unit/component tests, production build, hosted smoke test, demo reset, both exports, GitHub failure fallbacks, and README instructions.

**Success Criteria**

- Judges can open the hosted app, run the bundled demo without credentials, analyze a supported public PR, inspect transparent evidence, and reproduce the build from the public repository.

---

## Summary

| Layer | Implementation Tasks | Test Tasks |
|---|---:|---:|
| Foundation and Architecture | 3 | 1 |
| Core Evidence Domain | 6 | 1 |
| GitHub and Input Integration | 5 | 1 |
| Implementation Integrity | 3 | 1 |
| Application State and Demo | 2 | 1 |
| UI and Accessibility | 5 | 1 |
| Delivery, QA, and Submission | 5 | 1 |
| **Total** | **29** | **7** |

---

## Parallel Implementation with Agent Teams

If explicitly requested, independent task groups can be implemented in parallel after domain contracts are stable:

1. Core evidence-domain implementation
2. GitHub and local-input adapters
3. UI components against agreed domain fixtures
4. Testing and accessibility verification

Keep architecture, configuration, and final integration under one owner to prevent contract drift. Human PR review remains required before merge.
