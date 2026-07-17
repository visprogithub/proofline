import { describe, expect, it } from 'vitest'
import { associateEvidence } from './association-engine'
import { parseDeclaredChangeClaims } from './change-claims-parser'

const source = { kind: 'pull-request' as const, label: 'PR #7 declared claims' }

describe('declared change claims', () => {
  it('extracts change bullets but excludes testing bullets', () => {
    const claims = parseDeclaredChangeClaims(`
### Changes
- Show an explicit **Back to Shelf** button
- Wire the button to \`closeBook\`

### Testing
- bun test tests/unit/books.test.ts
`, 'Fallback title', source)

    expect(claims.map(({ id, title }) => [id, title])).toEqual([
      ['CLAIM-001', 'Show an explicit Back to Shelf button'],
      ['CLAIM-002', 'Wire the button to closeBook'],
    ])
    expect(claims.every(({ identifierOrigin }) => identifierOrigin === 'generated')).toBe(true)
  })

  it('uses a commit subject when no bullet claims exist', () => {
    const claims = parseDeclaredChangeClaims(
      'feat: improve loading feedback', 'feat: improve loading feedback',
      { kind: 'github-commit', label: 'Commit abc message' },
    )

    expect(claims[0]?.title).toBe('feat: improve loading feedback')
  })

  it('never creates strong evidence from a generated claim identifier', () => {
    const [claim] = parseDeclaredChangeClaims('', 'Add retry option', source)
    if (!claim) throw new Error('Expected a generated claim')
    const associations = associateEvidence([claim], [{
      id: 'file:retry', kind: 'implementation', label: 'retry.ts',
      content: 'CLAIM-001 add retry option', location: { source, path: 'retry.ts' },
    }])

    expect(associations).toHaveLength(1)
    expect(associations[0]?.strength).toBe('suggested')
  })
})
