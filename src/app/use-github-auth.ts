import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  clearGitHubProviderToken,
  getSupabaseClient,
  githubTokenFromSession,
  SUPABASE_CONFIGURATION,
} from '../integrations/auth/supabase-github'

export type GitHubAuthState =
  | { status: 'unconfigured'; token: null; username: null; error: null }
  | { status: 'loading'; token: null; username: null; error: null }
  | { status: 'anonymous'; token: null; username: null; error: null }
  | { status: 'authenticated'; token: string; username: string; error: null }
  | { status: 'error'; token: null; username: null; error: string }

function usernameFrom(session: Session): string {
  const metadata: unknown = session.user.user_metadata
  if (!metadata || typeof metadata !== 'object') return 'GitHub user'
  const record = metadata as Record<string, unknown>
  for (const key of ['user_name', 'preferred_username', 'login']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return 'GitHub user'
}

/** Manages optional Supabase GitHub OAuth while keeping provider tokens tab-scoped. */
export function useGitHubAuth() {
  const [state, setState] = useState<GitHubAuthState>(() => {
    if (SUPABASE_CONFIGURATION.status === 'unconfigured') {
      return { status: 'unconfigured', token: null, username: null, error: null }
    }
    if (SUPABASE_CONFIGURATION.status === 'invalid') {
      return { status: 'error', token: null, username: null, error: SUPABASE_CONFIGURATION.message }
    }
    return { status: 'loading', token: null, username: null, error: null }
  })

  useEffect(() => {
    if (SUPABASE_CONFIGURATION.status !== 'configured') return
    let active = true
    let unsubscribe: (() => void) | null = null

    function applySession(session: Session | null): void {
      if (!active) return
      const token = githubTokenFromSession(session)
      if (session && token) {
        setState({
          status: 'authenticated', token, username: usernameFrom(session), error: null,
        })
      } else {
        setState({ status: 'anonymous', token: null, username: null, error: null })
      }
    }

    void getSupabaseClient().then(async (client) => {
      if (!active || !client) return
      const { data: authState } = client.auth.onAuthStateChange((_event, session) => applySession(session))
      unsubscribe = () => authState.subscription.unsubscribe()

      const { data, error } = await client.auth.getSession()
      if (!active) return
      if (error) {
        clearGitHubProviderToken()
        setState({ status: 'error', token: null, username: null, error: 'GitHub session initialization failed.' })
        return
      }
      applySession(data.session)
    }).catch(() => {
      if (!active) return
      clearGitHubProviderToken()
      setState({ status: 'error', token: null, username: null, error: 'GitHub session initialization failed.' })
    })

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const connect = useCallback(async (): Promise<void> => {
    if (SUPABASE_CONFIGURATION.status !== 'configured') return
    setState({ status: 'loading', token: null, username: null, error: null })
    try {
      const client = await getSupabaseClient()
      if (!client) return
      const { error } = await client.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
      })
      if (!error) return
      setState({ status: 'error', token: null, username: null, error: 'GitHub connection could not be started.' })
    } catch {
      setState({ status: 'error', token: null, username: null, error: 'GitHub connection could not be started.' })
    }
  }, [])

  const disconnect = useCallback(async (): Promise<void> => {
    if (SUPABASE_CONFIGURATION.status !== 'configured') return
    try {
      const client = await getSupabaseClient()
      const { error } = client ? await client.auth.signOut() : { error: null }
      clearGitHubProviderToken()
      setState(error
        ? { status: 'error', token: null, username: null, error: 'GitHub sign-out did not complete.' }
        : { status: 'anonymous', token: null, username: null, error: null })
    } catch {
      clearGitHubProviderToken()
      setState({ status: 'error', token: null, username: null, error: 'GitHub sign-out did not complete.' })
    }
  }, [])

  return {
    state,
    configured: SUPABASE_CONFIGURATION.status === 'configured',
    connect,
    disconnect,
  }
}
