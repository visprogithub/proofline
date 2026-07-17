import { associateEvidence } from '../domain/evidence/association-engine'
import { parseRequirements } from '../domain/evidence/requirements-parser'
import { deriveRequirementEvidence } from '../domain/evidence/state-derivation'
import { scanChangedLines } from '../domain/integrity/changed-line-scanner'
import type { EvidenceArtifact } from '../domain/evidence/types'
import type { AnalysisCase } from '../app/analysis/types'

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

const artifacts: EvidenceArtifact[] = [
  {
    id: 'file:report.ts', kind: 'implementation', label: 'src/report.ts',
    content: 'export function downloadReport() { /* REQ-101 */ }',
    location: { source, path: 'src/report.ts', line: 14 },
  },
  {
    id: 'test:report', kind: 'test', label: 'REQ-101 downloads Markdown and JSON',
    content: 'REQ-101 downloads Markdown and JSON', outcome: 'passed',
    location: { source, path: 'src/report.test.ts', line: 22 },
  },
  {
    id: 'file:reset.ts', kind: 'implementation', label: 'src/reset.ts',
    content: 'export function reset() { state = null } // REQ-102',
    location: { source, path: 'src/reset.ts', line: 8 },
  },
  {
    id: 'file:limits.ts', kind: 'implementation', label: 'src/limits.ts',
    content: 'if (file.size > limit) throw new LimitError() // REQ-103',
    location: { source, path: 'src/limits.ts', line: 31 },
  },
  {
    id: 'test:limits', kind: 'test', label: 'REQ-103 rejects oversized files',
    content: 'REQ-103 rejects oversized files', outcome: 'failed',
    location: { source, path: 'src/limits.test.ts', line: 47 },
  },
  {
    id: 'file:status.ts', kind: 'implementation', label: 'src/status.ts',
    content: 'announce analysis status completion to assistive technology',
    location: { source, path: 'src/status.ts', line: 12 },
  },
]

/** Produces the synthetic case by running the real evidence and integrity domains. */
export function createDemoCase(): AnalysisCase {
  const requirements = parseRequirements(specification, source)
  const associations = associateEvidence(requirements, artifacts)
  return {
    id: 'demo:synthetic-pr-17',
    mode: 'demo',
    analysisBasis: 'formal-requirements',
    title: 'Add reviewer evidence exports',
    repository: 'proofline-labs/sample-service',
    evidence: {
      schemaVersion: 1,
      generatedAt: '2026-07-17T12:00:00.000Z',
      sourceLabel: source.label,
      requirements: deriveRequirementEvidence(requirements, artifacts, associations),
      disclaimer: 'Synthetic observed artifacts, not a correctness, security, or merge claim.',
    },
    integrity: scanChangedLines([
      { path: 'src/export.ts', line: 42, content: '// TODO: replace canned response', change: 'added' },
      { path: 'src/export.ts', line: 43, content: "const mockResponse = { ok: true }", change: 'added' },
    ]),
  }
}
