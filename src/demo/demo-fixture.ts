import { associateEvidence } from '../domain/evidence/association-engine'
import { parseRequirements } from '../domain/evidence/requirements-parser'
import { deriveRequirementEvidence } from '../domain/evidence/state-derivation'
import { scanChangedLines } from '../domain/integrity/changed-line-scanner'
import type { EvidenceArtifact } from '../domain/evidence/types'
import type { AnalysisCase } from '../app/analysis/types'
import { buildAssessmentContexts } from '../domain/evidence/assessment-context'
import { parseDiffEvidence } from '../domain/evidence/diff-evidence'

const source = { kind: 'demo' as const, label: 'Synthetic pull request #17' }

const specification = `
## REQ-101: Export evidence reports
- Reviewers can download Markdown and JSON reports.

## REQ-102: Clear analysis data
- Reset removes the current analysis from page memory.

## REQ-103: Reject oversized imports
- Files above the configured limit fail with guidance.

## REQ-104: Announce analysis status
- Screen readers receive progress and completion updates.
`

function implementationArtifact(
  id: string,
  path: string,
  line: number,
  content: string,
): EvidenceArtifact {
  const patch = `@@ -0,0 +${line} @@\n+${content}`
  return {
    id, kind: 'implementation', role: 'implementation', label: path,
    content: patch, diff: parseDiffEvidence(path, patch), location: { source, path, line },
  }
}

const artifacts: EvidenceArtifact[] = [
  implementationArtifact(
    'file:report.ts', 'src/report.ts', 14,
    'export function downloadReport() { /* REQ-101 */ }',
  ),
  {
    id: 'test:report', kind: 'test', role: 'test-execution', label: 'REQ-101 downloads Markdown and JSON',
    content: 'REQ-101 downloads Markdown and JSON', outcome: 'passed',
    location: { source, path: 'src/report.test.ts', line: 22 },
  },
  implementationArtifact(
    'file:reset.ts', 'src/reset.ts', 8,
    'export function reset() { state = null } // REQ-102',
  ),
  implementationArtifact(
    'file:limits.ts', 'src/limits.ts', 31,
    'if (file.size > limit) throw new LimitError() // REQ-103',
  ),
  {
    id: 'test:limits', kind: 'test', role: 'test-execution', label: 'REQ-103 rejects oversized files',
    content: 'REQ-103 rejects oversized files', outcome: 'failed',
    location: { source, path: 'src/limits.test.ts', line: 47 },
  },
  implementationArtifact(
    'file:status.ts', 'src/status.ts', 12,
    'announce analysis status completion to assistive technology',
  ),
]

/** Produces the synthetic case by running the real evidence and integrity domains. */
export function createDemoCase(): AnalysisCase {
  const requirements = parseRequirements(specification, source)
  const associations = associateEvidence(requirements, artifacts)
  const evidence = {
    schemaVersion: 1 as const,
    generatedAt: '2026-07-17T12:00:00.000Z',
    sourceLabel: source.label,
    requirements: deriveRequirementEvidence(requirements, artifacts, associations),
    disclaimer: 'Synthetic observed artifacts, not a correctness, security, or merge claim.',
  }
  return {
    id: 'demo:synthetic-pr-17',
    mode: 'demo',
    analysisBasis: 'formal-requirements',
    title: 'Add reviewer evidence exports',
    repository: 'proofline-labs/sample-service',
    evidence,
    integrity: scanChangedLines([
      { path: 'src/export.ts', line: 42, content: '// TODO: replace canned response', change: 'added' },
      { path: 'src/export.ts', line: 43, content: "const mockResponse = { ok: true }", change: 'added' },
    ]),
    assessmentContexts: buildAssessmentContexts(evidence),
  }
}
