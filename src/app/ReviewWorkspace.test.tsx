import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('review workspace advisory and export controls', () => {
  beforeEach(() => window.localStorage.clear())

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
})
