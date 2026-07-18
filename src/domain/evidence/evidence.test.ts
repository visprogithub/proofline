import { describe, expect, it } from 'vitest'
import { associateEvidence } from './association-engine'
import { parseJunit } from './junit-parser'
import { parseRequirements } from './requirements-parser'
import { deriveRequirementEvidence } from './state-derivation'
import type { EvidenceArtifact, SourceProvenance } from './types'
import { parseDiffEvidence } from './diff-evidence'

const source: SourceProvenance = { kind: 'demo', label: 'Demo specification' }

describe('evidence domain', () => {
  it('extracts stable requirements and acceptance criteria with provenance', () => {
    const result = parseRequirements(
      '## REQ-101: Export reports\n- Export Markdown\n- Export JSON\n\n## REQ-102: Clear data',
      source,
    )

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      id: 'REQ-101',
      title: 'Export reports',
      acceptanceCriteria: ['Export Markdown', 'Export JSON'],
      location: { line: 1 },
    })
  })

  it('only treats structurally declared identifiers as requirements', () => {
    const result = parseRequirements(
      [
        'ryOS is licensed under AGPL-3.0.',
        'This sentence references REQ-999 but does not declare it.',
        '- **SEC-AUTH-201**: Require GitHub login',
        '| DATA-202 | Export analysis |',
      ].join('\n'),
      source,
    )

    expect(result.map(({ id, title }) => [id, title])).toEqual([
      ['SEC-AUTH-201', 'Require GitHub login'],
      ['DATA-202', 'Export analysis'],
    ])
  })

  it('parses passing, failing, and skipped JUnit cases', () => {
    const xml = `
      <testsuites><testsuite name="exports">
        <testcase classname="report" name="REQ-101 writes markdown" />
        <testcase name="REQ-102 clears memory"><failure message="expected clear" /></testcase>
        <testcase name="REQ-103 later"><skipped /></testcase>
      </testsuite></testsuites>`

    expect(parseJunit(xml, source).map(({ outcome }) => outcome)).toEqual([
      'passed', 'failed', 'skipped',
    ])
  })

  it('requires exact IDs for strong associations and never promotes suggestions', () => {
    const requirements = parseRequirements(
      '## REQ-101: Export review reports\n- Download a Markdown report',
      source,
    )
    const artifacts: EvidenceArtifact[] = [
      {
        id: 'exact', kind: 'implementation', label: 'export.ts',
        content: 'implements REQ-101', location: { source, path: 'export.ts' },
      },
      {
        id: 'similar', kind: 'test', label: 'download test', outcome: 'passed',
        content: 'download markdown review report', location: { source, path: 'export.test.ts' },
      },
    ]

    const associations = associateEvidence(requirements, artifacts)
    expect(associations.map(({ strength }) => strength)).toEqual(['strong', 'suggested'])
    expect(deriveRequirementEvidence(requirements, artifacts, associations)[0]?.state)
      .toBe('implementation-evidence-only')
  })

  it('derives test and failing evidence from exact-ID-linked artifacts', () => {
    const requirements = parseRequirements('## REQ-101: Export reports', source)
    const implementation: EvidenceArtifact = {
      id: 'code', kind: 'implementation', label: 'export.ts', content: 'REQ-101',
      location: { source },
    }
    const passing: EvidenceArtifact = {
      id: 'pass', kind: 'test', label: 'test', content: 'REQ-101', outcome: 'passed',
      location: { source },
    }
    const failing: EvidenceArtifact = {
      ...passing, id: 'fail', outcome: 'failed',
    }

    const passArtifacts = [implementation, passing]
    expect(deriveRequirementEvidence(
      requirements,
      passArtifacts,
      associateEvidence(requirements, passArtifacts),
    )[0]?.state).toBe('test-evidence-found')

    const failArtifacts = [implementation, failing]
    expect(deriveRequirementEvidence(
      requirements,
      failArtifacts,
      associateEvidence(requirements, failArtifacts),
    )[0]?.state).toBe('failing-test-evidence')
  })

  it('does not count a deleted-only requirement ID as current implementation evidence', () => {
    const requirements = parseRequirements('## REQ-101: Export reports', source)
    const patch = '@@ -1 +1 @@\n-exportReport() // REQ-101\n+removeLegacyExport()'
    const artifacts: EvidenceArtifact[] = [{
      id: 'removed', kind: 'implementation', role: 'implementation', label: 'export.ts',
      content: patch, diff: parseDiffEvidence('export.ts', patch), location: { source, path: 'export.ts' },
    }]
    const associations = associateEvidence(requirements, artifacts)

    expect(associations[0]).toMatchObject({
      strength: 'suggested', rule: 'removed-requirement-id', matchedLine: { change: 'deleted' },
    })
    expect(deriveRequirementEvidence(requirements, artifacts, associations)[0]?.state)
      .toBe('ambiguous-evidence')
  })
})
