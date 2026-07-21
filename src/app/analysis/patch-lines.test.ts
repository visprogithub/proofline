import { describe, expect, it } from 'vitest'
import { changedLinesFromFiles } from './patch-lines'

describe('GitHub patch line normalization', () => {
  it('preserves added file line numbers, keeps context, and ignores removals', () => {
    const result = changedLinesFromFiles([{
      sha: 'abc', filename: 'src/service.ts', status: 'modified', additions: 2, deletions: 1,
      patch: '@@ -8,3 +8,4 @@\n context\n-old\n+new line\n+second line',
    }])

    // Removed lines are dropped; unchanged context is retained so the interpreted
    // integrity pass can read the surrounding code.
    expect(result).toEqual([
      { path: 'src/service.ts', line: 8, content: 'context', change: 'context' },
      { path: 'src/service.ts', line: 9, content: 'new line', change: 'added' },
      { path: 'src/service.ts', line: 10, content: 'second line', change: 'added' },
    ])
  })

  it('keeps the deterministic scanner limited to added lines', () => {
    const result = changedLinesFromFiles([{
      sha: 'abc', filename: 'src/service.ts', status: 'modified', additions: 1, deletions: 0,
      patch: '@@ -8,2 +8,3 @@\n context\n+// TODO: finish this',
    }])

    expect(result.filter(({ change }) => change === 'added')).toHaveLength(1)
    expect(result.filter(({ change }) => change === 'context')).toHaveLength(1)
  })
})
