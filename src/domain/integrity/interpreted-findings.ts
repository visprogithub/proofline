import type { ModelProvenance } from '../evidence/types'

/**
 * Closed verdict set for the optional model-interpreted integrity pass. `no-signal`
 * is the default answer and never produces a finding.
 */
export const INTERPRETED_VERDICTS = [
  'hollow-implementation',
  'swallowed-error',
  'unused-input',
  'vacuous-test',
  'no-signal',
] as const

export type InterpretedVerdict = typeof INTERPRETED_VERDICTS[number]
export type ReportableVerdict = Exclude<InterpretedVerdict, 'no-signal'>

export type InterpretedNotAssessedReason =
  | 'insufficient-context'
  | 'secret-detected'
  | 'limit-reached'
  | 'cancelled'
  | 'invalid-response'
  | 'provider-error'

export interface InterpretedCitedLine {
  id: string
  content: string
  sourceLine?: number
}

/** A bounded group of changed lines from one file, submitted as one interpreted-pass request. */
export interface IntegrityBatch {
  id: string
  path: string
  lines: InterpretedCitedLine[]
}

export interface InterpretedFinding {
  id: string
  verdict: ReportableVerdict
  contextId: string
  path: string
  summary: string
  impact: string
  remediation: string
  rationale: string
  citedLines: InterpretedCitedLine[]
  provenance: ModelProvenance
}

export interface InterpretedIntegrityRun {
  findings: InterpretedFinding[]
  interpreted: number
  skipped: number
  /** Model findings discarded because the deterministic scanner already reports those lines. */
  duplicatesDropped: number
  message?: string
  resetAt?: string
}

const COPY: Record<ReportableVerdict, { summary: string; impact: string; remediation: string }> = {
  'hollow-implementation': {
    summary: 'Implementation may not perform the described work',
    impact: 'The changed path can complete without doing the work the change appears to claim.',
    remediation: 'Confirm the path performs real work, or mark the behavior as unfinished.',
  },
  'swallowed-error': {
    summary: 'Failure may be handled without surfacing',
    impact: 'An error can be caught and discarded, hiding breakage from callers and logs.',
    remediation: 'Propagate, log, or surface the failure so it remains visible.',
  },
  'unused-input': {
    summary: 'Declared input may never be read',
    impact: 'Behavior may ignore the value it appears to act on.',
    remediation: 'Use the input, or remove it from the signature and the claim.',
  },
  'vacuous-test': {
    summary: 'Test may not be able to fail',
    impact: 'A passing result may not demonstrate the behavior under test.',
    remediation: 'Assert on the observable outcome the requirement describes.',
  },
}

/** Returns true when a model verdict is reportable as an interpreted finding. */
export function isReportableVerdict(verdict: string): verdict is ReportableVerdict {
  return verdict in COPY
}

/** Builds a display-ready interpreted finding from a validated model verdict. */
export function createInterpretedFinding(input: {
  verdict: ReportableVerdict
  contextId: string
  path: string
  rationale: string
  citedLines: InterpretedCitedLine[]
  provenance: ModelProvenance
}): InterpretedFinding {
  const copy = COPY[input.verdict]
  return {
    id: `interpreted:${input.verdict}:${input.contextId}`,
    verdict: input.verdict,
    contextId: input.contextId,
    path: input.path,
    summary: copy.summary,
    impact: copy.impact,
    remediation: copy.remediation,
    rationale: input.rationale,
    citedLines: input.citedLines,
    provenance: input.provenance,
  }
}
