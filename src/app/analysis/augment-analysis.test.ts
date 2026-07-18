import { describe, expect, it, vi } from 'vitest'
import { analyzeLocalBundle } from './analyze-local'
import { augmentAnalysis } from './augment-analysis'
import type { SkepticProvider } from '../../domain/evidence/model-provider'
import { SkepticServiceError } from '../../domain/evidence/model-provider'
import type { AssessmentContext } from '../../domain/evidence/assessment-context'
import { createOperationalLimits } from '../../config/limits'

function localCase(source = '+export function run() {} // REQ-101') {
  return analyzeLocalBundle({
    requirements: { name: 'requirements.md', text: '## REQ-101: Export reports' },
    diff: { name: 'change.patch', text: `diff --git a/src/a.ts b/src/a.ts\n@@ -0,0 +1 @@\n${source}` },
  })
}

function twoArtifactCase() {
  return analyzeLocalBundle({
    requirements: { name: 'requirements.md', text: '## REQ-101: Export reports' },
    diff: {
      name: 'change.patch',
      text: [
        'diff --git a/src/a.ts b/src/a.ts',
        '@@ -0,0 +1 @@',
        '+export function run() {} // REQ-101',
        'diff --git a/src/b.ts b/src/b.ts',
        '@@ -0,0 +1 @@',
        '+export function save() {} // REQ-101',
      ].join('\n'),
    },
  })
}

describe('advisory analysis augmentation', () => {
  it('attaches validated advice without changing deterministic state', async () => {
    const provider: SkepticProvider = {
      assess: vi.fn((context: AssessmentContext) => Promise.resolve({
        result: { verdict: 'hollow-stub', rationale: 'The function body is empty.', citedLineIds: [context.lines[0]?.id ?? 'missing'] },
        provenance: { providerId: 'fake', modelId: 'fake', promptVersion: 'skeptic-v1' },
        quota: { remainingToday: 7, resetAt: '2026-07-19T00:00:00.000Z' },
      })),
    }
    const before = localCase()
    const after = await augmentAnalysis(before, provider)

    expect(before.evidence.requirements[0]?.state).toBe('implementation-evidence-only')
    expect(after.evidence.requirements[0]?.state).toBe('implementation-evidence-only')
    expect(after.evidence.requirements[0]?.associations[0]?.advisory).toMatchObject({
      status: 'assessed', verdict: 'hollow-stub',
    })
  })

  it('blocks credential-shaped context before calling a provider', async () => {
    const assess = vi.fn(() => Promise.resolve({
      result: { verdict: 'substantively-related', rationale: 'Related.', citedLineIds: [] },
      provenance: { providerId: 'fake', modelId: 'fake', promptVersion: 'v1' },
      quota: { remainingToday: 7, resetAt: '2026-07-19T00:00:00.000Z' },
    }))
    const after = await augmentAnalysis(localCase(
      '+const token = "ghp_abcdefghijklmnopqrstuvwxyz123456" // REQ-101',
    ), { assess })

    expect(assess).not.toHaveBeenCalled()
    expect(after.evidence.requirements[0]?.associations[0]?.advisory).toMatchObject({
      status: 'not-assessed', reason: 'secret-detected',
    })
  })

  it('assesses only explicitly selected contexts', async () => {
    const before = localCase()
    const assess = vi.fn((context: AssessmentContext) => Promise.resolve({
      result: { verdict: 'substantively-related', rationale: 'Related.', citedLineIds: [context.lines[0]?.id ?? 'missing'] },
      provenance: { providerId: 'fake', modelId: 'fake', promptVersion: 'v1' },
      quota: { remainingToday: 7, resetAt: '2026-07-19T00:00:00.000Z' },
    }))

    const skipped = await augmentAnalysis(before, { assess }, undefined, new Set())
    expect(assess).not.toHaveBeenCalled()
    expect(skipped.evidence.requirements[0]?.associations[0]?.advisory).toBeUndefined()

    const contextId = before.assessmentContexts[0]?.id
    if (!contextId) throw new Error('Expected an assessment context.')
    const assessed = await augmentAnalysis(skipped, { assess }, undefined, new Set([contextId]))
    expect(assess).toHaveBeenCalledTimes(1)
    expect(assessed.evidence.requirements[0]?.associations[0]?.advisory?.status).toBe('assessed')
  })

  it('halts the remaining queue after a systemic provider failure', async () => {
    const assess = vi.fn(() => Promise.reject(
      new SkepticServiceError('The configured model cannot be routed.', 'provider-routing'),
    ))

    const after = await augmentAnalysis(
      twoArtifactCase(),
      { assess },
      undefined,
      undefined,
      createOperationalLimits({ maxAiConcurrency: 1 }),
    )

    expect(assess).toHaveBeenCalledTimes(1)
    expect(after.advisoryRun).toMatchObject({ code: 'provider-routing' })
    expect(after.evidence.requirements[0]?.associations.map(({ advisory }) => advisory?.status))
      .toEqual(['not-assessed', 'not-assessed'])
  })
})
