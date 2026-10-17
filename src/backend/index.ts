import type { Backend } from './types.ts'
import { supabase, isBackendConfigured } from '../lib/supabase.ts'
import { createDemoBackend } from './demoBackend.ts'
import { createSupabaseBackend } from './supabaseBackend.ts'

let instance: Backend | null = null

declare const __DEMO_AVAILABLE__: boolean

export function backend(): Backend {
  if (!instance) {
    if (isBackendConfigured && supabase) {
      instance = createSupabaseBackend(supabase)
    } else if (__DEMO_AVAILABLE__) {
      instance = createDemoBackend()
    } else {
      throw new Error('No backend configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
    }
  }
  return instance
}

export const backendKind = (): Backend['kind'] => backend().kind

export type {
  AnteDraft,
  Backend,
  Identity,
  SignInResult,
  Snapshot,
  Solved,
  TodayResult,
} from './types.ts'
