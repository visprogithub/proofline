import { describe, expect, it, vi } from 'vitest'
import { GitHubClient } from '../../integrations/github/client'
import { analyzeGitHubChange } from './analyze-github'

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200 })
}

describe('public GitHub analysis', () => {
  it('discovers repository requirements and runs the real evidence domains', async () => {
    const specification = btoa('## REQ-101: Export reports')
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        title: 'Add export', body: '', html_url: 'https://github.com/acme/tool/pull/2',
        changed_files: 1, head: { sha: 'abc', ref: 'feature' }, base: { ref: 'main' },
      }))
      .mockResolvedValueOnce(jsonResponse([{
        sha: 'file', filename: 'src/export.ts', status: 'modified', additions: 1, deletions: 0,
        patch: '@@ -1,1 +1,2 @@\n old\n+exportReport() // REQ-101',
      }]))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [{
        id: 7, name: 'REQ-101 report test', status: 'completed', conclusion: 'success', html_url: null,
      }] }))
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: [{
        path: 'docs/requirements.md', type: 'blob', sha: 'spec', size: 28,
        url: 'https://api.github.com/spec',
      }] }))
      .mockResolvedValueOnce(jsonResponse({
        type: 'file', path: 'docs/requirements.md', size: 28,
        encoding: 'base64', content: specification,
      }))

    const result = await analyzeGitHubChange(
      'https://github.com/acme/tool/pull/2', new GitHubClient(fetcher),
    )

    expect(result.evidence.sourceLabel).toBe('docs/requirements.md')
    expect(result.evidence.requirements[0]?.state).toBe('test-evidence-found')
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('analyzes a single public commit without requiring a pull request', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        sha: 'abcdef1234567890', html_url: 'https://github.com/acme/tool/commit/abcdef1234567890',
        commit: { message: 'REQ-201: Analyze individual commits' },
        files: [{
          sha: 'file', filename: 'src/commit.ts', status: 'modified', additions: 1, deletions: 0,
          patch: '@@ -1,1 +1,2 @@\n old\n+analyzeCommit() // REQ-201',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [{
        id: 8, name: 'REQ-201 commit test', status: 'completed', conclusion: 'success', html_url: null,
      }] }))

    const result = await analyzeGitHubChange(
      'https://github.com/acme/tool/commit/abcdef1234567890', new GitHubClient(fetcher),
    )

    expect(result.evidence.sourceLabel).toBe('Commit abcdef1 message')
    expect(result.evidence.requirements[0]?.state).toBe('test-evidence-found')
    expect(result.changeLabel).toBe('Open commit')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('analyzes a public comparison and discovers requirements at its head', async () => {
    const specification = btoa('## REQ-301: Analyze comparisons')
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        html_url: 'https://github.com/acme/tool/compare/main...feature',
        ahead_by: 1, total_commits: 1, commits: [{ sha: 'head123456789' }],
        files: [{
          sha: 'file', filename: 'src/compare.ts', status: 'added', additions: 1, deletions: 0,
          patch: '@@ -0,0 +1 @@\n+compareChanges() // REQ-301',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: [{
        path: 'specs/requirements.md', type: 'blob', sha: 'spec', size: 33,
        url: 'https://api.github.com/spec',
      }] }))
      .mockResolvedValueOnce(jsonResponse({
        type: 'file', path: 'specs/requirements.md', size: 33,
        encoding: 'base64', content: specification,
      }))

    const result = await analyzeGitHubChange(
      'https://github.com/acme/tool/compare/main...feature', new GitHubClient(fetcher),
    )

    expect(result.title).toBe('Compare main…feature')
    expect(result.evidence.sourceLabel).toBe('specs/requirements.md')
    expect(result.evidence.requirements[0]?.state).toBe('implementation-evidence-only')
    expect(result.changeLabel).toBe('Open comparison')
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  it('falls back to declared PR change claims when no formal IDs exist', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        title: 'Add retry action',
        body: '### Changes\n- Show a retry button on load failure\n\n### Testing\n- Manual verification',
        html_url: 'https://github.com/acme/tool/pull/9', changed_files: 1,
        head: { sha: 'claimhead', ref: 'feature' }, base: { ref: 'main' },
      }))
      .mockResolvedValueOnce(jsonResponse([{
        sha: 'file', filename: 'src/retry.ts', status: 'modified', additions: 1, deletions: 0,
        patch: '@@ -1 +1 @@\n+show retry button on load failure',
      }]))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: [] }))

    const result = await analyzeGitHubChange(
      'https://github.com/acme/tool/pull/9', new GitHubClient(fetcher),
    )

    expect(result.analysisBasis).toBe('declared-claims')
    expect(result.evidence.requirements[0]?.requirement).toMatchObject({
      id: 'CLAIM-001', identifierOrigin: 'generated', title: 'Show a retry button on load failure',
    })
    expect(result.evidence.requirements[0]?.state).toBe('suggested-evidence-found')
  })

  it('falls back to the commit subject as a declared claim', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        sha: '866ed8cc7e2543368c676c05540d71d7ef29b668',
        html_url: 'https://github.com/acme/tool/commit/866ed8cc7e2543368c676c05540d71d7ef29b668',
        commit: { message: 'feat: enhance backend loading experience with informative UI and retry option' },
        files: [{
          sha: 'file', filename: 'src/loading.ts', status: 'modified', additions: 2, deletions: 0,
          patch: '@@ -1 +1,2 @@\n+backend loading status\n+show retry option',
        }],
      }))
      .mockResolvedValueOnce(jsonResponse({ check_runs: [] }))
      .mockResolvedValueOnce(jsonResponse({ truncated: false, tree: [] }))

    const result = await analyzeGitHubChange(
      'https://github.com/acme/tool/commit/866ed8cc7e2543368c676c05540d71d7ef29b668',
      new GitHubClient(fetcher),
    )

    expect(result.analysisBasis).toBe('declared-claims')
    expect(result.evidence.requirements[0]?.requirement.title).toContain('enhance backend loading')
    expect(result.evidence.requirements[0]?.state).toBe('suggested-evidence-found')
  })
})
