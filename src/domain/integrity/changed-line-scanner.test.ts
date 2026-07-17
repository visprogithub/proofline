import { describe, expect, it } from 'vitest'
import { scanChangedLines } from './changed-line-scanner'
import type { ChangedLine } from './types'

function added(path: string, line: number, content: string): ChangedLine {
  return { path, line, content, change: 'added' }
}

describe('changed-line integrity scanner', () => {
  it('finds explicit unfinished and unimplemented paths with evidence', () => {
    const result = scanChangedLines([
      added('src/service.ts', 12, '// TODO: replace this placeholder'),
      added('src/service.ts', 13, "throw new Error('not implemented')"),
    ])

    expect(result.scannedAddedLines).toBe(2)
    expect(result.findings).toMatchObject([
      { rule: 'unfinished-marker', confidence: 'suspected', line: 12 },
      { rule: 'unimplemented-exception', confidence: 'confirmed', line: 13 },
    ])
  })

  it('finds empty handlers and production mock leakage', () => {
    const result = scanChangedLines([
      added('src/App.tsx', 22, 'onSubmit={() => {}}'),
      added('src/api.ts', 4, "import { response } from './fixtures/api-response'"),
      added('src/api.ts', 8, 'const mockResponse = { ok: true }'),
    ])

    expect(result.findings.map(({ rule }) => rule)).toEqual([
      'empty-handler', 'mock-import-in-production', 'hardcoded-mock-response',
    ])
  })

  it('does not report removed lines, prose, or fixtures importing fixtures', () => {
    const result = scanChangedLines([
      { ...added('src/old.ts', 1, '// TODO remove'), change: 'removed' },
      added('docs/plan.md', 2, 'TODO: document a future idea'),
      added('src/demo/fixtures/sample.test.ts', 3, "import data from './fixtures/data'"),
      added('src/real.ts', 4, 'const response = await client.fetch()'),
    ])

    expect(result.findings).toEqual([])
  })

  it('returns stable identifiers for identical evidence', () => {
    const input = [added('src/service.ts', 9, 'catch (error) {}')]
    expect(scanChangedLines(input).findings[0]?.id)
      .toBe(scanChangedLines(input).findings[0]?.id)
  })
})
