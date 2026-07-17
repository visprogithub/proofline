import type { Requirement, SourceProvenance } from './types'
import { declaredRequirementIdentifier } from './requirement-identifiers'

const BULLET = /^\s*(?:[-*+] |\d+[.)] )/
const DECLARATION_PREFIX = /^\s{0,3}(?:(?:#{1,6}|[-*+]|\d+[.)])\s+|\|\s*)?/

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
    const id = declaredRequirementIdentifier(line)
    if (!id) continue
    if (requirements.some((requirement) => requirement.id === id)) continue

    const acceptanceCriteria: string[] = []
    let cursor = index + 1

    while (cursor < lines.length) {
      const candidate = lines[cursor] ?? ''
      if (declaredRequirementIdentifier(candidate)) break
      if (candidate.trim() && BULLET.test(candidate)) {
        acceptanceCriteria.push(candidate.replace(BULLET, '').trim())
      } else if (candidate.trim() && !candidate.startsWith('  ')) {
        break
      }
      cursor += 1
    }

    const title = line
      .replace(DECLARATION_PREFIX, '')
      .replace(/^(?:\*\*|__|`|\[)/, '')
      .replace(id, '')
      .replace(/^\s*(?:\*\*|__|`|\]|\|)+\s*/, '')
      .replace(/^\s*[:—–-]\s*/, '')
      .replace(/\s*\|\s*$/, '')
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
