import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

const TOKEN_KEY = 'proofline.github.provider-token'
const configSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(20),
})

export interface SupabaseBrowserConfig {
  url: string
  publishableKey: string
}

type ProoflineDatabase = {
  public: {
    Tables: Record<never, never>
    Views: Record<never, never>
    Functions: Record<never, never>
  }
}

type ProoflineSupabaseClient = SupabaseClient<ProoflineDatabase>

export type SupabaseConfiguration =
  | { status: 'configured'; config: SupabaseBrowserConfig }
  | { status: 'unconfigured' }
  | { status: 'invalid'; message: string }

/** Validates optional public Supabase browser configuration without exposing secrets. */
export function readSupabaseBrowserConfig(
  environment: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string },
): SupabaseBrowserConfig | null {
  const url = environment.VITE_SUPABASE_URL?.trim() ?? ''
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  if (!url && !publishableKey) return null
  if (!url || !publishableKey) {
    throw new Error('Supabase GitHub authentication configuration is incomplete.')
  }
  return configSchema.parse({ url, publishableKey })
}

function configureSupabase(): SupabaseConfiguration {
  try {
    const config = readSupabaseBrowserConfig(import.meta.env)
    if (!config) return { status: 'unconfigured' }
    return { status: 'configured', config }
  } catch {
    return {
      status: 'invalid',
      message: 'GitHub connection is unavailable because the public Supabase configuration is invalid.',
    }
  }
}

export const SUPABASE_CONFIGURATION = configureSupabase()

let clientPromise: Promise<ProoflineSupabaseClient> | null = null

/** Lazily creates the optional browser auth client so anonymous users do not download it. */
export async function getSupabaseClient(): Promise<ProoflineSupabaseClient | null> {
  if (SUPABASE_CONFIGURATION.status !== 'configured') return null
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) => {
    const { url, publishableKey } = SUPABASE_CONFIGURATION.config
    return createClient<ProoflineDatabase>(url, publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: window.sessionStorage,
      },
    })
  })
  return clientPromise
}

/** Returns and session-scopes the GitHub provider token supplied by Supabase OAuth. */
export function githubTokenFromSession(session: Session | null): string | null {
  if (!session) {
    window.sessionStorage.removeItem(TOKEN_KEY)
    return null
  }
  if (session.provider_token) {
    window.sessionStorage.setItem(TOKEN_KEY, session.provider_token)
    return session.provider_token
  }
  return window.sessionStorage.getItem(TOKEN_KEY)
}

/** Removes the session-scoped provider token after logout or auth failure. */
export function clearGitHubProviderToken(): void {
  window.sessionStorage.removeItem(TOKEN_KEY)
}
