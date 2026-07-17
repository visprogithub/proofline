import { describe, expect, it } from 'vitest'
import { classifyLocalFile, readLocalBundle, readLocalTextFile } from './file-import'
import { createOperationalLimits } from '../../config/limits'

describe('local file import', () => {
  it('classifies supported requirement, diff, and JUnit files', () => {
    expect(classifyLocalFile({ name: 'requirements.md' })).toBe('requirements')
    expect(classifyLocalFile({ name: 'feature.patch' })).toBe('diff')
    expect(classifyLocalFile({ name: 'junit.xml' })).toBe('junit')
    expect(classifyLocalFile({ name: 'archive.zip' })).toBeNull()
  })

  it('reads supported text without persistence', async () => {
    const file = new File(['## REQ-101: Export'], 'requirements.md', { type: 'text/markdown' })
    await expect(readLocalTextFile(file)).resolves.toEqual({
      kind: 'requirements', name: 'requirements.md', text: '## REQ-101: Export',
    })
  })

  it('rejects oversized and duplicate-role inputs', async () => {
    const large = new File(['oversized'], 'requirements.md')
    await expect(readLocalTextFile(large, createOperationalLimits({
      maxLocalImportBytes: 2,
    }))).rejects.toThrow('2 bytes')

    await expect(readLocalBundle([
      new File(['one'], 'one.md'), new File(['two'], 'two.txt'),
    ])).rejects.toThrow('only one requirements')
  })
})
