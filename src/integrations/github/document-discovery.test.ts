import { describe, expect, it, vi } from 'vitest'
import { discoverRequirementDocuments } from './document-discovery'
import type { RepositoryTreeEntry } from './types'
import { createOperationalLimits } from '../../config/limits'

function blob(path: string, size = 100): RepositoryTreeEntry {
  return { path, size, sha: path, type: 'blob', url: `https://api.github.test/${path}` }
}

describe('requirement document discovery', () => {
  it('selects a uniquely ranked document and explains why', async () => {
    const read = vi.fn((path: string) => Promise.resolve(path === 'specs/feature-requirements.md'
      ? '# Requirements\n## REQ-101: Export\n## REQ-102: Reset'
      : '# Project\nNothing to see'))
    const result = await discoverRequirementDocuments([
      blob('README.md'), blob('specs/feature-requirements.md'), blob('src/app.ts', 80),
    ], read)

    expect(result.selected?.path).toBe('specs/feature-requirements.md')
    expect(result.selected?.reasons).toContain('2 stable requirement IDs')
    expect(read).toHaveBeenCalledTimes(1)
    expect(read).not.toHaveBeenCalledWith('README.md')
  })

  it('does not silently select tied candidates', async () => {
    const result = await discoverRequirementDocuments([
      blob('docs/a-spec.md'), blob('docs/b-spec.md'),
    ], () => Promise.resolve('## REQ-101: Same'))

    expect(result.ambiguous).toBe(true)
    expect(result.selected).toBeNull()
  })

  it('enforces candidate count and document size before fetching', async () => {
    const read = vi.fn(() => Promise.resolve('## REQ-101: Bounded'))
    await discoverRequirementDocuments([
      blob('docs/too-large-spec.md', 300_000),
      blob('docs/a-spec.md'), blob('docs/b-spec.md'),
    ], read, createOperationalLimits({ maxRequirementCandidates: 1 }))

    expect(read).toHaveBeenCalledTimes(1)
    expect(read).toHaveBeenCalledWith('docs/a-spec.md')
  })

  it('continues to the next path tier when a stronger path has no requirement IDs', async () => {
    const read = vi.fn((path: string) => Promise.resolve(path === 'specs/design.md'
      ? '# Design\nNo stable identifiers here.'
      : '# Project requirements\nREQ-201: Preserve exports'))

    const result = await discoverRequirementDocuments([
      blob('specs/design.md'), blob('README.md'),
    ], read)

    expect(read).toHaveBeenCalledTimes(2)
    expect(result.selected?.path).toBe('README.md')
  })

  it('does not mistake a requirement heading for a stable requirement ID', async () => {
    const read = vi.fn(() => Promise.resolve('# Requirements\nWrite useful software.'))

    const result = await discoverRequirementDocuments([blob('requirements.md')], read)

    expect(result.selected).toBeNull()
    expect(result.ambiguous).toBe(false)
  })
})
