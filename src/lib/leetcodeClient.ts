import { functionsUrl, supabase } from './supabase.ts'
import type { TodayResult } from '../backend/types.ts'
import type { Difficulty } from './types.ts'

export type Solved = { title: string; slug: string; at: number }

export type VerifyResult =
  | { ok: true; solved: Solved[]; truncated: boolean }
  | { ok: false; reason: 'no-such-user' | 'unavailable'; message: string }

export type ProfileResult =
  | { ok: true; username: string; totalSolved: number }
  | { ok: false; reason: 'no-such-user' | 'unavailable'; message: string }

export type DailyResult =
  | { ok: true; date: string; slug: string; title: string; difficulty: Difficulty; link: string }
  | { ok: false; reason: 'unavailable'; message: string }

async function call(op: string, body: Record<string, unknown> = {}): Promise<Response | null> {
  const endpoint = functionsUrl('leetcode')
  if (!endpoint) return null
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: JSON.stringify({ op, ...body }),
  })
}

const unavailable = (message: string) => ({
  ok: false as const,
  reason: 'unavailable' as const,
  message,
})

export async function fetchDaily(): Promise<DailyResult> {
  try {
    const res = await call('daily')
    if (!res) return unavailable('backend not configured')
    if (!res.ok) return unavailable(`daily lookup failed (${res.status})`)
    return { ok: true, ...(await res.json()) }
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : 'network error')
  }
}

export async function checkProfile(username: string): Promise<ProfileResult> {
  try {
    const res = await call('profile', { username })
    if (!res) return unavailable('backend not configured')
    if (res.status === 404)
      return { ok: false, reason: 'no-such-user', message: 'No LeetCode user by that name' }
    if (!res.ok) return unavailable(`profile lookup failed (${res.status})`)
    const body = await res.json()
    return { ok: true, username: body.username, totalSolved: body.totalSolved }
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : 'network error')
  }
}

export async function verifySolved(
  username: string,
  fromUnix: number,
  toUnix: number,
): Promise<VerifyResult> {
  try {
    const res = await call('verify', { username, fromUnix, toUnix })
    if (!res) return unavailable('backend not configured')
    if (res.status === 404)
      return { ok: false, reason: 'no-such-user', message: 'No LeetCode user by that name' }
    if (!res.ok) return unavailable(`verification failed (${res.status})`)
    const body = await res.json()
    return { ok: true, solved: body.solved ?? [], truncated: Boolean(body.truncated) }
  } catch (err) {
    return unavailable(err instanceof Error ? err.message : 'network error')
  }
}

async function todayCall(
  op: 'today' | 'ante' | 'proof',
  payload: Record<string, unknown> = {},
): Promise<TodayResult> {
  try {
    const res = await call(op, payload)
    if (!res) return { ok: false, reason: 'unavailable', message: 'backend not configured' }
    if (res.status === 429)
      return {
        ok: false,
        reason: 'rate-limited',
        message: 'Wait 30 seconds between checks. Daily limit: 60 checks.',
      }
    if (res.status === 401) {
      return { ok: false, reason: 'unavailable', message: 'Your session expired. Sign in again.' }
    }
    if (res.status === 404) {
      const detail = await res.json().catch(() => ({}))
      return {
        ok: false,
        reason: 'no-such-user',
        message: detail.handle
          ? `LeetCode has no user "${detail.handle}". Check the handle on your profile.`
          : 'No LeetCode user by that name',
      }
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      return {
        ok: false,
        reason: 'unavailable',
        message: detail.error ?? `LeetCode check failed (${res.status})`,
      }
    }
    const body = await res.json()
    if (body.reason === 'nothing-today') {
      return {
        ok: false,
        reason: 'nothing-today',
        message: 'No accepted submissions today yet.',
      }
    }
    return {
      ok: true,
      solved: (body.found ?? []).map((s: Record<string, unknown>) => ({
        slug: String(s.slug),
        title: String(s.title),
        difficulty: (s.difficulty as Difficulty | null) ?? undefined,
        at: Number(s.at),
        isDaily: Boolean(s.isDaily),
      })),
      truncated: Boolean(body.truncated),
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'unavailable',
      message: err instanceof Error ? err.message : 'network error',
    }
  }
}

export const checkToday = (): Promise<TodayResult> => todayCall('today')

export const recordAnte = (draft: { caption?: string; photoPath?: string }): Promise<TodayResult> =>
  todayCall(draft.photoPath ? 'proof' : 'ante', draft)
