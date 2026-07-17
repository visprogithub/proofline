import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./use-github-auth', () => ({
  useGitHubAuth: () => ({
    state: {
      status: 'authenticated', token: 'session-token', username: 'proofline-reviewer', error: null,
    },
    configured: true,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

describe('authenticated GitHub presentation', () => {
  it('shows the authenticated allowance without exposing the provider token', () => {
    render(<App />)

    const status = screen.getByLabelText('GitHub connection status')
    expect(status).toHaveTextContent('Connected as proofline-reviewer')
    expect(status).toHaveTextContent('5,000 requests / hour')
    expect(status).not.toHaveTextContent('session-token')
    expect(screen.getByRole('button', { name: 'Use anonymous' })).toBeEnabled()
  })
})
