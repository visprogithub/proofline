import type { AnalysisResult } from '../../domain/evidence/types'
import type { ChangedLine, IntegrityScanResult } from '../../domain/integrity/types'
import type { InterpretedIntegrityRun } from '../../domain/integrity/interpreted-findings'
import type { AssessmentContext } from '../../domain/evidence/assessment-context'

export interface AnalysisCase {
  id: string
  mode: 'demo' | 'github' | 'local'
  analysisBasis: 'formal-requirements' | 'declared-claims'
  title: string
  repository: string
  changeUrl?: string
  changeLabel?: string
  evidence: AnalysisResult
  integrity: IntegrityScanResult
  /** Raw changed lines retained so the optional interpreted pass can read beyond pattern hits. */
  changedLines?: ChangedLine[]
  interpretedIntegrity?: InterpretedIntegrityRun
  assessmentContexts: AssessmentContext[]
  advisoryRun?: {
    code: string
    message: string
    resetAt?: string
    remainingToday?: number
  }
}
