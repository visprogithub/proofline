import { describe, expect, it, vi } from 'vitest'
import type { HostedChatClient } from './huggingface-client'
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

function request(signal?: AbortSignal): Request {
  return new Request('https://proofline.test/api/skeptic', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.5' },
    body: JSON.stringify({ context }),
    ...(signal ? { signal } : {}),
  })
}

describe('server-side skeptic handler', () => {
  it('reserves in-memory quota before calling Hugging Face and never returns credentials', async () => {
    const complete = vi.fn<HostedChatClient['complete']>().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
        verdict: 'hollow-stub', rationale: 'The function body is empty.', citedLineIds: ['L1'],
      }) } }] })

    // Pin the per-client budget so this assertion tracks quota accounting rather than
    // whichever default the handler happens to ship with.
    const budgeted: SkepticServerEnvironment = { ...env, AI_PER_CLIENT_DAILY_LIMIT: '10' }
    const response = await createSkepticHandler({ env: budgeted, chatClient: { complete } })(request())
    const body = await response.text()

    expect(response.status).toBe(200)
    const [chatRequest, signal] = complete.mock.calls[0] ?? []
    expect(chatRequest).toMatchObject({ model: 'test/model', maxTokens: 320 })
    expect(chatRequest?.allowedVerdicts).toContain('hollow-stub')
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(body).not.toContain('server-secret')
    expect(JSON.parse(body)).toMatchObject({ quota: { remainingToday: 9 } })
  })

  it('clamps an over-long rationale and tolerates extra citations and keys', async () => {
    const complete = vi.fn<HostedChatClient['complete']>().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      verdict: 'hollow-stub',
      rationale: 'x'.repeat(420),
      citedLineIds: Array.from({ length: 13 }, () => 'L1'),
      confidence: 'high',
    }) } }] })

    const response = await createSkepticHandler({ env, chatClient: { complete } })(request())

    // A chatty model must not cost the reviewer an otherwise valid assessment.
    expect(response.status).toBe(200)
    const payload = await response.json() as { result: { rationale: string; citedLineIds: string[] } }
    expect(payload.result.rationale.length).toBeLessThanOrEqual(300)
    expect(payload.result.citedLineIds).toHaveLength(13)
  })

  it('accepts JSON wrapped in a Markdown code fence but still validates the contract', async () => {
    const complete = vi.fn<HostedChatClient['complete']>().mockResolvedValue({ choices: [{ message: { content: `\`\`\`json
{"verdict":"hollow-stub","rationale":"The function body is empty.","citedLineIds":["L1"]}
\`\`\`` } }] })
    const response = await createSkepticHandler({ env, chatClient: { complete } })(request())
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ result: { verdict: 'hollow-stub' } })
  })

  it('returns a clear reset message and does not call the model when quota is exhausted', async () => {
    const complete = vi.fn<HostedChatClient['complete']>().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      verdict: 'hollow-stub', rationale: 'The function body is empty.', citedLineIds: ['L1'],
    }) } }] })
    const quotaStore = createInMemoryQuotaStore()
    const handler = createSkepticHandler({
      env: { ...env, AI_PER_CLIENT_DAILY_LIMIT: '1' }, chatClient: { complete }, quotaStore,
      now: () => new Date('2026-07-18T08:00:00.000Z'),
    })
    await handler(request())
    const response = await handler(request())

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toMatchObject({ code: 'client-daily-limit', resetAt: '2026-07-19T00:00:00.000Z' })
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('fails closed when server configuration is missing', async () => {
    const complete = vi.fn<HostedChatClient['complete']>()
    const response = await createSkepticHandler({ env: {}, chatClient: { complete } })(request())
    expect(response.status).toBe(503)
    expect(complete).not.toHaveBeenCalled()
  })

  it('propagates request cancellation to the provider signal', async () => {
    let providerSignal: AbortSignal | undefined
    let signalObserved: (() => void) | undefined
    const observed = new Promise<void>((resolve) => { signalObserved = resolve })
    const complete = vi.fn<HostedChatClient['complete']>().mockImplementation((_chatRequest, signal) => {
      providerSignal = signal
      signalObserved?.()
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    })
    const controller = new AbortController()
    const responsePromise = createSkepticHandler({ env, chatClient: { complete } })(request(controller.signal))

    await observed
    controller.abort()
    const response = await responsePromise

    expect(providerSignal?.aborted).toBe(true)
    expect(response.status).toBe(502)
  })
})
