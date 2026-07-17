import { describe, expect, it, vi } from 'vitest'
import { GitHubClient, GitHubApiError } from './client'
import { findLinkedIssues } from './issue-links'
import { parseGitHubChangeUrl } from './change-url'

describe('GitHub integration', () => {
  it('parses canonical public pull-request URLs', () => {
    expect(parseGitHubChangeUrl('https://github.com/openai/example/pull/42')).toEqual({
      kind: 'pull-request', owner: 'openai', repository: 'example', number: 42,
    })
    expect(() => parseGitHubChangeUrl('https://git.example.com/a/b/pull/1')).toThrow('Only public')
    expect(() => parseGitHubChangeUrl('https://github.com/a/b/issues/1')).toThrow('pull request, commit, or compare')
  })

  it('parses public commit and comparison URLs', () => {
    expect(parseGitHubChangeUrl('https://github.com/openai/example/commit/abcdef123456')).toEqual({
      kind: 'commit', owner: 'openai', repository: 'example', ref: 'abcdef123456',
    })
    expect(parseGitHubChangeUrl('https://github.com/openai/example/compare/main...feature%2Fevidence')).toEqual({
      kind: 'compare', owner: 'openai', repository: 'example', base: 'main', head: 'feature/evidence',
    })
    expect(() => parseGitHubChangeUrl('https://github.com/openai/example/compare/main..feature'))
      .toThrow('/compare/base...head')
  })

  it('classifies explicit, closing, and bare issue references', () => {
    const result = findLinkedIssues(
      'See https://github.com/acme/tool/issues/9. Fixes #12. Related #44.',
      { owner: 'acme', repository: 'tool' },
    )
    expect(result.map(({ number, confidence }) => [number, confidence])).toEqual([
      [9, 'automatic'], [12, 'automatic'], [44, 'confirmation-required'],
    ])
  })

  it('normalizes a public pull request and sends no authorization header', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      title: 'Evidence export', body: 'Fixes #12', html_url: 'https://github.com/acme/tool/pull/2',
      changed_files: 2, head: { sha: 'abc', ref: 'feature' }, base: { ref: 'main' },
    }), { status: 200 }))
    const client = new GitHubClient(fetcher)

    await expect(client.getPullRequest({ owner: 'acme', repository: 'tool', number: 2 }))
      .resolves.toMatchObject({ title: 'Evidence export', headSha: 'abc' })
    const request = fetcher.mock.calls[0]
    expect(request?.[1]?.headers).not.toHaveProperty('Authorization')
  })

  it('invokes browser fetch with the global receiver', async () => {
    const fetcher = function (this: unknown) {
      expect(this).toBe(globalThis)
      return Promise.resolve(new Response(JSON.stringify({
        title: 'Bound fetch', body: '', html_url: 'https://github.com/acme/tool/pull/2',
        changed_files: 0, head: { sha: 'abc', ref: 'feature' }, base: { ref: 'main' },
      }), { status: 200 }))
    } as typeof fetch

    await new GitHubClient(fetcher).getPullRequest({ owner: 'acme', repository: 'tool', number: 2 })

  })

  it('turns rate limiting into an actionable typed error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {
      status: 403,
      headers: { 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '0' },
    }))
    const client = new GitHubClient(fetcher)

    await expect(client.getPullRequest({ owner: 'acme', repository: 'tool', number: 2 }))
      .rejects.toMatchObject({ status: 403 } satisfies Partial<GitHubApiError>)
  })

  it('uses an optional session token without changing anonymous requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      title: 'Authenticated read', body: '', html_url: 'https://github.com/acme/tool/pull/2',
      changed_files: 0, head: { sha: 'abc' },
    }), { status: 200 }))
    const token = ['github', 'session', 'token'].join('-')

    await new GitHubClient(fetcher, undefined, token)
      .getPullRequest({ owner: 'acme', repository: 'tool', number: 2 })

    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: `Bearer ${token}` })
  })

  it('reuses a fresh response from the page-session cache', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      title: 'Cached read', body: '', html_url: 'https://github.com/acme/tool/pull/2',
      changed_files: 0, head: { sha: 'abc' },
    }), { status: 200, headers: { etag: '"cached"' } }))
    const client = new GitHubClient(fetcher)
    const identity = { owner: 'acme', repository: 'tool', number: 2 }

    await client.getPullRequest(identity)
    await client.getPullRequest(identity)

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('deduplicates matching requests while the first request is in flight', async () => {
    let resolveResponse: ((response: Response) => void) | undefined
    const pendingResponse = new Promise<Response>((resolve) => { resolveResponse = resolve })
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pendingResponse)
    const client = new GitHubClient(fetcher)
    const identity = { owner: 'acme', repository: 'tool', number: 2 }

    const first = client.getPullRequest(identity)
    const second = client.getPullRequest(identity)
    expect(fetcher).toHaveBeenCalledTimes(1)

    resolveResponse?.(new Response(JSON.stringify({
      title: 'Shared read', body: '', html_url: 'https://github.com/acme/tool/pull/2',
      changed_files: 0, head: { sha: 'abc' },
    }), { status: 200 }))

    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
  })

  it('revalidates stale cached responses with an ETag', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0)
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        title: 'Conditional read', body: '', html_url: 'https://github.com/acme/tool/pull/2',
        changed_files: 0, head: { sha: 'abc' },
      }), { status: 200, headers: { etag: '"revision-1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
    const client = new GitHubClient(fetcher)
    const identity = { owner: 'acme', repository: 'tool', number: 2 }

    await client.getPullRequest(identity)
    now.mockReturnValue(60_001)
    await expect(client.getPullRequest(identity)).resolves.toMatchObject({ title: 'Conditional read' })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({ 'If-None-Match': '"revision-1"' })
  })
})
