import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeLocalBundle } from './analysis/analyze-local'
import { ReviewWorkspace } from './ReviewWorkspace'

function assessableCase() {
  return analyzeLocalBundle({
    requirements: { name: 'requirements.md', text: '## REQ-101: Export reports' },
    diff: {
      name: 'change.patch',
      text: 'diff --git a/src/a.ts b/src/a.ts\n@@ -0,0 +1 @@\n+export function run() {} // REQ-101',
    },
  })
}

function mixedSafetyCase() {
  return analyzeLocalBundle({
    requirements: { name: 'requirements.md', text: '## REQ-101: Export reports' },
    diff: {
      name: 'change.patch',
      text: [
        'diff --git a/src/safe.ts b/src/safe.ts',
        '@@ -0,0 +1 @@',
        '+export function run() {} // REQ-101',
        'diff --git a/src/secret.ts b/src/secret.ts',
        '@@ -0,0 +1 @@',
        '+const token = "ghp_abcdefghijklmnopqrstuvwxyz123456" // REQ-101',
      ].join('\n'),
    },
  })
}

describe('review workspace advisory and export controls', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('offers selective payload controls and remembers hosted-model consent', async () => {
    const user = userEvent.setup()
    const view = render(<ReviewWorkspace analysis={assessableCase()} onReset={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Mermaid map/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Preview skeptic/i }))
    expect(screen.getByText(/No API key is requested/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/API key/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Choose from 1 assessable payload excerpt/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Minimize/i })).toBeInTheDocument()
    expect(screen.getByText(/Preview excerpt/i)).toBeInTheDocument()
    const runButton = screen.getByRole('button', { name: /Run selected excerpts/i })
    expect(runButton).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /Select REQ-101 payload/i }))
    expect(runButton).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /Remember my approval/i }))
    expect(runButton).toBeEnabled()
    expect(window.localStorage.getItem('proofline:hosted-skeptic-consent:v1')).toBe('true')

    view.unmount()
    render(<ReviewWorkspace analysis={assessableCase()} onReset={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /Preview skeptic/i }))
    expect(screen.getByRole('checkbox', { name: /Remember my approval/i })).toBeChecked()
  })

  it('advances past assessed and permanently blocked excerpts', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      if (typeof init?.body !== 'string') throw new Error('Expected a serialized request body.')
      const body = JSON.parse(init.body) as { context: { lines: Array<{ id: string }> } }
      return Promise.resolve(new Response(JSON.stringify({
        result: {
          verdict: 'substantively-related',
          rationale: 'The implementation is related to the requirement.',
          citedLineIds: [body.context.lines[0]?.id],
        },
        provenance: { providerId: 'huggingface', modelId: 'test/model', promptVersion: 'skeptic-v1' },
        quota: { remainingToday: 49, resetAt: '2026-07-19T00:00:00.000Z' },
      }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()
    render(<ReviewWorkspace analysis={mixedSafetyCase()} onReset={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Preview skeptic/i }))
    await user.click(screen.getByRole('button', { name: /Select next batch/i }))
    await user.click(screen.getByRole('checkbox', { name: /Remember my approval/i }))
    await user.click(screen.getByRole('button', { name: /Run selected excerpts \(2\)/i }))

    expect(await screen.findByText(/1 assessed.*1 not assessed/i)).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/AI reviewed 1/i)).toBeInTheDocument()
    expect(screen.getByText(/1 not assessed/i, { selector: '.advisory-summary-chip' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Select next batch/i }))
    expect(screen.getByRole('button', { name: /Run selected excerpts \(0\)/i })).toBeDisabled()
  })
})
