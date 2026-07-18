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

const MAX_SERIALIZED_REQUEST_CHARS = 18_000

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(limit - 1, 0))}…`
}

function hostedContext(context: AssessmentContext) {
  const compact = {
    schemaVersion: context.schemaVersion,
    id: truncate(context.id, 500),
    requirement: {
      id: truncate(context.requirement.id, 100),
      title: truncate(context.requirement.title, 1_000),
      acceptanceCriteria: context.requirement.acceptanceCriteria
        .slice(0, 8)
        .map((criterion) => truncate(criterion, 750)),
    },
    artifactLabel: truncate(context.artifactLabel, 1_000),
    artifactRole: context.artifactRole,
    status: context.status,
    lines: context.lines.map((line) => ({
      ...line,
      id: truncate(line.id, 200),
      content: truncate(line.content, 4_000),
    })),
  }

  if (JSON.stringify({ context: compact }).length <= MAX_SERIALIZED_REQUEST_CHARS) return compact

  compact.requirement.acceptanceCriteria = []
  compact.id = truncate(compact.id, 200)
  compact.requirement.title = truncate(compact.requirement.title, 500)
  compact.artifactLabel = truncate(compact.artifactLabel, 500)
  const matchedLineId = context.association.matchedLine?.id
  const prioritizedLines = compact.lines.slice(0, 32)
  const matchedLine = matchedLineId && !prioritizedLines.some(({ id }) => id === matchedLineId)
    ? compact.lines.find(({ id }) => id === matchedLineId)
    : undefined
  if (matchedLine) prioritizedLines[prioritizedLines.length - 1] = matchedLine
  let remainingContent = 6_500
  compact.lines = prioritizedLines.flatMap((line) => {
    if (remainingContent <= 0) return []
    const content = truncate(line.content, Math.min(remainingContent, 1_000))
    remainingContent -= content.length
    return [{ ...line, id: truncate(line.id, 120), content }]
  })
  return compact
}

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
        body: JSON.stringify({ context: hostedContext(context) }),
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
