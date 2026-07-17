# Specification: Proofline

## Goal

Give software reviewers a fast, transparent way to determine whether a GitHub code change satisfies its written requirements and has credible test evidence, without trusting an opaque AI summary or sending private code to a model provider.

## User Stories

- As a code reviewer, I want to trace each requirement to exact code and test evidence before or after a pull request exists so that I can focus review time on unproven behavior.
- As an engineering lead, I want missing and contradictory evidence surfaced clearly so that agent-generated changes are not accepted merely because they look complete.
- As a judge evaluating the project, I want a preloaded end-to-end example so that I can understand and test the core value in under 90 seconds.

## Specific Requirements

### Public GitHub Change Import

- Make **Analyze a GitHub change** the primary landing-page action.
- Accept canonical public GitHub pull-request, single-commit, and `base...head` comparison URLs in the MVP.
- Retrieve change metadata, head SHA, changed files and patches, and available head check results through GitHub's REST API.
- Perform requests directly from the browser and do not proxy repository content through an application server.
- Never request, accept, log, or store a GitHub personal access token.
- Display actionable states for invalid URLs, missing PRs, unavailable patches, network failures, and rate limiting.
- Cache the active analysis in page memory only to avoid unnecessary repeat requests during the current session.
- Cache fresh GitHub responses in page memory, deduplicate identical in-flight requests, and revalidate stale cached responses with ETags.
- Provide local import and the bundled demo whenever GitHub import cannot complete.

### Specification and Evidence Inputs

- Accept a Markdown specification containing stable requirement IDs such as `REQ-001`.
- Do not require a Proofline-specific directory, filename, or repository restructuring.
- Retrieve the repository tree and rank likely requirement documents using explainable signals from paths, filenames, extensions, file sizes, and document contents.
- Include an available pull-request description or commit message and explicitly linked GitHub issues in the candidate set.
- Automatically include full GitHub issue URLs and case-insensitive `fixes`, `closes`, or `resolves` issue references found in available change text.
- Present bare `#123`-style issue mentions as suggested candidates and fetch them only after user confirmation.
- Recognize common names and locations such as specifications, requirements, PRDs, RFCs, stories, acceptance criteria, issues, and planning or documentation directories without limiting discovery to that vocabulary.
- Fetch only a bounded set of small, high-ranking text candidates to respect GitHub API limits and browser resources.
- Fetch candidates progressively by path-ranking tier and stop after a tier produces a uniquely ranked document with stable requirement IDs.
- Inspect at most 20 candidate requirement documents and fetch only text candidates no larger than 256 KB each by default.
- Show the selected source and why it was selected; when confidence is insufficient or multiple candidates are plausible, require the user to choose.
- Preserve and display whether each requirement came from a PR description, linked issue, repository document, pasted text, or uploaded file.
- Allow users to override discovery by selecting a repository file, pasting requirements, or uploading a local document.
- Accept JUnit-compatible XML test results through local file import.
- Treat GitHub check conclusions as execution evidence but not as proof that a specific requirement is covered.
- Bundle a synthetic PR, specification, source changes, and test results for a deterministic demonstration.
- Keep all imported content and analysis state in page memory only; refresh or page closure clears it.

### Deterministic Evidence Analyzer

- Implement the analyzer as framework-independent TypeScript functions.
- Extract requirement IDs and acceptance-criteria phrases from the specification.
- Associate requirements with files, patches, test names, and test results using documented, inspectable rules.
- Classify an exact stable requirement-ID match in a diff, source file, test name, or test result as a `strong` association.
- Classify normalized acceptance-criteria phrase or keyword overlap as a `suggested` association.
- Never promote a `suggested` association to `strong`, regardless of the number of overlapping terms.
- Require strong implementation and strong passing-test associations before producing `test-evidence-found`; suggested associations may only add context or yield `ambiguous-evidence`.
- When no source-authored stable IDs are discoverable, extract up to 12 author-declared change bullets or commit subjects as generated `CLAIM-nnn` labels. Present them as claims rather than formal requirements and prohibit generated identifiers from producing strong associations.
- Record the rule, matched text, source location, and association strength behind every association.
- Never label heuristic association as proof of correctness.
- Return stable results for identical inputs.
- Unit test parsing, association, state derivation, and error cases.

### Implementation Integrity

- Scan changed lines for a bounded set of high-confidence implementation-integrity signals, including explicit TODO/FIXME markers, unimplemented exceptions, empty handlers or catches, hardcoded mock responses, and production imports from mock or fixture paths.
- Classify each integrity finding as `confirmed` or `suspected`; never infer developer intent without direct evidence.
- Show exact file, changed line, matched text, detection rule, impact, and remediation guidance.
- Keep integrity findings separate from requirement evidence states so a heuristic cannot change traceability conclusions.
- Accept optional standard report inputs for lint, coverage, dead-code, duplication, and complexity evidence rather than recreating mature analyzers.
- Treat “an existing utility or dependency should have been used” as a finding only when the repository or dependency manifest provides concrete evidence.
- Include at least one intentional integrity finding in the synthetic demo and clearly label all demo findings.
- Unit test every detector with positive and false-positive fixtures.

