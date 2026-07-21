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

/**
 * Service failures that make the rest of the queue pointless, so both advisory lanes
 * stop early on them under one shared policy. `input-too-large` and `invalid-request`
 * are deliberately excluded: they describe a single request, not the service, and
 * halting on them would discard batches that would have succeeded.
 */
export const HALTING_SERVICE_ERROR_CODES = [
  'client-daily-limit',
  'global-daily-limit',
  'global-token-limit',
  'service-unavailable',
  'provider-timeout',
  'provider-configuration',
  'provider-routing',
  'provider-rejected',
] as const satisfies readonly SkepticServiceErrorCode[]

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

/** Reports whether a service failure should stop the remaining advisory queue. */
export function haltsRemainingWork(error: SkepticServiceError): boolean {
  return (HALTING_SERVICE_ERROR_CODES as readonly string[]).includes(error.code)
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
