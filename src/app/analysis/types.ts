import type { AnalysisResult } from '../../domain/evidence/types'
import type { IntegrityScanResult } from '../../domain/integrity/types'
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
  assessmentContexts: AssessmentContext[]
  advisoryRun?: {
    code: string
    message: string
    resetAt?: string
    remainingToday?: number
  }
}
