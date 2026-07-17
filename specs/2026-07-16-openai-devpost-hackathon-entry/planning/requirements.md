# Requirements: OpenAI Devpost Hackathon Entry

## Initial Description

Determine what to build for OpenAI Build Week through a spec-driven development workflow, ensure the project meets the hackathon requirements and judging criteria, architecture the solution, implement and test it, and prepare it for Devpost submission.

## Requirements Discussion

### Questions & Answers

**Q1: Problem and scope: What real problems or workflows do you understand unusually well? Name up to three. What outcome could a working demo prove in under three minutes?**

**A:** The areas most relevant to this project — up to three:

1. Working with AI coding agents and AI tooling day to day, including where an agent's output looks finished but leaves requirements unproven, tests disconnected, or placeholder code behind.
2. Reviewing code changes for whether they actually meet their stated requirements — requirement-to-implementation-to-test traceability.
3. Automation and cloud-based development workflows.

(Other areas of personal knowledge were raised but are not relevant to a developer tool and are intentionally omitted.)

What a working demo could prove in under three minutes: that a code change can be turned, deterministically and in the browser, into an honest evidence map — which requirements have strong exact-ID code and passing-test evidence versus implementation-only, failing, or unproven ones — while separately flagging implementation shortcuts such as stubs, mock responses, and empty handlers, and visibly refusing to promote fuzzy text matches into confident results. In short: that the tool is real and that it knows what it does not know.

**Q2: Users: Who should benefit? Do you have access to representative users for quick feedback?**

**A:** "I don't know. Not really other than my fiance, or my friend who is a recruiter, or maybe my coworker who works in the same domain as me."

**Q3: What domains, technologies, datasets, professional experience, or existing work can we leverage? What do you want to learn or showcase?**

**A:** "the above as well as react, angular, .net, 15+ years professional software engineering experience mostly in the healthcare space, ui web design nano degree from udacity, cpmai cert from pmi, bachelor's in computer science and am now a software engineering manager overseeing a team of jr and mid level devs as well as integration engineer and working with vps and c suties also experience giving presentations and teaching about ai and ai tooling and ai workflows etc."

**Q4: What are the build constraints?**

**A:** "solo but honestly with coding agent I'm not super worried about time. I am for as free as possible. Usually using things like vercel etc or render.com I have some credits on modal and huggingface."

**Q5: What data may the project use? Can the demo use synthetic/sample data?**

**A:** "sure synthetic and sample or kaggle data or hugging face data sets etc I don't care"

**Q6: Must it use AWS Bedrock, may it call OpenAI directly, and what stack or integrations are preferred?**

**A:** "why would it use aws? I use aws professionally but don't have an accoutn for personal use. Are we using a project with ai is that one of the stipulations? or does it just need to use gpt 5.6 to build with? would incorporating ai be more impressive?"

**Q7: Should the project target healthcare, and what healthcare safety controls apply?**

**A:** "I'd rather not healthcare is just what I do professionally between this and the aws line I probably just need to update my agent.md since it's a direct copy of my work one whoops."

**Q8: What is out of scope, and what existing code should be reused?**

**A:** No exclusions or reusable code paths were supplied.

**Follow-up: Which direction and presentation strategy should be selected?**

**A:** The user delegated the decision after requesting research into overused hackathon concepts and patterns that impress judges. The user does not have OpenAI API credits and wants to avoid paid runtime inference.

### Existing Code to Reference

- No existing application code or reusable feature paths were identified.
- `answers.md` was open in the IDE, but its saved workspace copy contained no text when inspected.

## Visual Assets

- No visual assets were found. The directory contains only `.gitkeep`.

## Requirements Summary

### Recommended Product Direction

Build a developer tool, provisionally referred to as **Proofline**, that creates an evidence map from a feature specification, repository diff, and test results. It must let a reviewer trace each requirement to concrete implementation and verification evidence and clearly expose requirements with missing or contradictory evidence.

