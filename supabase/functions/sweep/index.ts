import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sweep } from '../_shared/sweep.ts'
import { dayEndUnix, localDayKey } from '../_shared/time.ts'
import { fetchDaily } from '../_lib/leetcode.ts'
import type { Ante } from '../_shared/types.ts'
import { settleFor, type Powerup } from '../_shared/rules.ts'

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  Vary: 'Origin',
}

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

function constantTimeEqual(a: string | null, b: string): boolean {
  if (a === null || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const secret = Deno.env.get('SWEEP_SECRET')
  if (!secret || !constantTimeEqual(req.headers.get('x-sweep-secret'), secret)) {
    return json({ error: 'forbidden' }, 403)
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: tables, error } = await db
    .from('tables_')
    .select('id, name, tz, last_swept_day, discord_webhook_url')
  if (error) return json({ error: error.message }, 500)

  const now = new Date()
  const report: { tableId: string; daysSwept: string[]; markers: number }[] = []

  const daily = await fetchDaily().catch(() => null)
})
