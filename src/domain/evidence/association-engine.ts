import type {
  EvidenceArtifact,
  EvidenceAssociation,
  Requirement,
} from './types'

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

/** Creates deterministic, explainable associations between requirements and artifacts. */
export function associateEvidence(
  requirements: Requirement[],
  artifacts: EvidenceArtifact[],
): EvidenceAssociation[] {
  const associations: EvidenceAssociation[] = []

  for (const requirement of requirements) {
    const idPattern = new RegExp(`\\b${escapeRegex(requirement.id)}\\b`, 'i')

    for (const artifact of artifacts) {
      const exactMatch = requirement.identifierOrigin === 'source'
        ? artifact.content.match(idPattern)
        : null
      if (exactMatch) {
        associations.push({
          requirementId: requirement.id,
          artifactId: artifact.id,
          strength: 'strong',
          rule: 'exact-requirement-id',
          matchedText: [exactMatch[0]],
          location: artifact.location,
        })
        continue
      }

      const matchedTerms = suggestionMatches(requirement, artifact.content)
      if (matchedTerms.length) {
        associations.push({
          requirementId: requirement.id,
          artifactId: artifact.id,
          strength: 'suggested',
          rule: 'phrase-overlap',
          matchedText: matchedTerms,
          location: artifact.location,
        })
      }
    }
  }

  return associations
}
