import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  fetchDaily,
  fetchDifficulties,
  fetchProfile,
  fetchRecentAccepted,
  isNoSuchUser,
  within,
} from '../_lib/leetcode.ts'
import { dayEndUnix, dayStartUnix, localDayKey } from '../_shared/time.ts'

const ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'
const CORS = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

const NO_USER = { exists: false, reason: 'no such LeetCode user' }

async function callerId(req: Request): Promise<string | null> {
  const authorization = req.headers.get('Authorization')
  if (!authorization) return null
  const scoped = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  })
  const { data } = await scoped.auth.getUser()
  return data.user?.id ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  let payload: {
    op?: string
    username?: string
    fromUnix?: number
    toUnix?: number
    caption?: string
    photoPath?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'expected a JSON body' }, 400)
  }

  try {
    if (['today', 'ante', 'verify'].includes(payload.op ?? '')) {
      const who = await callerId(req)
      if (!who) return json({ error: 'not signed in' }, 401)
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data, error } = await admin.rpc('consume_verification', { who })
      if (error) return json({ error: 'Verification is temporarily unavailable' }, 503)
      if (!data)
        return json({ error: 'Wait 30 seconds between checks. The daily limit is 60 checks.' }, 429)
    }
    if (payload.op === 'daily') {
      return json(await fetchDaily())
    }

    if (payload.op === 'proof') {
      const userId = await callerId(req)
      if (!userId) return json({ error: 'not signed in' }, 401)
      const db = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data: membership } = await db
        .from('memberships')
        .select('table_id, tables_(tz)')
        .eq('profile_id', userId)
        .order('joined_at')
        .limit(1)
        .maybeSingle()
      if (!membership) return json({ error: 'No table' }, 400)
      const tz = (membership.tables_ as unknown as { tz: string }).tz
      if (!payload.photoPath?.startsWith(`${membership.table_id}/${userId}/`))
        return json({ error: 'Invalid proof path' }, 400)
      const { data: ante } = await db
        .from('antes')
        .select('id')
        .eq('table_id', membership.table_id)
        .eq('profile_id', userId)
        .eq('day_date', localDayKey(new Date(), tz))
        .eq('status', 'verified')
        .order('lc_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!ante) return json({ error: 'Check your LeetCode first' }, 400)
      const { error } = await db
        .from('antes')
        .update({
          photo_path: payload.photoPath,
          caption: payload.caption?.trim().slice(0, 80) || null,
        })
        .eq('id', ante.id)
      if (error) return json({ error: error.message }, 500)
      return json({ found: [], recorded: [ante.id] })
    }
    if (payload.op === 'today') return await todayFor(req, { write: false })
    if (payload.op === 'ante') return await todayFor(req, { write: true, ...payload })

    const username = payload.username?.trim()
    if (!username) return json({ error: 'username required' }, 400)

    if (payload.op === 'profile') {
      let profile: Awaited<ReturnType<typeof fetchProfile>>
      try {
        profile = await fetchProfile(username)
      } catch (err) {
        if (isNoSuchUser(err)) return json(NO_USER, 404)
        throw err
      }
      if (!profile) return json(NO_USER, 404)
      return json({ exists: true, ...profile })
    }

    if (payload.op === 'verify') {
      const { fromUnix, toUnix } = payload
      if (typeof fromUnix !== 'number' || typeof toUnix !== 'number') {
        return json({ error: 'fromUnix and toUnix required' }, 400)
      }
      let recent: Awaited<ReturnType<typeof fetchRecentAccepted>>
      try {
        recent = await fetchRecentAccepted(username)
      } catch (err) {
        if (isNoSuchUser(err)) return json(NO_USER, 404)
        throw err
      }
      if (!recent) return json(NO_USER, 404)
      const { solved, truncated } = within(recent.all, fromUnix, toUnix, recent.limit)
      return json({ solved, count: solved.length, truncated })
    }

    return json({ error: `unknown op ${payload.op}` }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'upstream failure' }, 502)
  }
})
