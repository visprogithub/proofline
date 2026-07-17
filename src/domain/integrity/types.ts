export type IntegrityConfidence = 'confirmed' | 'suspected'

export type IntegrityRule =
  | 'unfinished-marker'
  | 'unimplemented-exception'
  | 'empty-handler'
  | 'mock-import-in-production'
  | 'hardcoded-mock-response'

export interface ChangedLine {
  path: string
  line: number
  content: string
  change: 'added' | 'removed' | 'context'
}

export interface IntegrityFinding {
  id: string
  rule: IntegrityRule
  confidence: IntegrityConfidence
  path: string
  line: number
  matchedText: string
  summary: string
  impact: string
  remediation: string
}

export interface IntegrityScanResult {
  findings: IntegrityFinding[]
  scannedAddedLines: number
}