The product name is deliberately provisional. The hackathon guidance recommends that the entrant personally choose and edit the final name and submission narrative.

### Functional Requirements

- Make **Analyze a GitHub change** the primary landing-page action.
- Accept canonical public GitHub pull-request, single-commit, and comparison URLs and retrieve their metadata, changed files, patches, head commit, and available check results anonymously or through optional Supabase-managed GitHub OAuth.
- Discover likely requirement documents without requiring users to adopt a Proofline-specific repository structure.
- Consider the pull-request description or commit message and linked GitHub issues as requirement-source candidates alongside repository documents.
- Automatically treat full GitHub issue URLs and `fixes`, `closes`, or `resolves` references as linked requirement-source candidates; require confirmation for bare `#123`-style mentions.
- Support explicit paste/upload and manual repository-file selection when automatic discovery is uncertain.
- Import a git diff or analyze a bundled sample repository/change set.
- ingest structured test results from at least one common test format.
- Extract stable requirement identifiers from the specification.
- Associate requirements with changed files, symbols, commits or diff hunks, and tests using deterministic signals first.
- Display an interactive requirement-to-code-to-test evidence graph or matrix.
- Assign neutral evidence states: test evidence found, implementation evidence only, failing test evidence, no evidence found, and ambiguous evidence.
- When no source-authored stable IDs exist, extract a bounded set of author-declared change bullets or commit subjects as visibly generated claim labels; never allow generated IDs to create strong evidence.
- Let a reviewer select one requirement and inspect exact supporting evidence.
- Produce a concise review brief containing uncovered requirements and failed checks.
- Export the analysis as a human-readable Markdown report and a machine-readable JSON evidence record through explicit user downloads.
- Analyze changed lines for bounded implementation-integrity signals such as explicit stubs, empty handlers/catches, mock leakage, and placeholder behavior.
- Keep confirmed and suspected integrity findings separate from requirement traceability and provide exact evidence plus remediation.
- Accept optional mature-tool reports for lint, coverage, dead code, duplication, and complexity rather than reimplementing those analyzers.
- Include a polished, preloaded demonstration path that reaches the core result in under 90 seconds.
- Run without an OpenAI API key or paid inference.
- Allow future optional model-assisted explanation behind a replaceable provider boundary, but do not make it part of the MVP.

### Non-Functional Requirements

- Use no real or proprietary source code in the public demo; ship a synthetic sample repository and spec.
- Be runnable by judges through a hosted demo or a simple local setup.
- Keep analysis transparent and inspectable; never present detected evidence as proof of correctness.
- Keep imported source and analysis data in memory only; refreshing or closing the page clears it.
- Favor a complete vertical slice and polished UX over broad repository-host integrations.
- Include unit tests for all new logic and documentation for public methods.
- Add no dependencies without explicit review.
- Do not require a database for the MVP unless the formal architecture demonstrates a clear need.
- Keep deployment within free-tier constraints where practical.
- Meet WCAG 2.2 AA fundamentals: keyboard operation, visible focus, semantic structure, programmatic labels, sufficient contrast, and evidence states that do not rely on color alone.

### Healthcare & Compliance

- PHI handling: No. Healthcare is explicitly excluded.
- Audit trail: A product-level evidence trail is central, but it is not a regulated healthcare audit trail.
- Clinical safety: Not applicable.
- HIPAA implications: None expected because the project must not process healthcare or patient data.

### Scope Boundaries

**In Scope:**

- Developer Tools track.
- Spec-to-code-to-test traceability for one repository/change set.
- Deterministic evidence extraction and transparent scoring.
- A synthetic, visually compelling demo scenario.
- Documentation of how Codex and GPT-5.6 accelerated development and key decisions.

**Out of Scope:**

