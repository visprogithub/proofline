import { describe, expect, it } from 'vitest'
import { createDemoCase } from '../../demo/demo-fixture'
import { serializeMermaidReport } from './review-report'

describe('Mermaid evidence map export', () => {
  it('renders requirement and artifact nodes with exact and suggested edges', () => {
    const report = serializeMermaidReport(createDemoCase().evidence)

    expect(report).toContain('flowchart LR')
    expect(report).toContain('REQ-101: Export evidence reports')
    expect(report).toContain('-->|"exact ID"|')
    expect(report).toContain('-.->|"phrase suggestion"|')
    expect(report).toContain('human review remains the decision boundary')
  })

  it('escapes untrusted label syntax', () => {
    const evidence = createDemoCase().evidence
    evidence.requirements[0]!.requirement.title = 'Export "reports"\n<script>'
    const report = serializeMermaidReport(evidence)
    expect(report).toContain('Export #quot;reports#quot; script')
    expect(report).not.toContain('<script>')
  })
})
