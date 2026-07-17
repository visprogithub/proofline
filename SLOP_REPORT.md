# Skeptic Engineer Report

**Scope:** Entire current `src/` tree, with focused follow-up on GitHub PR/commit/compare analysis
**Reviewed:** 48 source and test files
**Verdict:** The expanded GitHub path is real, bounded, and connected to the UI; no confirmed or suspected AI-slop findings remain after remediation.

## Summary

| Category | Confirmed | Suspected |
|---|---:|---:|
| Fake / stubbed | 0 | 0 |
| Reinvented wheel | 0 | 0 |
| Over-engineered | 0 | 0 |
| AI-tells / dead code | 0 | 0 |

## Findings

### Fake / stubbed functionality

No remaining findings.

- Pull-request, commit, and comparison URLs route from the production form through real GitHub REST reads, repository discovery, evidence association, state derivation, and integrity scanning.
- Mocked integration tests cover all three GitHub change types, while a headless-browser live check exercised `https://github.com/ryokun6/ryos/pull/1874` against GitHub itself.
- Ordinary changes without stable IDs now use a visibly labeled declared-claims mode rather than failing or fabricating formal requirements. Generated claim identifiers are explicitly barred from strong association.
- The synthetic dossier remains visibly labeled and runs through the production evidence domains.

### Reinvented wheels

No remaining findings. URL decomposition uses the platform `URL` parser before applying product-specific canonical-path rules. HTTP responses use Zod validation, XML uses `fast-xml-parser`, and the custom code is limited to Proofline-specific normalization and evidence logic.

### Over-engineered logic

No remaining findings. Five unused planning-stage packages and the no-op query provider were removed. The GitHub adapter uses one discriminated change identity rather than three duplicate analysis pipelines.

### AI-tells / dead code

No remaining findings. The obsolete PR-only parser, PR-only result fields, unused branch metadata, and unused generic changed-file count were removed. Commit pagination follows the configured bound instead of containing a fixed two-page branch.

## Verified intentional fixtures

`src/demo/demo-fixture.ts` contains explicit `TODO` and `mockResponse` strings intentionally. They are inert synthetic changed-line inputs used to demonstrate the integrity scanner, are visibly labeled as synthetic in the UI, and do not execute as production response logic.

## What looks good

- A regression test enforces the native browser `fetch` receiver, covering the exact failure discovered through the live PR.
- Exact stable requirement IDs remain the only path to strong evidence; phrase overlap stays a visible suggestion.
- Input limits, rate-limit errors, no-requirement outcomes, and ambiguous document selection fail visibly rather than silently widening scope or inventing results.
