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

  for (const table of tables ?? []) {
    const [{ data: members }, { data: antes }, { data: powerups }, { data: days }] =
      await Promise.all([
        db
          .from('memberships')
          .select('profile_id, profiles(display_name)')
          .eq('table_id', table.id),

        db
          .from('antes')
          .select(
            'id, profile_id, day_date, status, lc_slug, lc_difficulty, lc_timestamp, is_daily',
          )
          .eq('table_id', table.id),
        db.from('powerups').select('*').eq('table_id', table.id),
        db.from('days').select('date, daily_slug').eq('table_id', table.id),
      ])

    const dailyByDay = new Map(
      (days ?? []).map((d) => [d.date as string, d.daily_slug as string | null]),
    )

    if (daily) {
      const todayKey = localDayKey(now, table.tz)
      if (!dailyByDay.has(todayKey)) {
        await db.from('days').upsert(
          {
            table_id: table.id,
            date: todayKey,
            daily_slug: daily.slug,
            daily_title: daily.title,
            daily_difficulty: daily.difficulty,
          },
          { onConflict: 'table_id,date', ignoreDuplicates: true },
        )
      }
    }

    const input = {
      tz: table.tz,
      lastSweptDay: table.last_swept_day,
      playerIds: (members ?? []).map((m) => m.profile_id as string),

      antes: (antes ?? []).map((a): Ante => ({
        id: a.id,
        playerId: a.profile_id,
        dayDate: a.day_date,
        status: a.status,
        lcSlug: a.lc_slug ?? undefined,
        lcDifficulty: a.lc_difficulty ?? undefined,
        lcTimestamp: a.lc_timestamp ?? undefined,
        isDaily: a.is_daily,
        chipsAwarded: 0,
        reactions: {},
        comments: [],
        calls: [],
      })),
      powerups: (powerups ?? []).map((p): Powerup => ({
        id: p.id,
        kind: p.kind,
        fromId: p.from_id,
        targetId: p.target_id,
        playedOn: p.played_on,
        clearedOn: p.cleared_on ?? undefined,
      })),
      dailySlugFor: (day: string) => dailyByDay.get(day) ?? undefined,
    }
    const result = sweep(input, now)

    const nameOf = (id: string) => {
      const member = members?.find((m) => m.profile_id === id)
      const profile = member?.profiles as unknown as { display_name: string } | null
      return profile?.display_name ?? 'Someone'
    }
    const sendOnce = async (day: string, kind: string, content: string) => {
      const url = table.discord_webhook_url
      if (!url || !/^https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+$/.test(url))
        return
      const { error: claimed } = await db
        .from('notifications')
        .insert({ table_id: table.id, day, kind })
      if (claimed?.code === '23505') return
      if (claimed) throw new Error(claimed.message)

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.slice(0, 1900), allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok)
        console.error('Discord notification failed', table.id, day, kind, response.status)
    }
    const today = localDayKey(now, table.tz)
    const hoursLeft = (dayEndUnix(today, table.tz) * 1000 - now.getTime()) / 3600000
    if (hoursLeft > 2 && hoursLeft <= 3) {
      const out = input.playerIds.filter(
        (id) =>
          settleFor(input.powerups, input.antes, id, today, dailyByDay.get(today) ?? daily?.slug)
            .status !== 'clear',
      )
      await sendOnce(
        today,
        'reminder',
        `${table.name}: 3 hours left. ${out.length ? out.map(nameOf).join(', ') + ' — still out.' : 'Everyone is clear.'}`,
      )
    }
    if (result.daysSwept.length === 0) continue

    if (result.markers.length > 0) {
      const { error: insertError } = await db.from('markers').upsert(
        result.markers.map((m) => ({
          table_id: table.id,
          debtor_id: m.debtorId,
          creditor_id: m.creditorId,
          cents: m.cents,
          reason: m.reason,
          day_date: m.dayDate,
        })),
        { onConflict: 'table_id,debtor_id,creditor_id,day_date,reason', ignoreDuplicates: true },
      )

      if (insertError) return json({ error: insertError.message, tableId: table.id }, 500)
    }

    if (result.failedPowerups.length > 0) {
      const { error: powerupError } = await db
        .from('powerups')
        .update({ cleared_on: result.lastSweptDay })
        .in('id', result.failedPowerups)

      if (powerupError) return json({ error: powerupError.message, tableId: table.id }, 500)
    }

    for (const day of result.daysSwept) {
      const clear = input.playerIds.filter(
        (id) =>
          settleFor(input.powerups, input.antes, id, day, dailyByDay.get(day) ?? undefined)
            .status === 'clear',
      )
      const debts = new Map<string, number>()
      for (const marker of result.markers.filter((m) => m.dayDate === day))
        debts.set(marker.debtorId, (debts.get(marker.debtorId) ?? 0) + marker.cents)
      await sendOnce(
        day,
        'closed',
        `${table.name}: ${day} closed. Clear: ${clear.map(nameOf).join(', ') || 'nobody'}. ${[...debts].map(([id, cents]) => `${nameOf(id)} owes $${(cents / 100).toFixed(2)}`).join('; ') || 'All square.'}`,
      )
    }
    await db.from('tables_').update({ last_swept_day: result.lastSweptDay }).eq('id', table.id)

    report.push({
      tableId: table.id,
      daysSwept: result.daysSwept,
      markers: result.markers.length,
    })
  }

  return json({ swept: report, tablesChecked: tables?.length ?? 0 })
})
