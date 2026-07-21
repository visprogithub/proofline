# Proofline local-import demo

Select these three files in Proofline's **Import local evidence** form:

1. `proofline-sample-service-pr-17-requirements.md` as the requirements document.
2. `proofline-sample-service-pr-17.patch` as the unified diff.
3. `proofline-sample-service-pr-17-junit.xml` as the optional JUnit test report.

Then select **Analyze local evidence**. The shared `proofline-sample-service-pr-17` prefix keeps the downloaded files identifiable as one bundle for the synthetic `proofline-labs/sample-service` PR #17 case. The sample demonstrates exact implementation and test links, a failing test, suggestion-only evidence, missing evidence, and implementation-integrity findings. `src/notify.ts` additionally carries two shortcuts the pattern rules cannot express—a function that returns a fixed value regardless of its arguments, and an error that is caught and discarded—so the optional model-interpreted pass has something to find that the deterministic scanner does not already report.

All files remain in browser memory and disappear when the page is refreshed.
