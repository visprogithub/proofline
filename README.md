# Proofline

**Trace requirements to working code—and flag implementation shortcuts before they reach review.**

Proofline is a browser-only developer tool for reviewing a public GitHub pull request, single commit, comparison, or local evidence bundle. It discovers likely requirement documents, maps stable requirement IDs to changed code and test results, and separately identifies implementation-integrity risks such as stubs, placeholder handlers, and production mock responses.

The project targets the Developer Tools track of OpenAI Build Week. It was designed and implemented through a spec-driven Codex workflow. The final submission must include the actual Codex `/feedback` session ID and must verify that the session used GPT-5.6; this repository does not attempt to infer or fabricate that client-side model setting.

## Why it exists

Coding agents can produce a convincing diff while leaving requirements unproven, tests disconnected, or implementation shortcuts hidden in otherwise polished code. Proofline makes those gaps visible without pretending that static evidence proves correctness.

In one review workspace, it shows:

- requirement-to-code and requirement-to-test traceability;
- exact-ID evidence separately from weaker phrase suggestions;
- passing, failing, implementation-only, missing, ambiguous, and suggested-evidence states;
- changed-line implementation-integrity findings with file, line, impact, and remediation;
- a downloadable Markdown or JSON report.

## Try it locally

Prerequisite: Node.js 24.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. Use **Try the evidence dossier** for a deterministic tour, submit a public GitHub pull-request, commit, or comparison URL, or import local requirement, diff, and JUnit XML files.

> [!IMPORTANT]
> **Anonymous GitHub requests are throttled.** [GitHub limits unauthenticated REST API traffic](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) to 60 requests per hour per public IP address. One Proofline analysis can use several requests while it inspects changed files and searches for requirement documents, so repeated analyses—or other people sharing the same network—can exhaust that allowance. If this happens, wait for GitHub's hourly window to reset, use the bundled demo or local import, or configure **Connect GitHub** for authenticated public-repository requests (up to 5,000 per hour). Proofline never asks you to paste a personal access token.

Optional authenticated access uses Supabase-managed GitHub OAuth. See the [GitHub sign-in setup guide](docs/supabase-github-setup.md).

Proofline reduces API traffic by caching completed analyses and fresh GitHub responses for the current page session, sharing identical in-flight requests, revalidating stale responses with ETags, and progressively fetching requirement-document tiers until a viable source is found. A first-time analysis still requires several GitHub requests.

Run the quality gates:

```bash
npm test
npm run lint
npm run build
```

## Deploy to Vercel

The repository includes a production-ready [`vercel.json`](vercel.json) for GitHub-connected Vercel deployments. Import the repository as a Vite project; the configuration installs from the committed npm lockfile, builds with Node.js 24, publishes `dist`, and sends SPA deep links to `index.html`.

For optional GitHub sign-in, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel's project environment variables, then redeploy. Never add the GitHub OAuth client secret to Vercel or to a `VITE_` variable.

Follow the [Vercel deployment checklist](docs/vercel-deployment.md), including the final Supabase redirect configuration.

## Installation, platforms, and judge testing

Proofline is a hosted browser developer tool, not an IDE or ChatGPT plugin. The deployed demo requires no installation, account, repository access, or API key for its guaranteed test path.

**Supported platform:** Current desktop Chrome or Microsoft Edge with JavaScript enabled. The responsive interface is also verified in mobile Chromium. Firefox and Safari are expected to work but are not in the formally tested browser matrix.

**Recommended judge test:**

1. Open the public demo URL: **TODO — add after Vercel deployment**.
2. Select **Try the evidence dossier**. This deterministic synthetic case requires no network calls or sign-in.
3. Inspect the requirement evidence states, evidence graph, and Implementation Integrity findings.
4. Export the Markdown or JSON report.
5. Optionally return to the landing page and analyze a public GitHub pull request, commit, or comparison. Anonymous GitHub throttling applies; **Connect GitHub** is optional.

**Local installation:** Clone the repository on Windows, macOS, or Linux with Node.js 24 and npm available, then run `npm ci` followed by `npm run dev`. No application server, database, paid model API, or private credential is required for the bundled demo or local-import workflow.

## How analysis works

1. Proofline reads a public pull request, single commit, or comparison anonymously or through optional GitHub sign-in, or accepts local files in memory.
2. It looks for requirements in available PR/commit text and likely repository documents at the head revision. Candidates are ranked by path, filename, content signals, and stable requirement IDs.
3. If no formal IDs exist, it extracts explicitly declared change bullets, dependency-update table rows, or a commit subject as generated `CLAIM-001` labels. These are visibly identified as claims and can never create strong evidence.
4. Exact source-authored IDs such as `REQ-101` create strong associations to changed code and test names. Phrase similarity is displayed only as a suggestion.
5. JUnit results and changed-line implementation evidence produce one of six explicit evidence states.
6. A separate deterministic scanner reports suspicious placeholders, unimplemented branches, empty handlers, fixture imports, and mock responses.

Proofline reports evidence, not semantic correctness. Human review remains the decision boundary.

## Privacy, security, and limits

- No account, analytics, or runtime model call is required for anonymous GitHub analysis, the bundled demo, or local import.
- Imported files and analyses remain in browser memory and disappear on refresh.
- Exports are initiated explicitly by the user.
- Public GitHub analysis can use anonymous read-only requests (60 requests per hour per public IP) or optional Supabase-managed GitHub OAuth (up to 5,000 requests per hour for the signed-in user).
- The optional GitHub provider token is kept in tab-scoped session storage, is sent only to GitHub's API, and is cleared when the tab closes or the user returns to anonymous mode.
- Private repository authentication is a post-hackathon goal and should use a GitHub App or OAuth—not personal access tokens pasted into the app.
- Candidate discovery is bounded by centralized configuration: 100 changed files, 6 candidate documents, 12 declared claims, 256 KB per candidate, and 5 MB per local import.

See [architecture](docs/architecture.md), the [formal specification](specs/2026-07-16-openai-devpost-hackathon-entry/spec.md), and the [requirements](specs/2026-07-16-openai-devpost-hackathon-entry/planning/requirements.md).

## Built with Codex and GPT-5.6

Codex was used as the implementation collaborator for requirements shaping, architecture, frontend design, domain logic, tests, GitHub integration, accessibility, and skeptical quality review. Human decisions—including browser-only operation, exact-ID evidence semantics, implementation integrity in the MVP, bounded repository discovery, and the forensic editorial visual direction—were recorded before or during implementation.

Before submission, replace the placeholders below using the actual ChatGPT/Codex client evidence:

- GPT-5.6 session verified: **Yes — 5.6 Sol Light, visually confirmed in the Codex client on 2026-07-17**
- `/feedback` session ID: **TODO**
- Public demo URL: **TODO**
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
