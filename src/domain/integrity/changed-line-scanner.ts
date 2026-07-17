import type {
  ChangedLine,
  IntegrityFinding,
  IntegrityRule,
  IntegrityScanResult,
} from './types'

interface DetectionRule {
  id: IntegrityRule
  pattern: RegExp
  confidence: IntegrityFinding['confidence']
  summary: string
  impact: string
  remediation: string
  appliesTo(path: string): boolean
}

const TEST_PATH = /(?:^|\/)(?:__tests__|test|tests|fixtures?|mocks?)(?:\/|\.|$)|\.(?:test|spec)\.[^/]+$/i
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|cs|php)$/i

const rules: DetectionRule[] = [
  {
    id: 'unfinished-marker',
    pattern: /\b(?:TODO|FIXME|HACK)\b/i,
    confidence: 'suspected',
    summary: 'Unfinished-work marker added',
    impact: 'The changed path may describe work as complete while explicitly retaining unfinished behavior.',
    remediation: 'Resolve the marker, link it to deferred scope, or explain why it is safe to ship.',
    appliesTo: (path) => SOURCE_FILE.test(path),
  },
  {
    id: 'unimplemented-exception',
    pattern: /(?:NotImplementedError|NotImplementedException|UnsupportedOperationException|throw\s+new\s+Error\s*\(\s*['"`]not\s+implemented)/i,
    confidence: 'confirmed',
    summary: 'Explicit unimplemented code path added',
    impact: 'A reachable path intentionally fails instead of delivering the claimed behavior.',
    remediation: 'Implement the behavior or remove the path from the claimed scope and fail visibly in the UI.',
    appliesTo: (path) => SOURCE_FILE.test(path),
  },
  {
    id: 'empty-handler',
    pattern: /(?:catch\s*(?:\([^)]*\))?\s*\{\s*\}|=>\s*\{\s*\})/,
    confidence: 'confirmed',
    summary: 'Empty handler added',
    impact: 'The code accepts an event or error and silently performs no meaningful work.',
    remediation: 'Implement the handler, propagate the failure, or remove/disable the advertised interaction.',
    appliesTo: (path) => SOURCE_FILE.test(path),
  },
  {
    id: 'mock-import-in-production',
    pattern: /\b(?:from\s+|require\s*\(|import\s*\()['"`][^'"`]*(?:mock|fixture|fake|stub)s?(?:\/|\.|['"`])/i,
    confidence: 'confirmed',
    summary: 'Mock or fixture imported into a production path',
    impact: 'Production behavior may be backed by canned data rather than the intended integration.',
    remediation: 'Move the import behind an explicit demo/test adapter or wire the production dependency.',
    appliesTo: (path) => SOURCE_FILE.test(path) && !TEST_PATH.test(path),
  },
  {
    id: 'hardcoded-mock-response',
    pattern: /\b(?:mockResponse|fakeResponse|stubResponse|cannedResponse)\b\s*[:=]/i,
    confidence: 'suspected',
    summary: 'Hardcoded response object added',
    impact: 'A response-shaped value in production code may substitute for a real computation or integration.',
    remediation: 'Confirm this is isolated demo data; otherwise replace it with the real adapter result.',
    appliesTo: (path) => SOURCE_FILE.test(path) && !TEST_PATH.test(path),
  },
]

function findingId(rule: IntegrityRule, path: string, line: number): string {
  return `${rule}:${path}:${line}`
}

/**
 * Scans added source lines for a bounded set of direct implementation-integrity
 * signals. Findings report observed syntax, not developer intent.
 */
export function scanChangedLines(lines: ChangedLine[]): IntegrityScanResult {
  const added = lines.filter(({ change }) => change === 'added')
  const findings: IntegrityFinding[] = []

  for (const changedLine of added) {
    const normalizedPath = changedLine.path.replaceAll('\\', '/')
    for (const rule of rules) {
      if (!rule.appliesTo(normalizedPath)) continue
      const match = changedLine.content.match(rule.pattern)
      if (!match?.[0]) continue
      findings.push({
        id: findingId(rule.id, normalizedPath, changedLine.line),
        rule: rule.id,
        confidence: rule.confidence,
        path: normalizedPath,
        line: changedLine.line,
        matchedText: match[0],
        summary: rule.summary,
        impact: rule.impact,
        remediation: rule.remediation,
      })
    }
  }

  return { findings, scannedAddedLines: added.length }
}
