import type { EvidenceState } from '../domain/evidence/types'

/** Returns the user-facing neutral label for an evidence state. */
export function stateLabel(state: EvidenceState): string {
  return {
    'test-evidence-found': 'Test evidence found',
    'implementation-evidence-only': 'Implementation evidence only',
    'failing-test-evidence': 'Failing test evidence',
    'no-evidence-found': 'No evidence found',
    'suggested-evidence-found': 'Suggested evidence found',
    'ambiguous-evidence': 'Ambiguous evidence',
  }[state]
}

/** Returns a compact dossier stamp for an evidence state. */
export function stateStamp(state: EvidenceState): string {
  return {
    'test-evidence-found': 'linked',
    'implementation-evidence-only': 'inspect',
    'failing-test-evidence': 'failed',
    'no-evidence-found': 'open',
    'suggested-evidence-found': 'signal',
    'ambiguous-evidence': 'review',
  }[state]
}
