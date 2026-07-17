import type { Session } from '@supabase/supabase-js'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearGitHubProviderToken,
  githubTokenFromSession,
  readSupabaseBrowserConfig,
} from './supabase-github'

afterEach(() => clearGitHubProviderToken())

describe('Supabase GitHub authentication helpers', () => {
  it('treats absent browser configuration as an optional feature', () => {
    expect(readSupabaseBrowserConfig({})).toBeNull()
    expect(() => readSupabaseBrowserConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
    })).toThrow('incomplete')
  })

  it('accepts complete public browser configuration', () => {
    expect(readSupabaseBrowserConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_public_key',
    })).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_example_public_key',
    })
  })

  it('keeps the provider token in tab-scoped session storage only', () => {
    const token = ['provider', 'session', 'value'].join('-')
    const session = { provider_token: token } as Session

    expect(githubTokenFromSession(session)).toBe(token)
    expect(githubTokenFromSession({} as Session)).toBe(token)
    expect(githubTokenFromSession(null)).toBeNull()
  })
})
