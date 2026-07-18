# Proofline

**Trace requirements to working code—and flag implementation shortcuts before they reach review.**

Proofline is a browser-first developer tool for reviewing a public GitHub pull request, single commit, comparison, or local evidence bundle. It discovers likely requirement documents, maps stable requirement IDs to changed code and test results, and separately identifies implementation-integrity risks such as stubs, placeholder handlers, and production mock responses. Deterministic analysis runs in the browser; the optional AI skeptic uses a quota-protected server endpoint.

The project targets the Developer Tools track of OpenAI Build Week. It was designed and implemented through a spec-driven Codex workflow. The final submission must include the actual Codex `/feedback` session ID and must verify that the session used GPT-5.6; this repository does not attempt to infer or fabricate that client-side model setting.

## Why it exists

Coding agents can produce a convincing diff while leaving requirements unproven, tests disconnected, or implementation shortcuts hidden in otherwise polished code. Proofline makes those gaps visible without pretending that static evidence proves correctness.

In one review workspace, it shows:

- requirement-to-code and requirement-to-test traceability;
- exact-ID evidence separately from weaker phrase suggestions;
- passing, failing, implementation-only, missing, ambiguous, and suggested-evidence states;
- changed-line implementation-integrity findings with file, line, impact, and remediation;
- an optional AI skeptic with selectable claim/artifact excerpts and advisory-only results;
- downloadable Markdown and JSON reports plus a Mermaid evidence-map diagram.

## Try it locally

Prerequisite: Node.js 24.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. Use **Try the evidence dossier** for a deterministic tour, submit a public GitHub pull-request, commit, or comparison URL, or import a local requirements document, unified diff, and optional JUnit XML file. `npm run dev` covers deterministic browser features; use `npm run dev:full` when testing the optional hosted-skeptic endpoint with server variables from `.env.local`.

> [!IMPORTANT]
> **Anonymous GitHub requests are throttled.** [GitHub limits unauthenticated REST API traffic](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) to 60 requests per hour per public IP address. One Proofline analysis can use several requests while it inspects changed files and searches for requirement documents, so repeated analyses—or other people sharing the same network—can exhaust that allowance. If this happens, wait for GitHub's hourly window to reset, use the bundled demo or local import, or configure **Connect GitHub** for authenticated public-repository requests (up to 5,000 per hour). Proofline never asks you to paste a personal access token.

Optional authenticated access uses Supabase-managed GitHub OAuth. See the [GitHub sign-in setup guide](docs/supabase-github-setup.md).

Proofline reduces API traffic by caching completed analyses and fresh GitHub responses for the current page session, sharing identical in-flight requests, revalidating stale responses with ETags, and progressively fetching requirement-document tiers until a viable source is found. A first-time analysis still requires several GitHub requests.

## Import local evidence

Local import does not accept a repository ZIP. A ZIP is only a source snapshot and does not identify the change baseline Proofline needs. Instead, choose these files together in the **Import local evidence** file picker:

- exactly one requirements file: `.md`, `.mdx`, `.txt`, `.rst`, or `.adoc`;
- exactly one Git unified diff: `.diff` or `.patch`;
- optionally one JUnit-compatible test report: `.xml`.

The requirements document must contain stable IDs such as `REQ-101`. To compare the current branch with `main`, create the patch from the repository root:

```bash
git fetch origin
git diff origin/main...HEAD --output=proofline.patch
```

To analyze staged and unstaged local work relative to the current commit instead:

```bash
git diff HEAD --output=proofline.patch
```

Then select, in one file-picker operation, for example:

```text
requirements.md
proofline.patch
test-results.xml  # optional
```

Only one file for each role is accepted, and every file must be 5 MB or smaller. Files are read as UTF-8 text, remain in browser memory, and disappear on refresh. The optional skeptic still sends only the excerpts the user explicitly selects.

Run the quality gates:

```bash
npm test
npm run lint
npm run build
```

## Deploy to Vercel

The repository includes a production-ready [`vercel.json`](vercel.json) for GitHub-connected Vercel deployments. Import the repository as a Vite project; the configuration installs from the committed npm lockfile, builds with Node.js 24, publishes `dist`, and sends SPA deep links to `index.html`.

For optional GitHub sign-in, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel's project environment variables, then redeploy. Never add the GitHub OAuth client secret to Vercel or to a `VITE_` variable.

The optional hosted AI skeptic uses a Vercel Function, Hugging Face's official JavaScript inference client, and a server-owned Hugging Face token. Configure the server-only `HF_TOKEN`, `HF_MODEL`, and `RATE_LIMIT_SALT` variables described in `.env.example`. Never prefix these secrets with `VITE_`. Per-client, shared-request, estimated-token, timeout, and output ceilings are configurable server-side. Limits are best-effort per warm Vercel instance and reset when that instance is recycled or redeployed.

Follow the [Vercel deployment checklist](docs/vercel-deployment.md), including the final Supabase redirect configuration.

## Installation, platforms, and judge testing

Proofline is a hosted browser developer tool, not an IDE or ChatGPT plugin. The deployed demo requires no installation, account, repository access, or API key for its guaranteed test path.

