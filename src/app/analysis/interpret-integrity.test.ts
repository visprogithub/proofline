import { describe, expect, it, vi } from 'vitest'
import { analyzeLocalBundle } from './analyze-local'
import { buildIntegrityBatches, interpretIntegrity } from './interpret-integrity'
import { SkepticServiceError } from '../../domain/evidence/model-provider'
import type { IntegrityBatch } from '../../domain/integrity/interpreted-findings'

function caseWith(lines: string[]) {
  return analyzeLocalBundle({
    requirements: { name: 'requirements.md', text: '## REQ-101: Export reports' },
    diff: {
      name: 'change.patch',
      text: [
        'diff --git a/src/a.ts b/src/a.ts',
        `@@ -0,0 +1,${lines.length} @@`,
        ...lines.map((line) => `+${line}`),
      ].join('\n'),
    },
  })
}

function response(verdict: string, batch: IntegrityBatch, citedIndex = 0) {
  return {
    result: {
      verdict,
      rationale: 'The body returns a fixed value regardless of its input.',
      citedLineIds: [batch.lines[citedIndex]?.id ?? 'missing'],
    },
    provenance: { providerId: 'fake', modelId: 'fake-model', promptVersion: 'skeptic-v1' },
    quota: { remainingToday: 5, resetAt: '2026-07-22T00:00:00.000Z' },
  }
}

describe('interpreted integrity pass', () => {
  it('batches every added source line, not only requirement-linked excerpts', () => {
    const batches = buildIntegrityBatches(caseWith([
      'export function send(input) {',
      '  return { delivered: true }',
      '}',
    ]))

    expect(batches).toHaveLength(1)
    expect(batches[0]?.path).toBe('src/a.ts')
    expect(batches[0]?.lines.map(({ sourceLine }) => sourceLine)).toEqual([1, 2, 3])
  })

  it('reports an advisory finding without changing deterministic results', async () => {
    const before = caseWith(['export function send(input) {', '  return { delivered: true }', '}'])
    const interpret = vi.fn((batch: IntegrityBatch) =>
      Promise.resolve(response('hollow-implementation', batch)))
    const after = await interpretIntegrity(before, { interpret })

    expect(after.integrity).toEqual(before.integrity)
    expect(after.evidence.requirements[0]?.state).toBe(before.evidence.requirements[0]?.state)
    expect(after.interpretedIntegrity?.findings[0]).toMatchObject({
      verdict: 'hollow-implementation',
      path: 'src/a.ts',
      summary: 'Implementation may not perform the described work',
    })
    expect(after.interpretedIntegrity?.findings[0]?.citedLines.length).toBeGreaterThan(0)
  })

  it('drops a finding the deterministic scanner already reports', async () => {
    const before = caseWith(['// TODO: replace this placeholder'])
    expect(before.integrity.findings).toHaveLength(1)

    const interpret = vi.fn((batch: IntegrityBatch) =>
      Promise.resolve(response('hollow-implementation', batch)))
    const after = await interpretIntegrity(before, { interpret })

    expect(interpret).toHaveBeenCalledTimes(1)
    expect(after.interpretedIntegrity?.findings).toEqual([])
    expect(after.interpretedIntegrity?.duplicatesDropped).toBe(1)
  })

  it('records no finding when the model reports no signal', async () => {
    const interpret = vi.fn((batch: IntegrityBatch) => Promise.resolve(response('no-signal', batch)))
    const after = await interpretIntegrity(caseWith(['export function send() {}']), { interpret })

    expect(interpret).toHaveBeenCalledTimes(1)
    expect(after.interpretedIntegrity?.interpreted).toBe(1)
    expect(after.interpretedIntegrity?.findings).toEqual([])
  })

  it('blocks credential-shaped batches before calling the provider', async () => {
    const interpret = vi.fn((batch: IntegrityBatch) =>
      Promise.resolve(response('hollow-implementation', batch)))
    const after = await interpretIntegrity(
      caseWith(['const token = "ghp_abcdefghijklmnopqrstuvwxyz123456"']),
      { interpret },
    )

    expect(interpret).not.toHaveBeenCalled()
    expect(after.interpretedIntegrity?.findings).toEqual([])
    expect(after.interpretedIntegrity?.skipped).toBeGreaterThan(0)
  })

  it('surfaces a provider failure without producing findings', async () => {
    const interpret = vi.fn(() => Promise.reject(
      new SkepticServiceError('The configured model cannot be routed.', 'provider-routing'),
    ))
    const after = await interpretIntegrity(caseWith(['export function send() {}']), { interpret })

    expect(after.interpretedIntegrity?.findings).toEqual([])
    expect(after.interpretedIntegrity?.message).toContain('cannot be routed')
  })
})
