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
    return `## ${item.requirement.id}: ${item.requirement.title}\n\n**State:** ${STATE_LABELS[item.state]}\n\n${item.explanation}\n\n${evidence}`
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
