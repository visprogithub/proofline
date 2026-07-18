import { describe, expect, it } from 'vitest'
import { classifyLocalFile, readLocalBundle, readLocalTextFile } from './file-import'
import { createOperationalLimits } from '../../config/limits'

describe('local file import', () => {
  it('PL-104 classifies supported requirement, diff, and JUnit files', () => {
    expect(classifyLocalFile({ name: 'requirements.md' })).toBe('requirements')
    expect(classifyLocalFile({ name: 'feature.patch' })).toBe('diff')
    expect(classifyLocalFile({ name: 'junit.xml' })).toBe('junit')
    expect(classifyLocalFile({ name: 'archive.zip' })).toBeNull()
  })

  it('PL-601 reads supported text without persistence', async () => {
    const file = new File(['## REQ-101: Export'], 'requirements.md', { type: 'text/markdown' })
    await expect(readLocalTextFile(file)).resolves.toEqual({
      kind: 'requirements', name: 'requirements.md', text: '## REQ-101: Export',
    })
  })

  it('PL-104 assembles requirements and diff files selected in separate controls', async () => {
    await expect(readLocalBundle([
      new File(['## REQ-101: Export'], 'requirements.md'),
      new File(['diff --git a/a.ts b/a.ts'], 'change.patch'),
    ])).resolves.toEqual({
      requirements: { name: 'requirements.md', text: '## REQ-101: Export' },
      diff: { name: 'change.patch', text: 'diff --git a/a.ts b/a.ts' },
    })
  })

  it('PL-104 PL-203 rejects oversized and duplicate-role inputs', async () => {
    const large = new File(['oversized'], 'requirements.md')
    await expect(readLocalTextFile(large, createOperationalLimits({
      maxLocalImportBytes: 2,
    }))).rejects.toThrow('2 bytes')

    await expect(readLocalBundle([
      new File(['one'], 'one.md'), new File(['two'], 'two.txt'),
    ])).rejects.toThrow('only one requirements')
  })
})
