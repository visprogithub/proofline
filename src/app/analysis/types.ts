import type { AnalysisResult } from '../../domain/evidence/types'
import type { IntegrityScanResult } from '../../domain/integrity/types'

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
}
