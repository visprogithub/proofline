import { describe, expect, it } from 'vitest'
import { createSkepticHandler } from './skeptic-handler'
import { ProoflineSkeptic } from '../integrations/model/proofline-skeptic'
import type { IntegrityBatch } from '../domain/integrity/interpreted-findings'

/**
 * Guards the client -> server contract for the interpreted integrity pass. The client
 * synthesizes a request shape by hand, so a schema change on either side must fail here
 * rather than becoming an opaque 400 at runtime.
 */
function integrityBatch(lines: { line: number; content: string }[]): IntegrityBatch {
  return {
    id: 'integrity:src/a.ts:0',
    path: 'src/a.ts',
    lines: lines.map(({ line, content }) => ({ id: `src/a.ts:${line}`, content, sourceLine: line })),
  }
}

/** Runs the real client and returns the exact JSON body it would put on the wire. */
async function wireBodyFor(batch: IntegrityBatch): Promise<unknown> {
  let captured: unknown
  const fetcher = ((_url: string, init: RequestInit) => {
    captured = JSON.parse(init.body as string) as unknown
    return Promise.resolve(new Response(JSON.stringify({
      result: { verdict: 'no-signal', rationale: 'nothing notable', citedLineIds: [] },
      provenance: { providerId: 'fake', modelId: 'fake-model', promptVersion: 'skeptic-v1' },
      quota: { remainingToday: 3, resetAt: '2026-07-22T00:00:00.000Z' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }) as unknown as typeof fetch

  await new ProoflineSkeptic(fetcher).interpret(batch)
  return captured
}

function handlerReturning(content: string) {
  return createSkepticHandler({
    env: { HF_TOKEN: 'token', HF_MODEL: 'model', RATE_LIMIT_SALT: 'salt' },
    chatClient: { complete: () => Promise.resolve({ choices: [{ message: { content } }] }) },
  })
}

async function post(handler: (request: Request) => Promise<Response>, body: unknown) {
  return handler(new Request('https://proofline.test/api/skeptic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

describe('interpreted integrity client/server contract', () => {
  it('accepts the payload the real client produces', async () => {
    const body = await wireBodyFor(integrityBatch([
      { line: 1, content: 'export function send(input) {' },
      { line: 2, content: '  return { delivered: true }' },
      { line: 3, content: '}' },
    ]))

    expect(body).toMatchObject({ mode: 'integrity', path: 'src/a.ts' })
    // No requirement is fabricated to satisfy the schema in this mode.
    expect(body).not.toHaveProperty('context')

    const response = await post(
      handlerReturning(JSON.stringify({
        verdict: 'hollow-implementation',
        rationale: 'Returns a fixed value regardless of its input.',
        citedLineIds: ['src/a.ts:2'],
      })),
      body,
    )

    expect(response.status).toBe(200)
    const payload = await response.json() as { result: { verdict: string } }
    expect(payload.result.verdict).toBe('hollow-implementation')
  })

  it('labels a test file as test source so the verdict set matches reality', async () => {
    const body = await wireBodyFor({
      id: 'integrity:src/a.test.ts:0',
      path: 'src/a.test.ts',
      lines: [{ id: 'src/a.test.ts:1', content: 'expect(true).toBe(true)', sourceLine: 1 }],
    }) as { artifactRole: string }

    expect(body.artifactRole).toBe('test-source')
  })

  it('rejects a verdict outside the integrity set instead of applying it', async () => {
    const body = await wireBodyFor(integrityBatch([{ line: 1, content: 'const a = 1' }]))
    const response = await post(
      handlerReturning(JSON.stringify({
        verdict: 'substantively-related',
        rationale: 'Wrong verdict family for this mode.',
        citedLineIds: ['src/a.ts:1'],
      })),
      body,
    )

    expect(response.status).toBe(502)
  })
})
