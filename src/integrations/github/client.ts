import { z } from 'zod'
import type { OperationalLimits } from '../../config/limits'
import { DEFAULT_LIMITS } from '../../config/limits'
import type {
  CheckRunSummary,
  CommitChangeIdentity,
  CompareChangeIdentity,
  GitHubChangeSummary,
  GitHubRateLimit,
  PullRequestFile,
  PullRequestIdentity,
  PullRequestSummary,
  RepositoryIdentity,
  RepositoryTreeEntry,
} from './types'

const pullRequestSchema = z.object({
  title: z.string(),
  body: z.string().nullable(),
  html_url: z.string().url(),
  changed_files: z.number().int().nonnegative(),
  head: z.object({ sha: z.string() }),
})

const fileSchema = z.object({
  sha: z.string(), filename: z.string(), status: z.string(),
  additions: z.number(), deletions: z.number(), patch: z.string().optional(),
})

const commitSchema = z.object({
  sha: z.string(),
  html_url: z.string().url(),
  commit: z.object({ message: z.string() }),
  files: z.array(fileSchema),
})

const comparisonSchema = z.object({
  html_url: z.string().url(),
  ahead_by: z.number().int().nonnegative(),
  total_commits: z.number().int().nonnegative(),
  commits: z.array(z.object({
    sha: z.string(),
    commit: z.object({ message: z.string() }).optional(),
  })),
  files: z.array(fileSchema),
})

const treeSchema = z.object({
  truncated: z.boolean(),
  tree: z.array(z.object({
    path: z.string(), type: z.enum(['blob', 'tree']), sha: z.string(),
    size: z.number().optional(), url: z.string().url(),
  })),
})

const checksSchema = z.object({
  check_runs: z.array(z.object({
    id: z.number(), name: z.string(), status: z.string(),
    conclusion: z.string().nullable(), html_url: z.string().url().nullable(),
  })),
})

const contentSchema = z.object({
  type: z.literal('file'),
  path: z.string(),
  size: z.number().int().nonnegative(),
  encoding: z.literal('base64'),
  content: z.string(),
})

const RESPONSE_CACHE_FRESH_MS = 60_000

interface CachedResponse {
  value: unknown
  etag: string | null
  storedAt: number
}

interface InFlightRequest {
  signal: AbortSignal | undefined
  promise: Promise<unknown>
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimit: GitHubRateLimit,
  ) {
    super(message)
    this.name = 'GitHubApiError'
  }
}

