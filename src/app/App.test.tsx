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

  it('exposes a real local evidence file input', () => {
    render(<App />)
    expect(screen.getByLabelText('Public GitHub change')).toHaveAttribute(
      'placeholder', 'https://github.com/owner/repo/commit/abc1234',
    )
    expect(screen.getByLabelText('GitHub connection status')).toHaveTextContent(
      'Anonymous GitHub access',
    )
    expect(screen.getByRole('button', { name: 'Import local evidence' })).toBeEnabled()
    expect(screen.getByLabelText('Choose local requirements, diff, and optional JUnit files')).toHaveAttribute('multiple')
  })
})
