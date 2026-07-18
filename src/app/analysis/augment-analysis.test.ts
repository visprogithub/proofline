import { describe, expect, it, vi } from 'vitest'
import { analyzeLocalBundle } from './analyze-local'
import { augmentAnalysis } from './augment-analysis'
import type { SkepticProvider } from '../../domain/evidence/model-provider'
import type { AssessmentContext } from '../../domain/evidence/assessment-context'

function localCase(source = '+export function run() {} // REQ-101') {
  return analyzeLocalBundle({
    requirements: { name: 'requirements.md', text: '## REQ-101: Export reports' },
    diff: { name: 'change.patch', text: `diff --git a/src/a.ts b/src/a.ts\n@@ -0,0 +1 @@\n${source}` },
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
})
