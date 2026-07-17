import type {
  EvidenceArtifact,
  EvidenceAssociation,
  EvidenceState,
  Requirement,
  RequirementEvidence,
} from './types'

function stateExplanation(state: EvidenceState): string {
  const explanations: Record<EvidenceState, string> = {
    'test-evidence-found': 'Exact requirement IDs link implementation artifacts and passing test evidence.',
    'implementation-evidence-only': 'An exact requirement ID appears in implementation evidence, but no linked passing test was found.',
    'failing-test-evidence': 'At least one exact-ID-linked test reports a failure.',
    'no-evidence-found': 'No exact or suggested associations were found in the analyzed artifacts.',
    'suggested-evidence-found': 'One or more artifacts share meaningful terms with this declared claim. This is supporting signal, not verified requirement evidence.',
    'ambiguous-evidence': 'Only suggested associations were found, or the available signals are inconclusive.',
  }
  return explanations[state]
}

/** Derives neutral evidence states from explicit association and outcome rules. */
export function deriveRequirementEvidence(
  requirements: Requirement[],
  artifacts: EvidenceArtifact[],
  associations: EvidenceAssociation[],
): RequirementEvidence[] {
  const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]))

  return requirements.map((requirement) => {
    const related = associations.filter(({ requirementId }) => requirementId === requirement.id)
    const relatedArtifacts = related
      .map(({ artifactId }) => artifactById.get(artifactId))
      .filter((artifact): artifact is EvidenceArtifact => Boolean(artifact))
    const strongIds = new Set(
      related.filter(({ strength }) => strength === 'strong').map(({ artifactId }) => artifactId),
    )
    const strongArtifacts = relatedArtifacts.filter(({ id }) => strongIds.has(id))
    const implementation = strongArtifacts.some(({ kind }) => kind === 'implementation')
    const passingTest = strongArtifacts.some(
      ({ kind, outcome }) => kind === 'test' && outcome === 'passed',
    )
    const failingTest = strongArtifacts.some(
      ({ kind, outcome }) => kind === 'test' && outcome === 'failed',
    )

    let state: EvidenceState
    if (failingTest) state = 'failing-test-evidence'
    else if (implementation && passingTest) state = 'test-evidence-found'
    else if (implementation) state = 'implementation-evidence-only'
    else if (related.length) {
      state = requirement.identifierOrigin === 'generated'
        ? 'suggested-evidence-found'
        : 'ambiguous-evidence'
    }
    else state = 'no-evidence-found'

    return {
      requirement,
      state,
      associations: related,
      artifacts: relatedArtifacts,
      explanation: stateExplanation(state),
    }
  })
}
