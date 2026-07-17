import { describe, expect, it } from 'vitest'
import { createDemoCase } from '../../demo/demo-fixture'
import { buildEvidenceGraph } from './evidence-graph'

describe('evidence graph model', () => {
  it('deduplicates artifacts and distinguishes strong and suggested edges', () => {
    const model = buildEvidenceGraph(createDemoCase().evidence.requirements)

    expect(model.nodes.filter(({ id }) => id.startsWith('requirement:'))).toHaveLength(4)
    expect(new Set(model.nodes.map(({ id }) => id).values()).size).toBe(model.nodes.length)
    expect(model.edges.some(({ className }) => className?.includes('strong'))).toBe(true)
    expect(model.edges.some(({ animated }) => animated)).toBe(true)
  })
})
