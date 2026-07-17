import { describe, expect, it } from 'vitest'
import { changedLinesFromFiles } from './patch-lines'

describe('GitHub patch line normalization', () => {
  it('preserves added file line numbers and ignores removals', () => {
    const result = changedLinesFromFiles([{
      sha: 'abc', filename: 'src/service.ts', status: 'modified', additions: 2, deletions: 1,
      patch: '@@ -8,3 +8,4 @@\n context\n-old\n+new line\n+second line',
    }])

    expect(result).toEqual([
      { path: 'src/service.ts', line: 9, content: 'new line', change: 'added' },
      { path: 'src/service.ts', line: 10, content: 'second line', change: 'added' },
    ])
  })
})
