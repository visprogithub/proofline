import type { GitHubChangeIdentity } from './types'

const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/
const COMMIT_PATH = /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})\/?$/i
const COMPARE_PATH = /^\/([^/]+)\/([^/]+)\/compare\/(.+)$/

function decodeRef(value: string): string {
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    throw new Error('The GitHub comparison contains an invalid encoded ref.')
  }
  const hasControlCharacter = Array.from(decoded).some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
  if (!decoded || decoded.length > 200 || hasControlCharacter) {
    throw new Error('The GitHub comparison contains an invalid ref.')
  }
  return decoded
}

/** Parses canonical public GitHub pull-request, commit, and compare URLs. */
export function parseGitHubChangeUrl(value: string): GitHubChangeIdentity {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Enter a complete public GitHub pull request, commit, or compare URL.')
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') {
    throw new Error('Only public https://github.com URLs are supported.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Remove credentials, query parameters, and fragments from the GitHub URL.')
  }

  const pullRequest = PR_PATH.exec(url.pathname)
  if (pullRequest?.[1] && pullRequest[2] && pullRequest[3]) {
    const number = Number(pullRequest[3])
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new Error('The pull-request number is invalid.')
    }
    return {
      kind: 'pull-request', owner: pullRequest[1], repository: pullRequest[2], number,
    }
  }

  const commit = COMMIT_PATH.exec(url.pathname)
  if (commit?.[1] && commit[2] && commit[3]) {
    return { kind: 'commit', owner: commit[1], repository: commit[2], ref: commit[3] }
  }

  const comparison = COMPARE_PATH.exec(url.pathname)
  if (comparison?.[1] && comparison[2] && comparison[3]) {
    const delimiter = comparison[3].indexOf('...')
    if (delimiter < 1 || comparison[3].indexOf('...', delimiter + 3) !== -1) {
      throw new Error('Use a GitHub compare URL in the form /compare/base...head.')
    }
    const base = decodeRef(comparison[3].slice(0, delimiter))
    const head = decodeRef(comparison[3].slice(delimiter + 3).replace(/\/$/, ''))
    return { kind: 'compare', owner: comparison[1], repository: comparison[2], base, head }
  }

  throw new Error('Use a GitHub pull request, commit, or compare URL.')
}
