import type { AnalysisResult, EvidenceState } from './types'

const STATE_LABELS: Record<EvidenceState, string> = {
  'test-evidence-found': 'Test evidence found',
  'implementation-evidence-only': 'Implementation evidence only',
  'failing-test-evidence': 'Failing test evidence',
  'no-evidence-found': 'No evidence found',
  'suggested-evidence-found': 'Suggested evidence found',
  'ambiguous-evidence': 'Ambiguous evidence',
}

/** Serializes an internally produced, versioned analysis result as formatted JSON. */
export function serializeJsonReport(result: AnalysisResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}

/** Serializes a human-readable evidence report suitable for repository review. */
export function serializeMarkdownReport(result: AnalysisResult): string {
  const counts = Object.fromEntries(
    Object.keys(STATE_LABELS).map((state) => [
      state,
      result.requirements.filter((item) => item.state === state).length,
    ]),
  )

  const sections = result.requirements.map((item) => {
    const evidence = item.associations.length
      ? item.associations.map((association) =>
          `- ${association.strength}: ${association.rule} — ${association.matchedText.join(', ')}`,
        ).join('\n')
      : '- No associated artifacts.'
    const advisory = item.associations
      .filter((association) => association.advisory)
      .map((association) => {
        const assessment = association.advisory
        if (!assessment) return ''
        const outcome = assessment.status === 'assessed'
          ? `${assessment.verdict ?? 'not assessed'} — ${assessment.rationale ?? 'No rationale returned.'}`
          : `not assessed — ${assessment.reason?.replaceAll('-', ' ') ?? 'unavailable'}`
        const provider = assessment.provenance
          ? ` (${assessment.provenance.providerId} / ${assessment.provenance.modelId}; advisory only)`
          : ''
        return `- ${association.artifactId}: ${outcome}${provider}`
      })
      .filter(Boolean)
    const advisorySection = advisory.length
      ? `\n\n### Advisory model assessments\n\n${advisory.join('\n')}`
      : ''
    return `## ${item.requirement.id}: ${item.requirement.title}\n\n**State:** ${STATE_LABELS[item.state]}\n\n${item.explanation}\n\n${evidence}${advisorySection}`
  })

  return [
    '# Proofline evidence report',
    '',
    `**Source:** ${result.sourceLabel}`,
    `**Generated:** ${result.generatedAt}`,
    '',
    `> ${result.disclaimer}`,
    '',
    '## Summary',
    '',
    ...Object.entries(STATE_LABELS).map(([state, label]) => `- ${label}: ${String(counts[state] ?? 0)}`),
    '',
    ...sections,
    '',
  ].join('\n')
}

function mermaidLabel(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replaceAll('"', '#quot;')
    .replace(/[<>{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function edgeLabel(rule: string, verdict: string | undefined): string {
  const ruleLabel = rule === 'exact-requirement-id'
    ? 'exact ID'
    : rule === 'phrase-overlap'
      ? 'phrase suggestion'
      : rule.replaceAll('-', ' ')
  return mermaidLabel(verdict ? `${ruleLabel} · ${verdict}` : ruleLabel)
}

/** Serializes the evidence relationship map as a standalone Mermaid flowchart. */
export function serializeMermaidReport(result: AnalysisResult): string {
  const lines = [
    'flowchart LR',
    '  classDef requirement fill:#f4efe3,stroke:#17191b,stroke-width:2px,color:#17191b;',
    '  classDef artifact fill:#ffffff,stroke:#17191b,color:#17191b;',
    '  classDef needsReview fill:#ffe1d5,stroke:#e84b23,stroke-width:3px,color:#17191b;',
  ]
  const artifactNodes = new Map<string, string>()

  result.requirements.forEach((item, requirementIndex) => {
    const requirementNode = `R${requirementIndex + 1}`
    lines.push(`  ${requirementNode}["${mermaidLabel(`${item.requirement.id}: ${item.requirement.title}`)}"]`)
    lines.push(`  class ${requirementNode} requirement;`)
    const needsReview = item.associations.some(({ advisory }) =>
      advisory?.verdict === 'contradicts'
      || advisory?.verdict === 'hollow-stub'
      || advisory?.verdict === 'vacuous-test')
    if (needsReview) lines.push(`  class ${requirementNode} needsReview;`)

    const artifactById = new Map(item.artifacts.map((artifact) => [artifact.id, artifact]))
    item.associations.forEach((association) => {
      const artifact = artifactById.get(association.artifactId)
      if (!artifact) return
      let artifactNode = artifactNodes.get(artifact.id)
      if (!artifactNode) {
        artifactNode = `A${artifactNodes.size + 1}`
        artifactNodes.set(artifact.id, artifactNode)
        lines.push(`  ${artifactNode}["${mermaidLabel(`${artifact.role ?? artifact.kind}: ${artifact.label}`)}"]`)
        lines.push(`  class ${artifactNode} artifact;`)
      }
      const label = edgeLabel(association.rule, association.advisory?.verdict)
      lines.push(association.strength === 'strong'
        ? `  ${requirementNode} -->|"${label}"| ${artifactNode}`
        : `  ${requirementNode} -.->|"${label}"| ${artifactNode}`)
    })
  })

  lines.push('  %% Advisory signals are probabilistic; human review remains the decision boundary.')
  return `${lines.join('\n')}\n`
}
