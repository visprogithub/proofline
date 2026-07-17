export interface RepositoryIdentity {
  owner: string
  repository: string
}

export interface PullRequestIdentity extends RepositoryIdentity {
  number: number
}

export interface PullRequestChangeIdentity extends PullRequestIdentity {
  kind: 'pull-request'
}

export interface CommitChangeIdentity extends RepositoryIdentity {
  kind: 'commit'
  ref: string
}

export interface CompareChangeIdentity extends RepositoryIdentity {
  kind: 'compare'
  base: string
  head: string
}

export type GitHubChangeIdentity =
  | PullRequestChangeIdentity
  | CommitChangeIdentity
  | CompareChangeIdentity

export interface PullRequestSummary extends PullRequestIdentity {
  title: string
  body: string
  htmlUrl: string
  headSha: string
}

export interface PullRequestFile {
  sha: string
  filename: string
  status: string
  additions: number
  deletions: number
  patch?: string | undefined
}

export interface GitHubChangeSummary {
  title: string
  body: string
  htmlUrl: string
  headSha: string
  files: PullRequestFile[]
}

export interface RepositoryTreeEntry {
  path: string
  type: 'blob' | 'tree'
  sha: string
  size?: number | undefined
  url: string
}

export interface CheckRunSummary {
  id: number
  name: string
  status: string
  conclusion: string | null
  htmlUrl: string | null
}

export interface GitHubRateLimit {
  limit: number | null
  remaining: number | null
  resetAt: Date | null
}