- Healthcare, pharmacy, EMR, FHIR, PHI, and clinical use cases.
- Generic conversational coding assistant or generic AI code reviewer.
- Automated code modification or autonomous merging.
- Claims that the tool proves correctness, security, or production readiness.
- GitHub/GitLab application installation, organization-wide rollout, and enterprise authentication in the MVP.
- Paid model inference as a runtime dependency.
- Resume analysis, interview coaching, generic summarization, and general-purpose chat.

**Deferred / Stretch Goal:**

- Private-repository support through a GitHub App or OAuth flow is a post-hackathon iteration. The MVP must not accept personal access tokens or imply that private-repository authentication is implemented.

### Technical Considerations

- Use a static React/TypeScript application deployed to Vercel; analysis runs in the browser with no application backend or database.
- Use GitHub's REST API for public pull-request, commit, and comparison data. Handle its anonymous rate limit explicitly, support optional Supabase-managed GitHub OAuth for authenticated public reads, and never request or store a personal access token.
- Keep local file import and a bundled demonstration as fallbacks when GitHub is unavailable or rate limited.
- Do not use localStorage, IndexedDB, cookies, or server storage for imported source or analysis data in the MVP.
- Document opt-in saved analyses as a future enhancement; exported reports can be committed to a repository by the user.
- Prefer standardized inputs such as Markdown requirements, unified diff, and JUnit-style test results.
- Retrieve the repository tree once, rank plausible requirement documents using explainable path, filename, size, and content signals, and fetch only a bounded candidate set to conserve GitHub API requests.
- Inspect candidates progressively by path-score tier, stopping when a tier yields a uniquely ranked document with stable requirement IDs.
- Keep completed analyses and fresh GitHub responses in page memory, deduplicate matching in-flight requests, and use ETag revalidation for stale responses.
- Centralize operational limits in one typed, validated configuration module; analyzer and UI code must not duplicate limit values.
- Default to 100 changed PR files, 6 requirement-document candidates, 256 KB per fetched candidate document, and 5 MB per local import.
- When an input exceeds a limit, stop safely, identify the limit, and direct the user to an applicable local-import fallback.
- Preserve source provenance across PR descriptions, linked issues, repository documents, pasted text, and uploaded files.
- Treat evidence association as explainable rules with confidence and provenance, not opaque certainty.
- Treat an exact stable requirement-ID match in a diff, file, test name, or test result as strong evidence.
- Treat phrase and keyword similarity only as a suggested association; suggested associations cannot independently produce the `test-evidence-found` state.
- Design the core analyzer as framework-independent functions so it can be unit tested without the UI.
- Preserve an optional provider interface for future local/open-weight or hosted model augmentation.
- Document private GitHub repository authentication as a future enhancement using a least-privilege GitHub App or OAuth design.
- The current repository-level instructions remain authoritative until the user explicitly replaces them.

## Hackathon Fit and Research Basis

- Official OpenAI Build Week requirements call for a working project built with Codex using GPT-5.6, a category, description, public narrated video under three minutes, repository and README, and a Codex `/feedback` session ID. They do not explicitly require runtime OpenAI API inference.
- Official judging criteria are Technological Implementation, Design, Potential Impact, and Quality of the Idea.
- Devpost's judge interviews emphasize requirement compliance, runnable software, balanced judging criteria, storytelling, visible technical substance, originality, and a finished product.
- Recent Devpost search results show many AI interview coaches and AI code-review assistants, supporting exclusion of those saturated concepts.
- JetBrains' June 2026 judging guidance recommends one narrow end-to-end flow and one clear "this is possible now" moment.
- OpenAI documents ChatGPT subscriptions and API billing as separate; a ChatGPT subscription should not be treated as API credit.

### Research Sources

- https://openai.devpost.com/
- https://openai.devpost.com/rules
- https://info.devpost.com/blog/hackathon-judging-tips
- https://blog.jetbrains.com/ai/2026/06/how-to-win-a-hackathon-notes-from-the-judging-table/
- https://help.openai.com/en/articles/8156019-is-api-usage-included-in-chatgpt-subscriptions-even-if-i-have-a-paid-chatgpt-account
