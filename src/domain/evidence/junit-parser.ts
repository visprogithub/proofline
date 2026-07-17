import { XMLParser } from 'fast-xml-parser'
import type { EvidenceArtifact, SourceProvenance, TestOutcome } from './types'

interface XmlNode {
  [key: string]: unknown
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: false,
  parseTagValue: false,
  processEntities: false,
})

function asArray(value: unknown): XmlNode[] {
  if (Array.isArray(value)) return value.filter(isNode)
  return isNode(value) ? [value] : []
}

function isNode(value: unknown): value is XmlNode {
  return typeof value === 'object' && value !== null
}

function scalarText(value: unknown, fallback = ''): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return fallback
}

function outcomeFor(testcase: XmlNode): TestOutcome {
  if ('failure' in testcase || 'error' in testcase) return 'failed'
  if ('skipped' in testcase) return 'skipped'
  return 'passed'
}

function suitesFrom(root: XmlNode): XmlNode[] {
  if (isNode(root.testsuites)) {
    return asArray(root.testsuites.testsuite)
  }
  return asArray(root.testsuite)
}

/** Parses JUnit-compatible XML into normalized test evidence artifacts. */
export function parseJunit(
  xml: string,
  source: SourceProvenance,
): EvidenceArtifact[] {
  if (!xml.trim()) return []

  const parsed: unknown = parser.parse(xml)
  if (!isNode(parsed)) throw new Error('JUnit document must have an XML root element')

  const suites = suitesFrom(parsed)
  if (!suites.length) throw new Error('JUnit document does not contain a testsuite')

  return suites.flatMap((suite, suiteIndex) => {
    const suiteName = scalarText(suite['@_name'], `suite-${suiteIndex + 1}`)
    return asArray(suite.testcase).map((testcase, caseIndex) => {
      const name = scalarText(testcase['@_name'], `test-${caseIndex + 1}`)
      const className = scalarText(testcase['@_classname'])
      const label = className ? `${className} › ${name}` : name
      const details = [name, className, scalarText(testcase['system-out'])]
        .filter(Boolean)
        .join('\n')

      return {
        id: `junit:${suiteIndex}:${caseIndex}`,
        kind: 'test' as const,
        label,
        content: details,
        outcome: outcomeFor(testcase),
        location: { source, path: suiteName },
      }
    })
  })
}
