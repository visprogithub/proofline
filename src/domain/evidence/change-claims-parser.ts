import { DEFAULT_LIMITS } from '../../config/limits'
import type { Requirement, SourceProvenance } from './types'

const CHANGE_SECTION = /^(?:changes?|what changed|implementation|summary|description)$/i
const TEST_SECTION = /^(?:tests?|testing|test plan|verification|validation)$/i
const HEADING = /^\s{0,3}#{1,6}\s+(.+?)\s*$/
const BULLET = /^\s*(?:[-*+] |\d+[.)] )(.+?)\s*$/
const TABLE_ROW = /^\s*\|(.+)\|\s*$/
const TABLE_SEPARATOR = /^:?-{3,}:?$/

interface DependencyTableColumns {
  package: number
  from: number
  to: number
}

function plainText(value: string): string {
  return value
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tableCells(line: string): string[] | null {
  const row = TABLE_ROW.exec(line)
  return row?.[1]?.split('|').map(plainText) ?? null
}

function dependencyTableColumns(cells: string[]): DependencyTableColumns | null {
  const normalized = cells.map((cell) => cell.toLowerCase())
  const packageColumn = normalized.findIndex((cell) => /^(?:package|dependency)$/.test(cell))
  const fromColumn = normalized.findIndex((cell) => /^(?:from|current|old)$/.test(cell))
  const toColumn = normalized.findIndex((cell) => /^(?:to|new|target)$/.test(cell))
  return packageColumn >= 0 && fromColumn >= 0 && toColumn >= 0
    ? { package: packageColumn, from: fromColumn, to: toColumn }
    : null
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
  let dependencyColumns: DependencyTableColumns | null = null

  for (let index = 0; index < lines.length && claims.length < limit; index += 1) {
    const line = lines[index] ?? ''
    const heading = HEADING.exec(line)
    if (heading?.[1]) {
      const title = plainText(heading[1])
      active = CHANGE_SECTION.test(title) || (!hasChangeSection && !TEST_SECTION.test(title))
      dependencyColumns = null
      continue
    }
    if (!active) continue

    const cells = tableCells(line)
    if (cells) {
      const columns = dependencyTableColumns(cells)
      if (columns) {
        dependencyColumns = columns
        continue
      }
      if (cells.every((cell) => TABLE_SEPARATOR.test(cell))) continue
      if (dependencyColumns) {
        const packageName = cells[dependencyColumns.package]
        const fromVersion = cells[dependencyColumns.from]
        const toVersion = cells[dependencyColumns.to]
        if (packageName && fromVersion && toVersion) {
          claims.push({
            title: `Update ${packageName} from ${fromVersion} to ${toVersion}`,
            line: index + 1,
          })
        }
        continue
      }
    } else if (line.trim()) {
      dependencyColumns = null
    }

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
