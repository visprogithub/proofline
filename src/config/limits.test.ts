import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, createOperationalLimits, formatByteLimit } from './limits'

describe('operational limits', () => {
  it('provides the reviewed defaults', () => {
    expect(DEFAULT_LIMITS).toEqual({
      maxChangedFiles: 100,
      maxRequirementCandidates: 6,
      maxCandidateBytes: 262_144,
      maxLocalImportBytes: 5_242_880,
      maxDeclaredClaims: 12,
    })
  })

  it('accepts valid overrides without mutating defaults', () => {
    const configured = createOperationalLimits({ maxChangedFiles: 12 })

    expect(configured.maxChangedFiles).toBe(12)
    expect(DEFAULT_LIMITS.maxChangedFiles).toBe(100)
    expect(Object.isFrozen(configured)).toBe(true)
  })

  it('rejects non-positive and fractional values', () => {
    expect(() => createOperationalLimits({ maxChangedFiles: 0 })).toThrow()
    expect(() => createOperationalLimits({ maxChangedFiles: 1.5 })).toThrow()
  })

  it('formats configured byte limits', () => {
    expect(formatByteLimit(DEFAULT_LIMITS.maxCandidateBytes)).toBe('256 KB')
    expect(formatByteLimit(DEFAULT_LIMITS.maxLocalImportBytes)).toBe('5 MB')
  })
})
