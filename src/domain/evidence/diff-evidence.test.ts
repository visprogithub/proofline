import { describe, expect, it } from 'vitest'
import { findEvidenceHunk, parseDiffEvidence } from './diff-evidence'

describe('diff evidence provenance', () => {
  it('normalizes added, deleted, and context line locations across hunks', () => {
    const result = parseDiffEvidence('src/export.ts', [
      '@@ -8,3 +8,4 @@ export function run()',
      ' context',
      '-old // REQ-101',
      '+replacement // REQ-101',
      '+extra',
      '@@ -20 +21 @@',
      '-removed',
      '+added',
    ].join('\n'))

    expect(result.hunks).toHaveLength(2)
    expect(result.hunks[0]?.lines).toMatchObject([
      { change: 'context', oldLine: 8, newLine: 8, content: 'context' },
      { change: 'deleted', oldLine: 9, content: 'old // REQ-101' },
      { change: 'added', newLine: 9, content: 'replacement // REQ-101' },
      { change: 'added', newLine: 10, content: 'extra' },
    ])
    const lineId = result.hunks[1]?.lines[0]?.id
    expect(lineId && findEvidenceHunk(result, lineId)?.oldStart).toBe(20)
  })

  it('represents unavailable patches without treating them as empty patches', () => {
    expect(parseDiffEvidence('src/generated.ts', undefined)).toEqual({
      availability: 'patch-unavailable', path: 'src/generated.ts', hunks: [],
    })
  })
})
