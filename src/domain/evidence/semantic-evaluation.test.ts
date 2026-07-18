import { describe, expect, it } from 'vitest'
import { binaryEvaluationMetrics, semanticOutperformGate } from './semantic-evaluation'

describe('semantic outperform gate', () => {
  it('passes only when precision, recall, and F1 beat every reviewed threshold', () => {
    const expected = [true, true, true, true, true, false, false, false, false, false]
    const baseline = binaryEvaluationMetrics(expected, [true, true, false, false, false, false, false, false, false, false])
    const candidate = binaryEvaluationMetrics(expected, [true, true, true, true, false, false, false, false, false, false])
    expect(semanticOutperformGate(baseline, candidate)).toEqual({ passed: true, reasons: [] })
  })

  it('reports every failed criterion instead of permitting production integration', () => {
    const baseline = binaryEvaluationMetrics([true, true, false], [true, false, false])
    const candidate = binaryEvaluationMetrics([true, true, false], [true, false, true])
    const result = semanticOutperformGate(baseline, candidate)
    expect(result.passed).toBe(false)
    expect(result.reasons).toHaveLength(3)
  })
})
