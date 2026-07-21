import type { OperationalLimits } from '../../config/limits'
import { DEFAULT_LIMITS } from '../../config/limits'
import { validatedAssessment } from '../../domain/evidence/advisory-assessment'
import type { AssessmentContext } from '../../domain/evidence/assessment-context'
import {
  haltsRemainingWork,
  SkepticServiceError,
  type SkepticProvider,
  type SkepticQuota,
} from '../../domain/evidence/model-provider'
import { runBounded } from './bounded-run'
import { scanOutboundText } from '../../domain/evidence/outbound-safety'
import type { AdvisoryAssessment, AdvisoryNotAssessedReason } from '../../domain/evidence/types'
import type { AnalysisCase } from './types'

function contextText(context: AssessmentContext): string {
  return [
    context.requirement.rawText,
    ...context.lines.map(({ content }) => content),
  ].join('\n')
}

function notAssessed(
  reason: AdvisoryNotAssessedReason,
  context?: AssessmentContext,
): AdvisoryAssessment {
  return {
    schemaVersion: 1,
    status: 'not-assessed',
    kind: context?.artifactRole === 'test-source' ? 'test' : 'implementation',
    citedLineIds: [],
    reason,
  }
}

function priority(context: AssessmentContext): number {
  if (context.artifactRole === 'test-source') return 0
  if (context.artifactRole === 'implementation') return 1
  return 2
}

/** Enriches deterministic evidence with bounded advisory assessments without changing its states. */
export async function augmentAnalysis(
  analysis: AnalysisCase,
  provider: SkepticProvider,
  signal?: AbortSignal,
  selectedContextIds?: ReadonlySet<string>,
  limits: OperationalLimits = DEFAULT_LIMITS,
): Promise<AnalysisCase> {
  const contexts = [...analysis.assessmentContexts].sort((left, right) => priority(left) - priority(right))
  const assessments = new Map<string, AdvisoryAssessment>()
  const eligible: AssessmentContext[] = []
  let serviceError: SkepticServiceError | undefined
  let haltedError: SkepticServiceError | undefined
  let latestQuota: SkepticQuota | undefined

  for (const context of contexts) {
    if (selectedContextIds && !selectedContextIds.has(context.id)) continue
    if (context.status === 'insufficient') {
      assessments.set(context.id, notAssessed('insufficient-context', context))
    } else if (scanOutboundText(contextText(context)).length) {
      assessments.set(context.id, notAssessed('secret-detected', context))
    } else if (eligible.length >= limits.maxHostedAssessments) {
      assessments.set(context.id, notAssessed('limit-reached', context))
    } else {
      eligible.push(context)
    }
  }

  await runBounded(eligible, limits.maxAiConcurrency, async (context) => {
    if (haltedError) {
      assessments.set(context.id, notAssessed('limit-reached', context))
      return
    }
    if (signal?.aborted) {
      assessments.set(context.id, notAssessed('cancelled', context))
      return
    }
    try {
      const response = await provider.assess(context, signal)
      latestQuota = response.quota
      assessments.set(context.id, validatedAssessment(context, response.result, response.provenance))
    } catch (error) {
      if (error instanceof SkepticServiceError) {
        serviceError ??= error
        if (haltsRemainingWork(error)) haltedError = error
      }
      const reason = signal?.aborted
        ? 'cancelled'
        : error instanceof SkepticServiceError && (
          error.code === 'client-daily-limit'
          || error.code === 'global-daily-limit'
          || error.code === 'global-token-limit'
        )
          ? 'limit-reached'
        : error instanceof Error && /parse|invalid|cited|outside|verdict/i.test(error.message)
          ? 'invalid-response'
          : 'provider-error'
      assessments.set(context.id, notAssessed(reason, context))
    }
  })

  const contextByAssociation = new Map(contexts.map((context) => [
    `${context.requirement.id}:${context.artifactId}:${context.association.hunkId ?? 'artifact'}`,
    context,
  ]))
  const requirements = analysis.evidence.requirements.map((item) => ({
    ...item,
    associations: item.associations.map((association) => {
      const key = `${item.requirement.id}:${association.artifactId}:${association.hunkId ?? 'artifact'}`
      const context = contextByAssociation.get(key)
      const advisory = context ? assessments.get(context.id) : undefined
      return advisory ? { ...association, advisory } : association
    }),
  }))

  return {
    ...analysis,
    evidence: { ...analysis.evidence, schemaVersion: 2, requirements },
    ...(serviceError ? {
      advisoryRun: {
        code: serviceError.code,
        message: serviceError.message,
        ...(serviceError.resetAt ? { resetAt: serviceError.resetAt } : {}),
      },
    } : latestQuota ? {
      advisoryRun: {
        code: 'completed',
        message: `Advisory run completed. ${latestQuota.remainingToday} hosted assessment${latestQuota.remainingToday === 1 ? '' : 's'} remain today for this connection.`,
        resetAt: latestQuota.resetAt,
        remainingToday: latestQuota.remainingToday,
      },
    } : {}),
  }
}
