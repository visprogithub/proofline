import type { Requirement, SourceProvenance } from './types'

const REQUIREMENT_ID = /\b([A-Z][A-Z0-9_-]{1,15}-\d{1,8})\b/
const BULLET = /^\s*(?:[-*+] |\d+[.)] )/

/**
 * Extracts stable-ID requirements from Markdown while retaining exact source
 * lines and adjacent acceptance-criteria bullets.
 */
export function parseRequirements(
  markdown: string,
  source: SourceProvenance,
): Requirement[] {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n')
  const requirements: Requirement[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const match = REQUIREMENT_ID.exec(line)
    if (!match?.[1]) continue

    const id = match[1]
    if (requirements.some((requirement) => requirement.id === id)) continue

    const acceptanceCriteria: string[] = []
    let cursor = index + 1

    while (cursor < lines.length) {
      const candidate = lines[cursor] ?? ''
      if (REQUIREMENT_ID.test(candidate)) break
      if (candidate.trim() && BULLET.test(candidate)) {
        acceptanceCriteria.push(candidate.replace(BULLET, '').trim())
      } else if (candidate.trim() && !candidate.startsWith('  ')) {
        break
      }
      cursor += 1
    }

    const title = line
      .replace(/^\s{0,3}#{1,6}\s*/, '')
      .replace(REQUIREMENT_ID, '')
      .replace(/^\s*[:—–-]\s*/, '')
      .trim() || id

    requirements.push({
      id,
      identifierOrigin: 'source',
      title,
      acceptanceCriteria,
      location: { source, line: index + 1 },
      rawText: [line, ...acceptanceCriteria].join('\n'),
    })
  }

  return requirements
}