function headerNumber(headers: Headers, name: string): number | null {
  const value = headers.get(name)
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function rateLimitFrom(headers: Headers): GitHubRateLimit {
  const reset = headerNumber(headers, 'x-ratelimit-reset')
  return {
    limit: headerNumber(headers, 'x-ratelimit-limit'),
    remaining: headerNumber(headers, 'x-ratelimit-remaining'),
    resetAt: reset === null ? null : new Date(reset * 1000),
  }
}

/** Browser-side client for bounded public GitHub REST reads with page-session caching. */
export class GitHubClient {
  private readonly fetcher: typeof fetch
  private readonly responseCache = new Map<string, CachedResponse>()
  private readonly inFlightRequests = new Map<string, InFlightRequest>()

  constructor(
    fetcher: typeof fetch = globalThis.fetch,
    private readonly limits: OperationalLimits = DEFAULT_LIMITS,
    private readonly accessToken?: string,
  ) {
    // Native browser fetch validates its receiver. Binding here prevents a
    // class-property call from accidentally supplying GitHubClient as `this`.
    this.fetcher = fetcher.bind(globalThis)
  }

  private async fetchResponse(
    path: string,
    cached: CachedResponse | undefined,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await this.fetcher(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}),
      },
      ...(signal ? { signal } : {}),
    })

    if (response.status === 304 && cached) {
      cached.storedAt = Date.now()
      return cached.value
    }

    if (!response.ok) {
      const message = response.status === 403 || response.status === 429
        ? 'GitHub rate limit reached. Try the bundled demo or local import.'
        : `GitHub request failed with status ${response.status}.`
      throw new GitHubApiError(message, response.status, rateLimitFrom(response.headers))
    }
    const value = await response.json() as unknown
    this.responseCache.set(path, {
      value,
      etag: response.headers.get('etag'),
      storedAt: Date.now(),
    })
    return value
  }

  private request(path: string, signal?: AbortSignal): Promise<unknown> {
    const cached = this.responseCache.get(path)
    if (cached && Date.now() - cached.storedAt < RESPONSE_CACHE_FRESH_MS) {
      return Promise.resolve(cached.value)
    }

    const inFlight = this.inFlightRequests.get(path)
    if (inFlight && inFlight.signal === signal) return inFlight.promise

    const promise = this.fetchResponse(path, cached, signal)
    this.inFlightRequests.set(path, { signal, promise })
    void promise.finally(() => {
      if (this.inFlightRequests.get(path)?.promise === promise) {
        this.inFlightRequests.delete(path)
      }
    }).catch(() => undefined)
    return promise
  }

  /** Retrieves normalized pull-request metadata. */
  async getPullRequest(identity: PullRequestIdentity, signal?: AbortSignal): Promise<PullRequestSummary> {
    const value = pullRequestSchema.parse(await this.request(
      `/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repository)}/pulls/${identity.number}`,
      signal,
    ))
    if (value.changed_files > this.limits.maxChangedFiles) {
      throw new Error(`This pull request changes ${value.changed_files} files; the configured limit is ${this.limits.maxChangedFiles}. Use local import with a narrower diff.`)
    }
    return {
      ...identity, title: value.title, body: value.body ?? '', htmlUrl: value.html_url,
      headSha: value.head.sha,
    }
  }

  /** Retrieves every changed file within the configured bound. */
  async listPullRequestFiles(identity: PullRequestIdentity, signal?: AbortSignal): Promise<PullRequestFile[]> {
    const files: PullRequestFile[] = []
    for (let page = 1; files.length < this.limits.maxChangedFiles; page += 1) {
      const batch = z.array(fileSchema).parse(await this.request(
        `/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repository)}/pulls/${identity.number}/files?per_page=100&page=${page}`,
        signal,
      ))
      files.push(...batch)
      if (batch.length < 100) break
    }
    if (files.length > this.limits.maxChangedFiles) {
      throw new Error(`Changed files exceed the configured limit of ${this.limits.maxChangedFiles}.`)
    }
    return files
  }

  /** Retrieves one public commit and its bounded changed-file patches. */
  async getCommitChange(identity: CommitChangeIdentity, signal?: AbortSignal): Promise<GitHubChangeSummary> {
    const pages = []
    for (let page = 1; ; page += 1) {
      const value = commitSchema.parse(await this.request(
        `/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repository)}/commits/${encodeURIComponent(identity.ref)}?per_page=100&page=${page}`,
        signal,
      ))
      pages.push(value)
      const observedFiles = pages.reduce((total, current) => total + current.files.length, 0)
      if (observedFiles > this.limits.maxChangedFiles) {
        throw new Error(`This commit changes more than ${this.limits.maxChangedFiles} files. Use local import with a narrower diff.`)
      }
      if (value.files.length < 100) break
    }
    const first = pages[0]
    if (!first) throw new Error('GitHub returned no commit data.')
    const files = pages.flatMap(({ files: pageFiles }) => pageFiles)
    return {
      title: first.commit.message.split('\n')[0] || `Commit ${first.sha.slice(0, 7)}`,
      body: first.commit.message,
      htmlUrl: first.html_url,
      headSha: first.sha,
      files,
    }
  }

  /** Retrieves a bounded public comparison between two repository refs. */
  async getComparison(identity: CompareChangeIdentity, signal?: AbortSignal): Promise<GitHubChangeSummary> {
    const basehead = `${encodeURIComponent(identity.base)}...${encodeURIComponent(identity.head)}`
    const value = comparisonSchema.parse(await this.request(
      `/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repository)}/compare/${basehead}`,
      signal,
    ))
    if (value.files.length > this.limits.maxChangedFiles) {
      throw new Error(`This comparison changes ${value.files.length} files; the configured limit is ${this.limits.maxChangedFiles}. Use local import with a narrower diff.`)
    }
    const headSha = value.commits.at(-1)?.sha
    if (!headSha || value.ahead_by === 0 || value.total_commits === 0) {
      throw new Error('The comparison contains no commits to analyze.')
    }
    return {
      title: `Compare ${identity.base}…${identity.head}`,
      body: value.commits
        .map(({ commit }) => commit?.message.split('\n')[0])
        .filter((message): message is string => Boolean(message))
        .map((message) => `- ${message}`)
        .join('\n'),
      htmlUrl: value.html_url,
      headSha,
      files: value.files,
    }
  }

  /** Retrieves a recursive repository tree for bounded candidate discovery. */
  async getRepositoryTree(identity: RepositoryIdentity, sha: string, signal?: AbortSignal): Promise<RepositoryTreeEntry[]> {
    const value = treeSchema.parse(await this.request(
      `/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repository)}/git/trees/${encodeURIComponent(sha)}?recursive=1`,
      signal,
    ))
    if (value.truncated) throw new Error('GitHub truncated the repository tree. Select a requirement file manually.')
    return value.tree
  }

  /** Retrieves available check runs for the pull request head commit. */
  async listCheckRuns(identity: RepositoryIdentity, sha: string, signal?: AbortSignal): Promise<CheckRunSummary[]> {
    const value = checksSchema.parse(await this.request(
      `/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repository)}/commits/${encodeURIComponent(sha)}/check-runs?per_page=100`,
      signal,
    ))
    return value.check_runs.map((check) => ({
      id: check.id, name: check.name, status: check.status,
      conclusion: check.conclusion, htmlUrl: check.html_url,
    }))
  }

  /** Retrieves and decodes one bounded UTF-8 repository text file. */
  async getTextFile(
    identity: RepositoryIdentity,
    path: string,
    sha: string,
    signal?: AbortSignal,
    maxBytes = this.limits.maxCandidateBytes,
  ): Promise<string> {
    const value = contentSchema.parse(await this.request(
      `/repos/${encodeURIComponent(identity.owner)}/${encodeURIComponent(identity.repository)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(sha)}`,
      signal,
    ))
    if (value.size > maxBytes) {
      throw new Error(`The requested text file exceeds the configured ${maxBytes}-byte limit.`)
    }
    const bytes = Uint8Array.from(atob(value.content.replaceAll('\n', '')), (character) => character.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
}
