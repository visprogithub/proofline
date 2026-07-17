import { DEFAULT_LIMITS } from '../../config/limits'
import type { Requirement, SourceProvenance } from './types'

const CHANGE_SECTION = /^(?:changes?|what changed|implementation|summary|description)$/i
const TEST_SECTION = /^(?:tests?|testing|test plan|verification|validation)$/i
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*$/
const BULLET = /^\s*(?:[-*+] |\d+[.)] )(.+?)\s*$/

function plainText(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extracts explicitly declared change claims without presenting them as formal requirements. */
export function parseDeclaredChangeClaims(
  text: string,
  fallbackTitle: string,
  source: SourceProvenance,
  limit = DEFAULT_LIMITS.maxDeclaredClaims,
): Requirement[] {
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  const hasChangeSection = lines.some((line) => {
    const heading = HEADING.exec(line)
    return Boolean(heading?.[1] && CHANGE_SECTION.test(plainText(heading[1])))
  })
  const claims: Array<{ title: string; line: number }> = []
  let active = !hasChangeSection

  for (let index = 0; index < lines.length && claims.length < limit; index += 1) {
    const line = lines[index] ?? ''
    const heading = HEADING.exec(line)
    if (heading?.[1]) {
      const title = plainText(heading[1])
      active = CHANGE_SECTION.test(title) || (!hasChangeSection && !TEST_SECTION.test(title))
      continue
    }
    if (!active) continue
    const bullet = BULLET.exec(line)
    if (!bullet?.[1]) continue
    const title = plainText(bullet[1])
    if (title) claims.push({ title, line: index + 1 })
  }

  if (!claims.length) {
    const title = plainText(fallbackTitle)
    if (title) claims.push({ title, line: 1 })
  }

  return claims.map((claim, index) => ({
    id: `CLAIM-${String(index + 1).padStart(3, '0')}`,
    identifierOrigin: 'generated',
    title: claim.title,
    acceptanceCriteria: [],
    location: { source, line: claim.line },
    rawText: claim.title,
  }))
}
