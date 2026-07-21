import { describe, expect, it } from 'vitest'
import { createOperationalLimits } from '../../config/limits'
import { associateEvidence } from './association-engine'
import { buildAssessmentContexts } from './assessment-context'
import { parseDiffEvidence } from './diff-evidence'
import { deriveRequirementEvidence } from './state-derivation'
import type { AnalysisResult, EvidenceArtifact, Requirement } from './types'

const source = { kind: 'demo' as const, label: 'Context test' }
const requirement: Requirement = {
  id: 'REQ-101', identifierOrigin: 'source', title: 'Export reports',
  acceptanceCriteria: [], rawText: 'REQ-101 Export reports', location: { source, line: 1 },
}

function resultFor(artifacts: EvidenceArtifact[]): AnalysisResult {
  const associations = associateEvidence([requirement], artifacts)
  return {
    schemaVersion: 1, generatedAt: '2026-07-17T00:00:00.000Z', sourceLabel: source.label,
    requirements: deriveRequirementEvidence([requirement], artifacts, associations), disclaimer: 'Test',
  }
}

describe('assessment context builder', () => {
  it('builds numbered partial context for an added exact-ID hunk', () => {
    const patch = '@@ -1 +1,2 @@\n old\n+exportReport() // REQ-101'
    const artifacts: EvidenceArtifact[] = [{
      id: 'file:export', kind: 'implementation', role: 'implementation', label: 'export.ts',
      content: patch, diff: parseDiffEvidence('export.ts', patch), location: { source, path: 'export.ts' },
    }]

    const [context] = buildAssessmentContexts(resultFor(artifacts))
    expect(context).toMatchObject({ status: 'partial', artifactRole: 'implementation' })
    expect(context?.reasons).toContain('source-unavailable')
    expect(context?.lines.at(-1)).toMatchObject({ change: 'added', content: 'exportReport() // REQ-101' })
  })

  it('spreads a small context budget across every requirement', () => {
    const requirements: Requirement[] = ['REQ-101', 'REQ-102', 'REQ-103'].map((id, index) => ({
      id, identifierOrigin: 'source', title: `Requirement ${id}`,
      acceptanceCriteria: [], rawText: `${id} requirement`, location: { source, line: index + 1 },
    }))
    // Two candidates per requirement. A first-come budget of three would hand two to the
    // first requirement and leave the last one with no excerpt at all.
    const artifacts: EvidenceArtifact[] = requirements.flatMap((item) => [1, 2].map((n) => {
      const label = `${item.id}-${n}.ts`
      const patch = `@@ -0,0 +1 @@\n+run${n}() // ${item.id}`
      return {
        id: `file:${label}`, kind: 'implementation' as const, role: 'implementation' as const,
        label, content: patch, diff: parseDiffEvidence(label, patch),
        location: { source, path: label },
      }
    }))
    const associations = associateEvidence(requirements, artifacts)
    const result: AnalysisResult = {
      schemaVersion: 1, generatedAt: '2026-07-17T00:00:00.000Z', sourceLabel: source.label,
      requirements: deriveRequirementEvidence(requirements, artifacts, associations), disclaimer: 'Test',
    }

    const contexts = buildAssessmentContexts(result, createOperationalLimits({ maxAssessmentContexts: 3 }))

    expect(contexts).toHaveLength(3)
    expect(new Set(contexts.map((context) => context.requirement.id)))
      .toEqual(new Set(['REQ-101', 'REQ-102', 'REQ-103']))
  })

  it('builds complete context when bounded head-revision source is available', () => {
    const patch = '@@ -0,0 +1,2 @@\n+import { writer } from "./writer"\n+exportReport() // REQ-101'
    const artifacts: EvidenceArtifact[] = [{
      id: 'file:export', kind: 'implementation', role: 'implementation', label: 'export.ts',
      content: patch, diff: parseDiffEvidence('export.ts', patch),
      headSource: {
        content: 'import { writer } from "./writer"\nexportReport() // REQ-101\nwriter.flush()',
        revision: 'abc123',
      },
      location: { source, path: 'export.ts' },
    }]

    const [context] = buildAssessmentContexts(resultFor(artifacts))

    expect(context).toMatchObject({ status: 'complete', reasons: [] })
    expect(context?.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'source-line-1', content: 'import { writer } from "./writer"' }),
      expect.objectContaining({ id: 'source-line-3', content: 'writer.flush()' }),
    ]))
  })

  it('marks passing execution metadata insufficient without a test body', () => {
    const artifacts: EvidenceArtifact[] = [{
      id: 'check:1', kind: 'test', role: 'test-execution', label: 'REQ-101 checks',
      content: 'REQ-101 checks', outcome: 'passed', location: { source },
    }]
    expect(buildAssessmentContexts(resultFor(artifacts))[0]).toMatchObject({
      status: 'insufficient', reasons: ['test-body-unavailable'],
    })
  })

  it('enforces the centralized context count limit', () => {
    const artifacts = [1, 2].map((index): EvidenceArtifact => ({
      id: `check:${index}`, kind: 'test', role: 'test-execution', label: `REQ-101 ${index}`,
      content: `REQ-101 ${index}`, outcome: 'passed', location: { source },
    }))
    const limits = createOperationalLimits({ maxAssessmentContexts: 1 })
    expect(buildAssessmentContexts(resultFor(artifacts), limits)).toHaveLength(1)
  })

  it('builds advisory context for a generated claim phrase match without upgrading its strength', () => {
    const claim: Requirement = {
      ...requirement,
      id: 'CLAIM-001',
      identifierOrigin: 'generated',
      title: 'Export the report summary',
      rawText: 'Export the report summary',
    }
    const patch = '@@ -0,0 +1 @@\n+exportReportSummary()'
    const artifact: EvidenceArtifact = {
      id: 'file:export', kind: 'implementation', role: 'implementation', label: 'export.ts',
      content: patch, diff: parseDiffEvidence('export.ts', patch), location: { source, path: 'export.ts' },
    }
    const associations = associateEvidence([claim], [artifact])
    const result: AnalysisResult = {
      schemaVersion: 1, generatedAt: '2026-07-17T00:00:00.000Z', sourceLabel: source.label,
      requirements: deriveRequirementEvidence([claim], [artifact], associations), disclaimer: 'Test',
    }

    expect(associations[0]).toMatchObject({ strength: 'suggested', rule: 'phrase-overlap' })
    expect(buildAssessmentContexts(result)[0]).toMatchObject({ status: 'partial', artifactLabel: 'export.ts' })
  })
})
