import { z } from 'zod'
import type { AssessmentContext } from '../../domain/evidence/assessment-context'
import type { IntegrityBatch } from '../../domain/integrity/interpreted-findings'
import { DEFAULT_LIMITS, type OperationalLimits } from '../../config/limits'
import {
  SkepticServiceError,
  SKEPTIC_SERVICE_ERROR_CODES,
  type IntegrityInterpreter,
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
  code: z.enum(SKEPTIC_SERVICE_ERROR_CODES),
  message: z.string(),
  resetAt: z.string().optional(),
})

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, Math.max(limit - 1, 0))}…`
}

function hostedContext(context: AssessmentContext, maxSerializedRequestChars: number) {
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

  if (JSON.stringify({ context: compact }).length <= maxSerializedRequestChars) return compact

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
export class ProoflineSkeptic implements SkepticProvider, IntegrityInterpreter {
  private readonly fetcher: typeof fetch

  constructor(
    fetcher: typeof fetch = globalThis.fetch,
    private readonly limits: OperationalLimits = DEFAULT_LIMITS,
  ) {
    this.fetcher = fetcher.bind(globalThis)
  }

  private async send(payload: unknown, signal?: AbortSignal): Promise<SkepticProviderResponse> {
    let response: Response
    try {
      response = await this.fetcher('/api/skeptic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      const code: SkepticServiceErrorCode = parsed.success ? parsed.data.code : 'provider-error'
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

  private compact(context: AssessmentContext) {
    return hostedContext(context, Math.max(1_000, this.limits.maxHostedInputChars - 2_000))
  }

  /** Requests one requirement-relatedness assessment. */
  assess(context: AssessmentContext, signal?: AbortSignal): Promise<SkepticProviderResponse> {
    return this.send({ context: this.compact(context) }, signal)
  }

  /** Requests one advisory interpretation of a bounded batch of changed lines. */
  interpret(batch: IntegrityBatch, signal?: AbortSignal): Promise<SkepticProviderResponse> {
    const role = /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(batch.path) ? 'test-source' : 'implementation'
    const ceiling = Math.max(1_000, this.limits.maxHostedInputChars - 2_000)
    const build = (lines: ReturnType<typeof this.integrityLines>) => ({
      mode: 'integrity' as const,
      path: truncate(batch.path, 1_000),
      artifactRole: role,
      lines,
    })
    // Measure the serialized request, not just field lengths, so JSON escaping cannot
    // push a batch past the server's request ceiling.
    let lines = this.integrityLines(batch)
    while (lines.length > 1 && JSON.stringify(build(lines)).length > ceiling) {
      lines = lines.slice(0, -1)
    }
    return this.send(build(lines), signal)
  }

  private integrityLines(batch: IntegrityBatch) {
    return batch.lines.map((line) => ({
      id: truncate(line.id, 200),
      content: truncate(line.content, 4_000),
      change: line.change,
      ...(line.sourceLine !== undefined ? { sourceLine: line.sourceLine } : {}),
    }))
  }
}
