import { describe, expect, it, vi } from 'vitest'
import { createHuggingFaceChatClient } from './huggingface-client'

describe('official Hugging Face chat client', () => {
  it('uses the SDK with a bounded schema-constrained request and abort signal', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: 'completion-1', model: 'test/model', created: 1, system_fingerprint: 'test',
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: '{"verdict":"hollow-stub","rationale":"Empty.","citedLineIds":[]}' } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const client = createHuggingFaceChatClient(
      'server-only-test-token', 'https://endpoint.example.test/v1/', fetcher,
    )
    const controller = new AbortController()

    await client.complete({
      model: 'test/model', prompt: 'quoted evidence',
      allowedVerdicts: ['hollow-stub', 'insufficient-context'], maxTokens: 320,
    }, controller.signal)

    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, init] = fetcher.mock.calls[0] ?? []
    const requestedUrl = typeof url === 'string' ? url : url instanceof URL ? url.href : url?.url
    expect(requestedUrl).toContain('endpoint.example.test')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer server-only-test-token')
    expect(init?.signal).toBe(controller.signal)
    if (typeof init?.body !== 'string') throw new Error('Expected a serialized SDK request body.')
    expect(init.body).toContain('proofline_advisory_assessment')
    expect(init.body).toContain('hollow-stub')
  })
})
