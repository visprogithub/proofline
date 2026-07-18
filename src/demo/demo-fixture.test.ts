import { describe, expect, it } from 'vitest'
import { createDemoCase } from './demo-fixture'

describe('synthetic demo case', () => {
  it('uses real domains to produce the intended reveal', () => {
    const demo = createDemoCase()

    expect(demo.evidence.requirements.map(({ state }) => state)).toEqual([
      'test-evidence-found',
      'implementation-evidence-only',
      'failing-test-evidence',
      'ambiguous-evidence',
    ])
    expect(demo.integrity.findings).toHaveLength(2)
    expect(demo.assessmentContexts.filter(({ status }) => status === 'partial')).toHaveLength(3)
    expect(demo.mode).toBe('demo')
  })
})
