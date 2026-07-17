# Codex build record

This document separates human product decisions, Codex contributions, and claims that still require submission-time verification.

## Human-directed decisions

- Target developer teams reviewing coding-agent pull requests.
- Avoid healthcare and real PHI/PII despite relevant professional experience.
- Run without paid inference or an OpenAI API key.
- Support public GitHub pull requests, single commits, comparisons, and local imports in the MVP.
- Discover requirement documents across varied names and repository locations.
- Treat private repository authentication as a later GitHub App/OAuth iteration.
- Keep analyses ephemeral but allow explicit Markdown and JSON export.
- Include test evidence and implementation-integrity checks in the hackathon MVP.
- Centralize tunable discovery limits and rule configuration.
- Use established libraries when they improve quality or avoid reimplementation.

## Codex contributions

Within the interactive development session, Codex helped:

1. research and interpret the hackathon constraints;
2. shape the product concept and formalize requirements;
3. design the browser-only architecture and evidence-state model;
4. implement parsers, deterministic association logic, GitHub/local adapters, and bounded discovery;
5. build the React interface and synthetic demo through the real analysis pipeline;
6. add unit, integration, and browser smoke tests;
7. run a skeptical-engineer audit for stubs, dead code, fake integrations, reinvention, and overengineering;
8. fix the audit findings and prepare submission documentation.

The working documents are preserved under `specs/2026-07-16-openai-devpost-hackathon-entry/` rather than reconstructed after the implementation.

## GPT-5.6 verification

The user requires GPT-5.6 for the submission. The repository cannot inspect the ChatGPT/Codex client’s selected model, so the final entrant must verify the model indicator in the client and record the real `/feedback` session ID here and in the README.

- Model indicator verified as GPT-5.6: **Yes — 5.6 Sol Light**
- `/feedback` session ID: **TODO**
- Verification date: **2026-07-17**

Do not replace these placeholders from memory or assumption; use visible session evidence.

## Quality evidence

The local quality gate is:

```bash
npm test
npm run lint
npm run build
```

CI repeats those checks from the committed lockfile on Node.js 24. `SLOP_REPORT.md` contains the latest skeptical implementation audit. This evidence supports reviewability; it is not a guarantee of correctness.
