import { describe, expect, it } from 'vitest'
import { validatedAssessment } from './advisory-assessment'
import type { AssessmentContext } from './assessment-context'

const context: AssessmentContext = {
  schemaVersion: 1, id: 'context:1', artifactId: 'file:1', artifactLabel: 'src/a.ts',
  artifactRole: 'implementation', status: 'partial', reasons: ['source-unavailable'],
  requirement: {
    id: 'REQ-101', identifierOrigin: 'source', title: 'Export', acceptanceCriteria: [],
    rawText: 'REQ-101 Export', location: { source: { kind: 'demo', label: 'Demo' } },
  },
  association: {
    requirementId: 'REQ-101', artifactId: 'file:1', strength: 'strong',
    rule: 'exact-requirement-id', matchedText: ['REQ-101'],
    location: { source: { kind: 'demo', label: 'Demo' } },
  },
  lines: [{ id: 'L1', content: 'function exportReport() {} // REQ-101', change: 'added' }],
}
const provenance = { providerId: 'fake', modelId: 'fake-model', promptVersion: 'skeptic-v1' }

describe('advisory assessment validation', () => {
  it('accepts a bounded implementation verdict with valid citations', () => {
    expect(validatedAssessment(context, {
      verdict: 'hollow-stub', rationale: 'The function body is empty.', citedLineIds: ['L1'],
    }, provenance, '2026-07-17T00:00:00.000Z')).toMatchObject({
      status: 'assessed', kind: 'implementation', verdict: 'hollow-stub',
    })
  })

  it('rejects unknown verdicts and citations outside submitted context', () => {
    expect(() => validatedAssessment(context, {
      verdict: 'approved', rationale: 'Looks good.', citedLineIds: ['L1'],
    }, provenance)).toThrow()
    expect(() => validatedAssessment(context, {
      verdict: 'substantively-related', rationale: 'Related.', citedLineIds: ['NOT-SENT'],
    }, provenance)).toThrow('outside the submitted')
  })
})
