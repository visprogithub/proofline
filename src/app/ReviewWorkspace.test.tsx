import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
  it('offers Mermaid export and requires explicit hosted-model consent without requesting a key', async () => {
    const user = userEvent.setup()
    render(<ReviewWorkspace analysis={assessableCase()} onReset={vi.fn()} />)

    expect(screen.getByRole('button', { name: /Mermaid map/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Preview skeptic/i }))
    expect(screen.getByText(/No API key is requested/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/API key/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Preview the 1 assessable payload excerpt/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Run advisory skeptic/i })).toBeDisabled()

    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByRole('button', { name: /Run advisory skeptic/i })).toBeEnabled()
  })
})
