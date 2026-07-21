import type { AssessmentContext } from './assessment-context'
import type { IntegrityBatch } from '../integrity/interpreted-findings'
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

export const SKEPTIC_SERVICE_ERROR_CODES = [
  'client-daily-limit',
  'global-daily-limit',
  'global-token-limit',
  'service-unavailable',
  'input-too-large',
  'invalid-request',
  'provider-timeout',
  'provider-configuration',
  'provider-routing',
  'provider-rejected',
  'provider-error',
] as const

export type SkepticServiceErrorCode = typeof SKEPTIC_SERVICE_ERROR_CODES[number]

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

/**
 * Requests a changed-line implementation-integrity interpretation. Results are advisory
 * and never replace or modify deterministic integrity findings.
 */
export interface IntegrityInterpreter {
  interpret(batch: IntegrityBatch, signal?: AbortSignal): Promise<SkepticProviderResponse>
}

export interface EmbeddingProvider {
  readonly providerId: string
  readonly modelId: string
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>
}
