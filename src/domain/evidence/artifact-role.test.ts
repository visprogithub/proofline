import { describe, expect, it } from 'vitest'
import { artifactClassification } from './artifact-role'

describe('artifact classification', () => {
  it.each(['tests/export.test.ts', 'src/export.spec.ts', '__tests__/export.ts'])(
    'classifies %s as test source',
    (path) => expect(artifactClassification(path)).toEqual({ kind: 'test', role: 'test-source' }),
  )

  it('keeps production source as implementation evidence', () => {
    expect(artifactClassification('src/export.ts')).toEqual({
      kind: 'implementation', role: 'implementation',
    })
  })
})
