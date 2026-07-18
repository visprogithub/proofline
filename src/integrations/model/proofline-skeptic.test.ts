import { describe, expect, it, vi } from 'vitest'
import type { AssessmentContext } from '../../domain/evidence/assessment-context'
import { ProoflineSkeptic } from './proofline-skeptic'

const context: AssessmentContext = {
  schemaVersion: 1,
  id: 'ctx',
  requirement: {
    id: 'REQ-1', identifierOrigin: 'source', title: 'Export', acceptanceCriteria: [],
    rawText: 'raw requirement text that must not be transmitted',
    location: { source: { kind: 'demo', label: 'Test' } },
  },
  association: {
    requirementId: 'REQ-1', artifactId: 'file:a', strength: 'strong',
    rule: 'exact-requirement-id', matchedText: ['REQ-1'],
    location: { source: { kind: 'demo', label: 'Test' } },
  },
  artifactId: 'file:a', artifactLabel: 'a.ts', artifactRole: 'implementation',
  status: 'partial', reasons: ['source-unavailable'], lines: [{ id: 'L1', content: '// REQ-1' }],
}

describe('Proofline skeptic client', () => {
  it('binds fetch to the browser global instead of the provider instance', async () => {
    const fetcher = function (this: unknown): Promise<Response> {
      expect(this).toBe(globalThis)
      return Promise.resolve(new Response(JSON.stringify({
        result: { verdict: 'hollow-stub', rationale: 'Only a comment is present.', citedLineIds: [] },
        provenance: { providerId: 'huggingface', modelId: 'test/model', promptVersion: 'skeptic-v1' },
        quota: { remainingToday: 7, resetAt: '2026-07-19T00:00:00.000Z' },
      }), { status: 200 }))
    } as typeof fetch

    await new ProoflineSkeptic(fetcher).assess(context)
  })

  it('calls only the same-origin proxy and parses quota metadata', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      result: { verdict: 'hollow-stub', rationale: 'Only a comment is present.', citedLineIds: ['L1'] },
      provenance: { providerId: 'huggingface', modelId: 'test/model', promptVersion: 'skeptic-v1' },
      quota: { remainingToday: 7, resetAt: '2026-07-19T00:00:00.000Z' },
    }), { status: 200 }))

    await expect(new ProoflineSkeptic(fetcher).assess(context)).resolves.toMatchObject({
      result: { verdict: 'hollow-stub' }, quota: { remainingToday: 7 },
    })
    expect(fetcher).toHaveBeenCalledWith('/api/skeptic', expect.objectContaining({ method: 'POST' }))
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('Bearer')
    const requestBody = fetcher.mock.calls[0]?.[1]?.body
    if (typeof requestBody !== 'string') throw new Error('Expected a serialized request body.')
    expect(requestBody).not.toContain('rawText')
    expect(requestBody).not.toContain('association')
  })

  it('turns quota responses into a clear typed error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      code: 'client-daily-limit', message: 'Daily limit reached.', resetAt: '2026-07-19T00:00:00.000Z',
    }), { status: 429 }))

    await expect(new ProoflineSkeptic(fetcher).assess(context)).rejects.toEqual(
      expect.objectContaining({ code: 'client-daily-limit', message: 'Daily limit reached.' }),
    )
  })
})
