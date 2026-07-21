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

function response(verdict: string, citedLineIds: string[]) {
  return {
    result: {
      verdict,
      rationale: 'The body returns a fixed value regardless of its input.',
      citedLineIds,
    },
    provenance: { providerId: 'fake', modelId: 'fake-model', promptVersion: 'skeptic-v1' },
    quota: { remainingToday: 5, resetAt: '2026-07-22T00:00:00.000Z' },
  }
}

const HOLLOW = ['export function send(input) {', '  return { delivered: true }', '}']

describe('interpreted integrity batching', () => {
  it('batches every added source line, not only requirement-linked excerpts', () => {
    const batches = buildIntegrityBatches(caseWith(HOLLOW))

    expect(batches).toHaveLength(1)
    expect(batches[0]?.path).toBe('src/a.ts')
    expect(batches[0]?.lines.map(({ sourceLine }) => sourceLine)).toEqual([1, 2, 3])
  })

  it('never emits an empty batch for a single oversized line', () => {
    const huge = `const data = "${'x'.repeat(9_000)}"`
    const batches = buildIntegrityBatches(caseWith(['export const a = 1', huge, 'export const b = 2']))

    expect(batches.every(({ lines }) => lines.length > 0)).toBe(true)
    expect(batches.flatMap(({ lines }) => lines)).toHaveLength(3)
  })

  it('drops changed lines without a positive source line', () => {
    const analysis = caseWith(HOLLOW)
    analysis.changedLines = [
      { path: 'src/a.ts', line: 0, content: 'export function send() {}', change: 'added' },
    ]
    expect(buildIntegrityBatches(analysis)).toEqual([])
  })

  it('ignores non-source paths', () => {
    const analysis = caseWith(HOLLOW)
    analysis.changedLines = [
      { path: 'docs/notes.md', line: 1, content: 'TODO: write this up', change: 'added' },
    ]
    expect(buildIntegrityBatches(analysis)).toEqual([])
  })
})

describe('interpreted integrity pass', () => {
  it('reports an advisory finding without adding it to the deterministic list', async () => {
    const before = caseWith(HOLLOW)
    expect(before.integrity.findings).toHaveLength(0)

    const interpret = vi.fn((batch: IntegrityBatch) =>
      Promise.resolve(response('hollow-implementation', [batch.lines[1]?.id ?? 'missing'])))
    const after = await interpretIntegrity(before, { interpret })

    // The model's finding must live only in the advisory lane.
    expect(after.integrity.findings).toHaveLength(0)
    expect(after.interpretedIntegrity?.findings).toHaveLength(1)
    expect(after.interpretedIntegrity?.findings[0]).toMatchObject({
      verdict: 'hollow-implementation',
      path: 'src/a.ts',
      summary: 'Implementation may not perform the described work',
    })
    expect(after.evidence.requirements[0]?.state).toBe(before.evidence.requirements[0]?.state)
  })

  it('reports how much of the change it actually read', async () => {
    const interpret = vi.fn((batch: IntegrityBatch) =>
      Promise.resolve(response('no-signal', [batch.lines[0]?.id ?? 'missing'])))
    const after = await interpretIntegrity(caseWith(HOLLOW), { interpret })

    expect(after.interpretedIntegrity?.linesEligible).toBe(3)
    expect(after.interpretedIntegrity?.linesInterpreted).toBe(3)
  })

  it('does not claim coverage when every batch fails', async () => {
    const interpret = vi.fn(() => Promise.reject(
      new SkepticServiceError('The assessment context is incomplete or invalid.', 'invalid-request'),
    ))
    const after = await interpretIntegrity(caseWith(HOLLOW), { interpret })

    expect(after.interpretedIntegrity?.linesEligible).toBe(3)
    expect(after.interpretedIntegrity?.linesInterpreted).toBe(0)
    expect(after.interpretedIntegrity?.skipped).toBeGreaterThan(0)
  })

  it('drops a finding the deterministic scanner already reports', async () => {
    const before = caseWith(['// TODO: replace this placeholder'])
    expect(before.integrity.findings).toHaveLength(1)

    const interpret = vi.fn((batch: IntegrityBatch) =>
      Promise.resolve(response('hollow-implementation', [batch.lines[0]?.id ?? 'missing'])))
    const after = await interpretIntegrity(before, { interpret })

    expect(interpret).toHaveBeenCalledTimes(1)
    expect(after.interpretedIntegrity?.findings).toEqual([])
    expect(after.interpretedIntegrity?.duplicatesDropped).toBe(1)
  })

  it('discards a finding that cites no submitted line', async () => {
    const interpret = vi.fn(() => Promise.resolve(response('hollow-implementation', [])))
    const after = await interpretIntegrity(caseWith(HOLLOW), { interpret })

    expect(after.interpretedIntegrity?.findings).toEqual([])
    expect(after.interpretedIntegrity?.skipped).toBeGreaterThan(0)
  })

  it('records no finding when the model reports no signal', async () => {
    const interpret = vi.fn((batch: IntegrityBatch) =>
      Promise.resolve(response('no-signal', [batch.lines[0]?.id ?? 'missing'])))
    const after = await interpretIntegrity(caseWith(HOLLOW), { interpret })

    expect(interpret).toHaveBeenCalledTimes(1)
    expect(after.interpretedIntegrity?.interpreted).toBe(1)
    expect(after.interpretedIntegrity?.findings).toEqual([])
  })

  it('blocks credential-shaped batches before calling the provider', async () => {
    const interpret = vi.fn((batch: IntegrityBatch) =>
      Promise.resolve(response('hollow-implementation', [batch.lines[0]?.id ?? 'missing'])))
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
    const after = await interpretIntegrity(caseWith(HOLLOW), { interpret })

    expect(after.interpretedIntegrity?.findings).toEqual([])
    expect(after.interpretedIntegrity?.message).toContain('cannot be routed')
  })
})
