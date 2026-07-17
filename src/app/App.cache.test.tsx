import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createDemoCase } from '../demo/demo-fixture'
import { App } from './App'

const analyzeGitHubChange = vi.hoisted(() => vi.fn())

vi.mock('./analysis/analyze-github', () => ({ analyzeGitHubChange }))
vi.mock('./use-github-auth', () => ({
  useGitHubAuth: () => ({
    state: { status: 'anonymous', error: null },
    configured: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

describe('active GitHub analysis cache', () => {
  it('reopens the same analysis without repeating its GitHub workflow', async () => {
    const user = userEvent.setup()
    analyzeGitHubChange.mockResolvedValue(createDemoCase())
    render(<App />)

    const url = 'https://github.com/acme/tool/pull/2'
    await user.type(screen.getByLabelText('Public GitHub change'), url)
    await user.click(screen.getByRole('button', { name: 'Analyze evidence' }))
    expect(await screen.findByRole('heading', { name: 'Add reviewer evidence exports' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'New case' }))
    await user.click(screen.getByRole('button', { name: 'Analyze evidence' }))
    expect(await screen.findByRole('heading', { name: 'Add reviewer evidence exports' })).toBeVisible()

    expect(analyzeGitHubChange).toHaveBeenCalledTimes(1)
  })
})
