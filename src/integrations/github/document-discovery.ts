import type { OperationalLimits } from '../../config/limits'
import { DEFAULT_LIMITS } from '../../config/limits'
import type { RepositoryTreeEntry } from './types'

const TEXT_EXTENSION = /\.(?:md|mdx|txt|rst|adoc)$/i
const NAME_SIGNAL = /(?:requirements?|specification|spec|prd|rfc|stories|acceptance|criteria|design|proposal)/i
const DIRECTORY_SIGNAL = /(?:^|\/)(?:docs?|specs?|planning|requirements?|rfcs?|design)(?:\/|$)/i
const REQUIREMENT_ID = /\b[A-Z][A-Z0-9_-]{1,15}-\d{1,8}\b/g

export interface RequirementDocumentCandidate {
  path: string
  sha: string
  size: number
  pathScore: number
  contentScore: number
  totalScore: number
  requirementIdCount: number
  reasons: string[]
  content: string
}

export interface RequirementDocumentDiscovery {
  candidates: RequirementDocumentCandidate[]
  selected: RequirementDocumentCandidate | null
  ambiguous: boolean
}

function rankPath(entry: RepositoryTreeEntry): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const filename = entry.path.split('/').at(-1) ?? entry.path

  if (NAME_SIGNAL.test(filename)) {
    score += 5
    reasons.push('requirement-like filename')
  }
  if (DIRECTORY_SIGNAL.test(entry.path)) {
    score += 3
    reasons.push('planning or documentation directory')
  }
  if (/readme/i.test(filename)) {
    score += 1
    reasons.push('repository overview document')
  }
  return { score, reasons }
}

function rankContent(content: string): { score: number; requirementIdCount: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const ids = new Set(content.match(REQUIREMENT_ID) ?? [])
  if (ids.size) {
    score += Math.min(8, ids.size * 2)
    reasons.push(`${ids.size} stable requirement ID${ids.size === 1 ? '' : 's'}`)
  }
  if (/^#{1,6}\s+(?:requirements?|acceptance criteria|user stories)/im.test(content)) {
    score += 3
    reasons.push('requirement-oriented heading')
  }
  return { score, requirementIdCount: ids.size, reasons }
}

/**
 * Ranks bounded repository text documents, then progressively inspects path-score
 * tiers until one contains a uniquely ranked document with requirement IDs.
 */
export async function discoverRequirementDocuments(
  tree: RepositoryTreeEntry[],
  readContent: (path: string) => Promise<string>,
  limits: OperationalLimits = DEFAULT_LIMITS,
): Promise<RequirementDocumentDiscovery> {
  const pathCandidates = tree
    .filter((entry) => entry.type === 'blob'
      && TEXT_EXTENSION.test(entry.path)
      && typeof entry.size === 'number'
      && entry.size <= limits.maxCandidateBytes)
    .map((entry) => ({ entry, ranking: rankPath(entry) }))
    .filter(({ ranking }) => ranking.score > 0)
    .sort((left, right) => right.ranking.score - left.ranking.score
      || left.entry.path.localeCompare(right.entry.path))
    .slice(0, limits.maxRequirementCandidates)

  const candidates: RequirementDocumentCandidate[] = []
  let selected: RequirementDocumentCandidate | null = null
  let ambiguous = false
  let cursor = 0

  while (cursor < pathCandidates.length) {
    const tierScore = pathCandidates[cursor]?.ranking.score
    const tier = []
    while (cursor < pathCandidates.length && pathCandidates[cursor]?.ranking.score === tierScore) {
      const candidate = pathCandidates[cursor]
      if (candidate) tier.push(candidate)
      cursor += 1
    }

    const inspected = await Promise.all(tier.map(async ({ entry, ranking }) => {
      const content = await readContent(entry.path)
      const contentRanking = rankContent(content)
      return {
        path: entry.path,
        sha: entry.sha,
        size: entry.size ?? 0,
        pathScore: ranking.score,
        contentScore: contentRanking.score,
        totalScore: ranking.score + contentRanking.score,
        requirementIdCount: contentRanking.requirementIdCount,
        reasons: [...ranking.reasons, ...contentRanking.reasons],
        content,
      }
    }))
    candidates.push(...inspected)

    const formalCandidates = inspected
      .filter(({ requirementIdCount }) => requirementIdCount > 0)
      .sort((left, right) => right.totalScore - left.totalScore
        || left.path.localeCompare(right.path))
    const first = formalCandidates[0] ?? null
    const second = formalCandidates[1] ?? null
    if (first) {
      ambiguous = Boolean(second && first.totalScore === second.totalScore)
      selected = ambiguous ? null : first
      break
    }
  }

  candidates.sort((left, right) => right.totalScore - left.totalScore
    || left.path.localeCompare(right.path))

  return {
    candidates,
    selected,
    ambiguous,
  }
}
