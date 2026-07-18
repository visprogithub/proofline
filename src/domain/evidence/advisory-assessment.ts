import { z } from 'zod'
import type { AssessmentContext } from './assessment-context'
import type { SkepticProviderResult } from './model-provider'
import type { AdvisoryAssessment, ModelProvenance } from './types'

const implementationVerdict = z.enum([
  'substantively-related', 'contradicts', 'hollow-stub', 'insufficient-context',
])
const testVerdict = z.enum([
  'meaningful-assertion', 'vacuous-test', 'contradicts', 'insufficient-context',
])
const responseBase = z.object({
  rationale: z.string().trim().min(1).max(300),
  citedLineIds: z.array(z.string()).max(12),
}).strict()

/** Validates a provider result against the context-specific verdict and citation contract. */
export function validatedAssessment(
  context: AssessmentContext,
  result: SkepticProviderResult,
  provenance: ModelProvenance,
  assessedAt = new Date().toISOString(),
): AdvisoryAssessment {
  const schema = responseBase.extend({
    verdict: context.artifactRole === 'test-source' ? testVerdict : implementationVerdict,
  }).strict()
  const value = schema.parse(result)
  const validLineIds = new Set(context.lines.map(({ id }) => id))
  if (value.citedLineIds.some((id) => !validLineIds.has(id))) {
    throw new Error('Provider cited a line outside the submitted assessment context.')
  }
  return {
    schemaVersion: 1,
    status: 'assessed',
    kind: context.artifactRole === 'test-source' ? 'test' : 'implementation',
    verdict: value.verdict,
    rationale: value.rationale,
    citedLineIds: value.citedLineIds,
    provenance,
    assessedAt,
  }
}
