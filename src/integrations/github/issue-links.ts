export interface LinkedIssue {
  owner: string
  repository: string
  number: number
  confidence: 'automatic' | 'confirmation-required'
  matchedText: string
}

const FULL_ISSUE_URL = /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/gi
const CLOSING_REFERENCE = /\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\s+#(\d+)\b/gi
const BARE_REFERENCE = /(?<![\w/])#(\d+)\b/g

/** Extracts explicit and confirmation-required GitHub issue references from PR text. */
export function findLinkedIssues(
  body: string,
  context: { owner: string; repository: string },
): LinkedIssue[] {
  const results: LinkedIssue[] = []
  const automaticNumbers = new Set<number>()
  let match: RegExpExecArray | null

  while ((match = FULL_ISSUE_URL.exec(body)) !== null) {
    if (!match[1] || !match[2] || !match[3]) continue
    const number = Number(match[3])
    results.push({
      owner: match[1], repository: match[2], number,
      confidence: 'automatic', matchedText: match[0],
    })
    if (match[1].toLowerCase() === context.owner.toLowerCase()
      && match[2].toLowerCase() === context.repository.toLowerCase()) {
      automaticNumbers.add(number)
    }
  }

  while ((match = CLOSING_REFERENCE.exec(body)) !== null) {
    if (!match[1]) continue
    const number = Number(match[1])
    if (automaticNumbers.has(number)) continue
    automaticNumbers.add(number)
    results.push({ ...context, number, confidence: 'automatic', matchedText: match[0] })
  }

  while ((match = BARE_REFERENCE.exec(body)) !== null) {
    if (!match[1]) continue
    const number = Number(match[1])
    if (automaticNumbers.has(number)) continue
    if (results.some((result) => result.number === number
      && result.owner === context.owner && result.repository === context.repository)) continue
    results.push({
      ...context, number, confidence: 'confirmation-required', matchedText: match[0],
    })
  }

  return results
}
