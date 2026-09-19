import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isBackendConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

export function functionsUrl(name: string): string | null {
  if (!url) return null
  return `${url.replace(/\/$/, '')}/functions/v1/${name}`
}
