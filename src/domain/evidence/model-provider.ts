import type { AssessmentContext } from './assessment-context'
import type { ModelProvenance } from './types'

export interface SkepticProviderResult {
  verdict: string
  rationale: string
  citedLineIds: string[]
}

export interface SkepticQuota {
  remainingToday: number
  resetAt: string
}

export interface SkepticProviderResponse {
  result: SkepticProviderResult
  provenance: ModelProvenance
  quota: SkepticQuota
}

export type SkepticServiceErrorCode =
  | 'client-daily-limit'
  | 'global-daily-limit'
  | 'global-token-limit'
  | 'service-unavailable'
  | 'provider-timeout'
  | 'provider-error'

export class SkepticServiceError extends Error {
  constructor(
    message: string,
    readonly code: SkepticServiceErrorCode,
    readonly resetAt?: string,
  ) {
    super(message)
    this.name = 'SkepticServiceError'
  }
}

export interface SkepticProvider {
  assess(context: AssessmentContext, signal?: AbortSignal): Promise<SkepticProviderResponse>
}

export interface EmbeddingProvider {
  readonly providerId: string
  readonly modelId: string
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>
}