### Evidence States

- Represent each requirement internally as `test-evidence-found`, `implementation-evidence-only`, `failing-test-evidence`, `no-evidence-found`, or `ambiguous-evidence`.
- Display **Test evidence found** when implementation signals and passing requirement-linked test evidence both exist; this does not assert correctness.
- Display **Implementation evidence only** when code evidence exists without linked passing tests.
- Display **Failing test evidence** when linked execution evidence fails, **No evidence found** when no association exists, and **Ambiguous evidence** when signals conflict.
- Show concise explanations and exact evidence for every state.
- Present aggregate counts as review signals, not a quality score or merge recommendation.

### Review Workspace

- Display PR identity and analysis status before the evidence results.
- Provide a scannable requirement matrix as the main results view.
- Let users filter by evidence state and select a requirement for detail.
- Show linked code patches, tests, check status, provenance, and association rationale in the detail view.
- Visually distinguish verified evidence from heuristic signals and missing information.
- Generate a concise review brief listing uncovered requirements, failures, ambiguity, and evidence references.
- Let the user explicitly download a human-readable Markdown review report suitable for committing to a repository.
- Let the user explicitly download a machine-readable JSON evidence record with source provenance and analyzer results.
- Do not include a general-purpose chat interface.
- Support complete keyboard operation, visible focus, semantic landmarks and headings, programmatically labeled controls, and sufficient WCAG 2.2 AA contrast.
- Communicate every evidence state with text and/or iconography in addition to color.

### Demonstration Experience

- Offer **Try the demo** beside the GitHub change input with no setup required.
- Use a synthetic feature whose PR intentionally includes one verified requirement, one untested implementation, and one missing or failing requirement.
- Reach the evidence matrix within one interaction and the primary reveal within 90 seconds.
- Keep the demo deterministic and independent of GitHub or other network availability.
- Include clear reset and sample-data identification controls.
- Support a narrated Devpost video under three minutes covering the problem, reveal, implementation, and Codex/GPT-5.6 usage.

### Privacy, Security, and Reliability

- Process repository and uploaded data locally in the browser.
- Do not persist imported source or analysis content in localStorage, IndexedDB, cookies, a database, logs, analytics, or any server.
- Treat report export as an explicit user action and create downloads locally in the browser.
- Render Markdown and code as untrusted content and prevent script execution.
- Validate URL structure, file type, file size, and parser bounds before analysis.
- Analyze at most 100 changed PR files and accept local imports no larger than 5 MB by default.
- Stop safely when a limit is exceeded, state the configured limit, and direct the user to a viable local-import fallback.
- Avoid logging imported content, repository contents, user identifiers, or secrets.
- Use parameterized statements if storage is introduced later; no database is required for this MVP.
- Document that Proofline supplies review evidence and does not prove correctness, security, or production readiness.

### Delivery and Documentation

- Build as a static React/TypeScript application using Vite and deploy on Vercel.
- Keep the evidence engine separate from GitHub and UI adapters.
- Define all operational limits in one exported, typed, validated configuration module consumed by both the evidence engine and UI; do not duplicate numeric limits in feature code.
- Document every configuration value and cover default and overridden limits with unit tests.
- Document all public methods and cover new logic with unit tests.
- Add no dependency without explicit review.
- Include setup, test, build, architecture, supported inputs, privacy behavior, and demo instructions in the README.
- Explain where Codex accelerated development, where human decisions were made, and how GPT-5.6 and Codex were used.
- Provide a public repository with an appropriate open-source license for judging.

## Existing Code to Leverage

No existing application code or reusable project patterns were found. This is a greenfield implementation.

## Out of Scope

- Private repositories, GitHub OAuth, and GitHub App installation are deferred to a post-hackathon iteration; document them as a stretch goal rather than implemented functionality.
- Personal access tokens are not an accepted authentication mechanism, including in future-facing MVP documentation.
- GitLab, Bitbucket, Azure DevOps, and organization-wide integrations.
- Automated code changes, review comments, merge actions, or policy enforcement.
- Generic AI code review, chat, summarization, and paid model inference; Implementation Integrity remains a bounded, evidence-based changed-line analysis rather than an open-ended review assistant.
- Claims of formal verification, correctness, security certification, or production readiness.
- Full semantic understanding of arbitrary natural-language specifications.
- Healthcare, pharmacy, EMR, FHIR, PHI, or clinical workflows.
- Persistent accounts, teams, databases, analytics, and billing.
- Saved analyses and automatic report commits; opt-in persistence is deferred to a later iteration.
- Mobile-native applications and browser extensions.
- Production-scale handling of very large pull requests, commits, or comparisons.
