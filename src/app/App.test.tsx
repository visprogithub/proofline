import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./use-github-auth', () => ({
  useGitHubAuth: () => ({
    state: { status: 'anonymous', token: null, username: null, error: null },
    configured: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

describe('Proofline application', () => {
  it('runs the real synthetic domains from a user action and renders evidence', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByText('Sample / synthetic')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try the evidence dossier' }))

    expect(await screen.findByRole('heading', { name: 'Add reviewer evidence exports' })).toBeVisible()
    expect(screen.getByText('Test evidence found')).toBeVisible()
    expect(screen.getByText('Hardcoded response object added')).toBeVisible()
    expect(screen.getByText('Sample / synthetic case')).toBeVisible()
  })

  it('accepts requirements and diff files one at a time before analysis', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByLabelText('Public GitHub change')).toHaveAttribute(
      'placeholder', 'https://github.com/owner/repo/commit/abc1234',
    )
    expect(screen.getByLabelText('GitHub connection status')).toHaveTextContent(
      'Anonymous GitHub access',
    )
    await user.click(screen.getByRole('button', { name: 'Import local evidence' }))
    const analyzeButton = screen.getByRole('button', { name: 'Analyze local evidence' })
    expect(analyzeButton).toBeDisabled()

    await user.upload(
      screen.getByLabelText('Choose requirements document'),
      new File(['## REQ-101: Export reports'], 'requirements.md', { type: 'text/markdown' }),
    )
    expect(analyzeButton).toBeDisabled()
    await user.upload(
      screen.getByLabelText('Choose unified diff'),
      new File([
        'diff --git a/src/a.ts b/src/a.ts\n@@ -0,0 +1 @@\n+export function run() {} // REQ-101',
      ], 'change.patch', { type: 'text/plain' }),
    )
    expect(analyzeButton).toBeEnabled()
    await user.click(analyzeButton)

    expect(await screen.findByRole('heading', { name: 'Export reports' })).toBeVisible()
    expect(screen.getByText('Local / in-memory case')).toBeVisible()
  })
})
