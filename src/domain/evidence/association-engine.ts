import type {
  EvidenceArtifact,
  EvidenceAssociation,
  Requirement,
} from './types'
import { findEvidenceHunk } from './diff-evidence'

const STOP_WORDS = new Set([
  'about', 'after', 'before', 'from', 'have', 'into', 'must', 'should', 'that',
  'their', 'this', 'through', 'user', 'when', 'where', 'with', 'without',
])

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizedTerms(requirement: Requirement): { words: string[]; versions: string[] } {
  const text = `${requirement.title} ${requirement.acceptanceCriteria.join(' ')}`.toLowerCase()
  const words = text.match(/[a-z][a-z0-9-]{3,}/g)
    ?.filter((term) => !STOP_WORDS.has(term)) ?? []
  const versions = text.match(/\b\d+(?:\.\d+){1,3}(?:-[a-z0-9.-]+)?\b/g) ?? []
  return {
    words: Array.from(new Set(words)),
    versions: Array.from(new Set(versions)),
  }
}

function suggestionMatches(requirement: Requirement, content: string): string[] {
  const lowerContent = content.toLowerCase()
  const terms = normalizedTerms(requirement)
  const wordMatches = terms.words.filter((term) => lowerContent.includes(term))
  const versionMatches = terms.versions.filter((term) => lowerContent.includes(term))
  const threshold = Math.max(2, Math.ceil(terms.words.length * 0.35))
  const enoughSemanticTerms = wordMatches.length >= threshold
  const versionCorroboratedTerm = wordMatches.length >= 1 && versionMatches.length >= 1
  return enoughSemanticTerms || versionCorroboratedTerm
    ? [...wordMatches, ...versionMatches]
    : []
}

function suggestionDiffProvenance(
  artifact: EvidenceArtifact,
  matchedTerms: string[],
): Pick<EvidenceAssociation, 'matchedLine' | 'hunkId'> {
  if (!artifact.diff || artifact.diff.availability !== 'available') return {}
  const ranked = artifact.diff.hunks.map((hunk) => {
    const activeLines = hunk.lines.filter(({ change }) => change !== 'deleted')
    const content = activeLines.map((line) => line.content.toLowerCase()).join('\n')
    const score = matchedTerms.filter((term) => content.includes(term.toLowerCase())).length
    const matchedLine = activeLines
      .map((line) => ({
        line,
        score: matchedTerms.filter((term) => line.content.toLowerCase().includes(term.toLowerCase())).length,
      }))
      .sort((left, right) => right.score - left.score)[0]
    return { hunk, score, matchedLine }
  }).sort((left, right) => right.score - left.score)
  const best = ranked[0]
  if (!best || best.score === 0 || !best.matchedLine || best.matchedLine.score === 0) return {}
  return { hunkId: best.hunk.id, matchedLine: best.matchedLine.line }
}

function exactDiffAssociation(
  requirementId: string,
  artifact: EvidenceArtifact,
): Pick<EvidenceAssociation, 'strength' | 'rule' | 'matchedText' | 'matchedLine' | 'hunkId'> | null {
  if (!artifact.diff || artifact.diff.availability !== 'available') return null
  const pattern = new RegExp(`\\b${escapeRegex(requirementId)}\\b`, 'i')
  const lines = artifact.diff.hunks.flatMap(({ lines: hunkLines }) => hunkLines)
  const orderedChanges = ['added', 'context', 'deleted'] as const
  for (const change of orderedChanges) {
    const line = lines.find((candidate) => candidate.change === change && pattern.test(candidate.content))
    if (!line) continue
    const hunk = findEvidenceHunk(artifact.diff, line.id)
    return {
      strength: change === 'added' ? 'strong' : 'suggested',
      rule: change === 'added'
        ? 'exact-requirement-id'
        : change === 'context'
          ? 'exact-requirement-id-context'
          : 'removed-requirement-id',
      matchedText: [line.content.match(pattern)?.[0] ?? requirementId],
      matchedLine: line,
      ...(hunk ? { hunkId: hunk.id } : {}),
    }
  }
  return null
}

/** Creates deterministic, explainable associations between requirements and artifacts. */
export function associateEvidence(
  requirements: Requirement[],
  artifacts: EvidenceArtifact[],
): EvidenceAssociation[] {
  const associations: EvidenceAssociation[] = []

  for (const requirement of requirements) {
    const idPattern = new RegExp(`\\b${escapeRegex(requirement.id)}\\b`, 'i')

    for (const artifact of artifacts) {
      const diffMatch = requirement.identifierOrigin === 'source'
        ? exactDiffAssociation(requirement.id, artifact)
        : null
      const exactMatch = !artifact.diff && requirement.identifierOrigin === 'source'
        ? artifact.content.match(idPattern)
        : null
      if (diffMatch || exactMatch) {
        associations.push({
          requirementId: requirement.id,
          artifactId: artifact.id,
          strength: diffMatch?.strength ?? 'strong',
          rule: diffMatch?.rule ?? 'exact-requirement-id',
          matchedText: diffMatch?.matchedText ?? [exactMatch?.[0] ?? requirement.id],
          location: artifact.location,
          ...(diffMatch?.matchedLine ? { matchedLine: diffMatch.matchedLine } : {}),
          ...(diffMatch?.hunkId ? { hunkId: diffMatch.hunkId } : {}),
        })
        continue
      }

      const matchedTerms = suggestionMatches(requirement, artifact.content)
      if (matchedTerms.length) {
        const diffProvenance = suggestionDiffProvenance(artifact, matchedTerms)
        associations.push({
          requirementId: requirement.id,
          artifactId: artifact.id,
          strength: 'suggested',
          rule: 'phrase-overlap',
          matchedText: matchedTerms,
          location: artifact.location,
          ...diffProvenance,
        })
      }
    }
  }

  return associations
}