**Supported platform:** Current desktop Chrome or Microsoft Edge with JavaScript enabled. The responsive interface is also verified in mobile Chromium. Firefox and Safari are expected to work but are not in the formally tested browser matrix.

**Recommended judge test:**

1. Open the [public Proofline deployment](https://proofline-5s39-phi.vercel.app/).
2. Select **Try the evidence dossier**. This deterministic synthetic case requires no network calls or sign-in.
3. Inspect the requirement evidence states, evidence graph, and Implementation Integrity findings.
4. Export the Markdown or JSON report.
5. Optionally return to the landing page and analyze a public GitHub pull request, commit, or comparison. Anonymous GitHub throttling applies; **Connect GitHub** is optional.

**Local installation:** Clone the repository on Windows, macOS, or Linux with Node.js 24 and npm available, then run `npm ci`. Use `npm run dev` for deterministic browser-only features or `npm run dev:full` to run Vite and the hosted-skeptic API locally from `.env.local`. No deployment is created. No model credential is required for the bundled demo or local-import workflow.

## How analysis works

1. Proofline reads a public pull request, single commit, or comparison anonymously or through optional GitHub sign-in, or accepts local files in memory.
2. It looks for requirements in available PR/commit text and likely repository documents at the head revision. Candidates are ranked by path, filename, content signals, and stable requirement IDs.
3. If no formal IDs exist, it extracts explicitly declared change bullets, dependency-update table rows, or a commit subject as generated `CLAIM-001` labels. These are visibly identified as claims and can never create strong evidence.
4. Exact source-authored IDs such as `REQ-101` create strong associations to changed code and test names. Phrase similarity is displayed only as a suggestion.
5. JUnit results and changed-line implementation evidence produce one of six explicit evidence states.
6. A separate deterministic scanner reports suspicious placeholders, unimplemented branches, empty handlers, fixture imports, and mock responses.
7. In the optional hosted skeptic, the user selects a whole claim or individual artifact excerpts, up to eight per run. Already-assessed excerpts remain marked so **Select next batch** can cycle through the rest. Excerpt code is collapsed by default inside a scroll-bounded inspector with an always-available minimize action.
8. After explicit approval, Proofline sends only the selected, size-bounded excerpts through its quota-protected Vercel Function. The approval checkbox is remembered in local browser storage until the user clears it; only that boolean preference is persisted. Advisory results never upgrade deterministic evidence.

Proofline reports evidence, not semantic correctness. Human review remains the decision boundary.

## Privacy, security, and limits

- No account, analytics, or runtime model call is required for anonymous GitHub analysis, the bundled demo, or local import.
- Imported files and analyses remain in browser memory and disappear on refresh.
- Hosted-skeptic consent persistence stores only a boolean browser preference, never repository content, excerpts, prompts, or model output.
- Exports are initiated explicitly by the user.
- Public GitHub analysis can use anonymous read-only requests (60 requests per hour per public IP) or optional Supabase-managed GitHub OAuth (up to 5,000 requests per hour for the signed-in user).
- The optional GitHub provider token is kept in tab-scoped session storage, is sent only to GitHub's API, and is cleared when the tab closes or the user returns to anonymous mode.
- Private repository authentication is a post-hackathon goal and should use a GitHub App or OAuth—not personal access tokens pasted into the app.
- Candidate discovery is bounded by centralized configuration: 100 changed files, 6 candidate documents, 12 declared claims, 256 KB per candidate, and 5 MB per local import.
- Hosted skeptic usage is best-effort limited per salted connection and per warm Vercel instance each UTC day. Each run is capped at eight selected excerpts, and unusually large excerpts are reduced before crossing the server's 20,000-character request ceiling. No quota data, raw addresses, repository content, prompts, or model output is persisted.

See [architecture](docs/architecture.md), the [formal specification](specs/2026-07-16-openai-devpost-hackathon-entry/spec.md), and the [requirements](specs/2026-07-16-openai-devpost-hackathon-entry/planning/requirements.md).

## Built with Codex and GPT-5.6

Codex was used as the implementation collaborator for requirements shaping, architecture, frontend design, domain logic, tests, GitHub integration, accessibility, and skeptical quality review. Human decisions—including browser-only operation, exact-ID evidence semantics, implementation integrity in the MVP, bounded repository discovery, and the forensic editorial visual direction—were recorded before or during implementation.

- GPT-5.6 session verified: **Yes — 5.6 Sol Light, visually confirmed in the Codex client on 2026-07-17**
- `/feedback` session ID: 019f6c49-9dc4-78b1-b3fb-c98eac8ba859
- Public demo URL: **https://proofline-5s39-phi.vercel.app/**
- Public repository URL: **https://github.com/visprogithub/proofline**
- Narrated demo video: **TODO**

The detailed build record is in [docs/codex-build-log.md](docs/codex-build-log.md), and the recording outline is in [docs/demo-script.md](docs/demo-script.md).

## Roadmap

- explicit selection when multiple requirement documents rank equally;
- linked-issue requirement retrieval;
- private repositories through GitHub App/OAuth;
- opt-in saved analyses;
- standard report adapters such as SARIF;
- configurable integrity rule packs.

## License

MIT. See [LICENSE](LICENSE).
