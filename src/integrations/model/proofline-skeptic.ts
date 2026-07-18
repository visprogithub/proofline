import { z } from 'zod'
import type { AssessmentContext } from '../../domain/evidence/assessment-context'
import {
  SkepticServiceError,
  type SkepticProvider,
  type SkepticProviderResponse,
  type SkepticServiceErrorCode,
} from '../../domain/evidence/model-provider'

const responseSchema = z.object({
  result: z.object({
    verdict: z.string(),
    rationale: z.string(),
    citedLineIds: z.array(z.string()),
  }).strict(),
  provenance: z.object({
    providerId: z.string(),
    modelId: z.string(),
    modelRevision: z.string().optional(),
    promptVersion: z.string(),
  }).strict(),
  quota: z.object({ remainingToday: z.number().int().nonnegative(), resetAt: z.string() }).strict(),
}).strict()

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  resetAt: z.string().optional(),
})

/** Calls Proofline's server-side, throttled skeptic endpoint without exposing provider credentials. */
export class ProoflineSkeptic implements SkepticProvider {
  private readonly fetcher: typeof fetch

  constructor(fetcher: typeof fetch = globalThis.fetch) {
    this.fetcher = fetcher.bind(globalThis)
  }

  async assess(context: AssessmentContext, signal?: AbortSignal): Promise<SkepticProviderResponse> {
    let response: Response
    try {
      response = await this.fetcher('/api/skeptic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
        ...(signal ? { signal } : {}),
      })
    } catch (error) {
      if (signal?.aborted) throw error
      throw new SkepticServiceError('The hosted skeptic endpoint could not be reached.', 'service-unavailable')
    }
    let body: unknown
    try {
      body = JSON.parse(await response.text()) as unknown
    } catch {
      throw new SkepticServiceError(
        'The hosted skeptic endpoint is not running. In local development, start the app with the Vercel development runtime.',
        'service-unavailable',
      )
    }
    if (!response.ok) {
      const parsed = errorSchema.safeParse(body)
      const code = (parsed.success ? parsed.data.code : 'provider-error') as SkepticServiceErrorCode
      const message = parsed.success ? parsed.data.message : 'The hosted skeptic is temporarily unavailable.'
      throw new SkepticServiceError(message, code, parsed.success ? parsed.data.resetAt : undefined)
    }
    const validated = responseSchema.safeParse(body)
    if (!validated.success) {
      throw new SkepticServiceError('The hosted skeptic returned an invalid response. No assessment was applied.', 'provider-error')
    }
    const parsed = validated.data
    return {
      result: parsed.result,
      provenance: {
        providerId: parsed.provenance.providerId,
        modelId: parsed.provenance.modelId,
        promptVersion: parsed.provenance.promptVersion,
        ...(parsed.provenance.modelRevision ? { modelRevision: parsed.provenance.modelRevision } : {}),
      },
      quota: parsed.quota,
    }
  }
}
