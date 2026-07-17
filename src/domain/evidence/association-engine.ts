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

function normalizedTerms(requirement: Requirement): string[] {
  return Array.from(new Set(
    `${requirement.title} ${requirement.acceptanceCriteria.join(' ')}`
      .toLowerCase()
      .match(/[a-z][a-z0-9-]{3,}/g)
      ?.filter((term) => !STOP_WORDS.has(term)) ?? [],
  ))
}

function suggestionMatches(requirement: Requirement, content: string): string[] {
  const lowerContent = content.toLowerCase()
  const terms = normalizedTerms(requirement)
  const matches = terms.filter((term) => lowerContent.includes(term))
  const threshold = Math.max(2, Math.ceil(terms.length * 0.35))
  return matches.length >= threshold ? matches : []
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
