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

  it('extracts package and version claims from dependency update tables', () => {
    const claims = parseDeclaredChangeClaims(`
Bumps the dependency group with two updates:

| Package | From | To |
| --- | --- | --- |
| [@ai-sdk/react](https://example.test/react) | 4.0.23 | 4.0.24 |
| dompurify | 3.4.11 | 3.4.12 |
`, 'Bump dependency group', source)

    expect(claims.map(({ title }) => title)).toEqual([
      'Update @ai-sdk/react from 4.0.23 to 4.0.24',
      'Update dompurify from 3.4.11 to 3.4.12',
    ])

    const associations = associateEvidence(claims, [{
      id: 'file:package.json', kind: 'implementation', label: 'package.json',
      content: '- "@ai-sdk/react": "4.0.23"\n+ "@ai-sdk/react": "4.0.24"',
      location: { source, path: 'package.json' },
    }])
    expect(associations[0]).toMatchObject({
      requirementId: 'CLAIM-001', strength: 'suggested', rule: 'phrase-overlap',
    })
    expect(associations[0]?.matchedText).toEqual(
      expect.arrayContaining(['ai-sdk', 'react', '4.0.23', '4.0.24']),
    )

    const sameVersionsForAnotherPackage = associateEvidence([claims[1]!], [{
      id: 'file:other', kind: 'implementation', label: 'package.json',
      content: '- "unrelated": "3.4.11"\n+ "unrelated": "3.4.12"',
      location: { source, path: 'package.json' },
    }])
    expect(sameVersionsForAnotherPackage).toEqual([])
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
