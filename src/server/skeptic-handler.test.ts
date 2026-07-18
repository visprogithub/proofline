import { describe, expect, it, vi } from 'vitest'
import { createInMemoryQuotaStore, createSkepticHandler, type SkepticServerEnvironment } from './skeptic-handler'

const env: SkepticServerEnvironment = {
  HF_TOKEN: 'server-secret',
  HF_MODEL: 'test/model',
  RATE_LIMIT_SALT: 'a-long-test-only-salt',
}

const context = {
  schemaVersion: 1,
  id: 'ctx',
  requirement: { id: 'REQ-1', title: 'Export', acceptanceCriteria: [] },
  artifactLabel: 'a.ts', artifactRole: 'implementation', status: 'partial',
  lines: [{ id: 'L1', content: 'export function run() {} // REQ-1', change: 'added' }],
}

function request(): Request {
  return new Request('https://proofline.test/api/skeptic', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.5' },
    body: JSON.stringify({ context }),
  })
}

describe('server-side skeptic handler', () => {
  it('reserves in-memory quota before calling Hugging Face and never returns credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        verdict: 'hollow-stub', rationale: 'The function body is empty.', citedLineIds: ['L1'],
      }) } }] }), { status: 200 }))

    const response = await createSkepticHandler({ env, fetcher })(request())
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(fetcher.mock.calls[0]?.[0]).toContain('huggingface.co')
    expect(body).not.toContain('server-secret')
    expect(JSON.parse(body)).toMatchObject({ quota: { remainingToday: 7 } })
  })

  it('returns a clear reset message and does not call the model when quota is exhausted', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      verdict: 'hollow-stub', rationale: 'The function body is empty.', citedLineIds: ['L1'],
    }) } }] }), { status: 200 }))
    const quotaStore = createInMemoryQuotaStore()
    const handler = createSkepticHandler({
      env: { ...env, AI_PER_CLIENT_DAILY_LIMIT: '1' }, fetcher, quotaStore,
      now: () => new Date('2026-07-18T08:00:00.000Z'),
    })
    await handler(request())
    const response = await handler(request())

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({ code: 'client-daily-limit', resetAt: '2026-07-19T00:00:00.000Z' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fails closed when server configuration is missing', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const response = await createSkepticHandler({ env: {}, fetcher })(request())
    expect(response.status).toBe(503)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
