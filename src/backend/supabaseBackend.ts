import type { SupabaseClient } from '@supabase/supabase-js'
import type { AnteDraft, Backend, Identity, SignInResult, Snapshot } from './types.ts'
import type { Ante, Marker, Player, Suit } from '../lib/types.ts'
import type { Powerup, PowerupKind } from '../lib/rules.ts'
import { checkProfile, checkToday, fetchDaily, recordAnte } from '../lib/leetcodeClient.ts'
import { localDayKey } from '../lib/time.ts'
import {
  clearInvite,
  inviteLink,
  joinCodeFromUrl,
  makeJoinCode,
  pendingInvite,
  rememberInvite,
} from '../lib/session.ts'

const SUITS: Suit[] = ['spade', 'heart', 'club', 'diamond']

const PROOF_URL_TTL = 60 * 60

type Row = Record<string, unknown>

const asAnte = (
  r: Row,
  reactions: Ante['reactions'],
  comments: Ante['comments'],
  signedProofs?: Map<string, string>,
): Ante => ({
  id: String(r.id),
  playerId: String(r.profile_id),
  dayDate: String(r.day_date),
  status: r.status as Ante['status'],
  lcSlug: (r.lc_slug as string) ?? undefined,
  lcTitle: (r.lc_title as string) ?? undefined,
  lcDifficulty: (r.lc_difficulty as Ante['lcDifficulty']) ?? undefined,
  lcTimestamp: (r.lc_timestamp as number) ?? undefined,
  isDaily: Boolean(r.is_daily),

  photo: resolveProof(r.photo_path as string | null, signedProofs),
  caption: (r.caption as string) ?? undefined,
  chipsAwarded: 0,
  reactions,
  comments,
  calls: [],
})

function resolveProof(stored: string | null, signed?: Map<string, string>): string | undefined {
  if (!stored) return undefined
  if (stored.startsWith('data:')) return stored
  return signed?.get(stored)
}

function readable(err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err)
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Could not reach the server. Check VITE_SUPABASE_URL and your connection.'
  }
  return message
}

export function createSupabaseBackend(db: SupabaseClient): Backend {
  let tableId: string | null = null

  async function requireUser(): Promise<string> {
    const { data } = await db.auth.getUser()
    if (!data.user) throw new Error('not signed in')
    return data.user.id
  }

  async function redeemPendingInvite(): Promise<string | null> {
    const code = pendingInvite()
    if (!code) return null
    const { data, error } = await db.rpc('join_table_by_code', { code })

    clearInvite()
    if (error) return null
    return String(data)
  }

  async function resolveTable(userId: string): Promise<string> {
    if (tableId) return tableId

    const invited = await redeemPendingInvite()
    if (invited) {
      tableId = invited
      return tableId
    }

    const { data: memberships } = await db
      .from('memberships')
      .select('table_id')
      .eq('profile_id', userId)

      .order('joined_at', { ascending: true })
      .limit(1)

    if (memberships?.length) {
      tableId = String(memberships[0].table_id)
      return tableId
    }

    const { data: profile } = await db
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
    const owner = profile?.display_name ? String(profile.display_name) : 'YOUR'

    const { data: created, error } = await db.rpc('create_table', {
      table_name: `${owner}'S TABLE`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      code: makeJoinCode(),
    })
    if (error) throw new Error(error.message)
    tableId = String(created)
    return tableId
  }

  async function uploadProof(
    dataUrl: string,
    userId: string,
    tableIdForPath: string,
  ): Promise<string | undefined> {
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const path = `${tableIdForPath}/${userId}/${localDayKey(new Date(), 'UTC')}-${crypto.randomUUID()}.jpg`
      const { error } = await db.storage.from('proofs').upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: false,
      })
      if (error) throw new Error(error.message)
      return path
    } catch {
      throw new Error('Could not upload your proof. Try again.')
    }
  }

  async function signProofs(paths: string[]): Promise<Map<string, string>> {
    const signed = new Map<string, string>()
    const real = paths.filter((path) => path && !path.startsWith('data:'))
    if (real.length === 0) return signed
    const { data } = await db.storage.from('proofs').createSignedUrls(real, PROOF_URL_TTL)
    for (const entry of data ?? []) {
      if (entry.signedUrl && entry.path) signed.set(entry.path, entry.signedUrl)
    }
    return signed
  }

  return {
    kind: 'supabase',
    browsableSignedOut: false,

    async currentIdentity(): Promise<Identity | null> {
      let data: { user: { id: string } | null }
      try {
        ;({ data } = await db.auth.getUser())
      } catch {
        return null
      }
      if (!data.user) return null
      const { data: profile } = await db
        .from('profiles')
        .select('id, display_name, leetcode_username')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!profile) {
        const { data: userData } = await db.auth.getUser()
        const meta = userData.user?.user_metadata
        if (!meta?.display_name || !meta?.leetcode_username) return null
        const { error } = await db
          .from('profiles')
          .insert({
            id: data.user.id,
            display_name: String(meta.display_name).slice(0, 14),
            leetcode_username: String(meta.leetcode_username),
          })
        if (error) throw new Error(readable(error))
        return {
          playerId: data.user.id,
          displayName: String(meta.display_name),
          leetcodeUsername: String(meta.leetcode_username),
        }
      }
      return {
        playerId: String(profile.id),
        displayName: String(profile.display_name),
        leetcodeUsername: String(profile.leetcode_username),
      }
    },

    async signIn({ email, displayName, leetcodeUsername }): Promise<SignInResult> {
      try {
        const { data: session } = await db.auth.getUser()

        if (session.user) {
          const { error } = await db.from('profiles').upsert({
            id: session.user.id,
            display_name: displayName.trim().toUpperCase().slice(0, 14),
            leetcode_username: leetcodeUsername.trim(),
          })
          if (error) return { ok: false, message: readable(error) }
          await resolveTable(session.user.id)
          return {
            ok: true,
            identity: {
              playerId: session.user.id,
              displayName: displayName.trim().toUpperCase(),
              leetcodeUsername: leetcodeUsername.trim(),
            },
          }
        }

        const checked = await checkProfile(leetcodeUsername.trim())
        if (!checked.ok) return { ok: false, message: checked.message }
        if (!email?.trim()) return { ok: false, message: 'Email required to sign in' }

        const invite = joinCodeFromUrl()
        if (invite) rememberInvite(invite)

        const { error } = await db.auth.signInWithOtp({
          email: email.trim(),
          options: {
            emailRedirectTo: invite ? inviteLink(invite) : window.location.origin,
            data: { display_name: displayName.trim(), leetcode_username: leetcodeUsername.trim() },
          },
        })
        if (error) return { ok: false, message: readable(error) }
        return { ok: 'pending', message: `Check ${email.trim()} for a sign-in link.` }
      } catch (err) {
        return { ok: false, message: readable(err) }
      }
    },

    async signOut() {
      tableId = null
      await db.auth.signOut()
    },

    async load(): Promise<Snapshot> {
      const userId = await requireUser()
      const id = await resolveTable(userId)

      const [tableRes, memberRes, anteRes, powerRes, markerRes, paymentRes] = await Promise.all([
        db.from('tables_').select('*').eq('id', id).single(),
        db.from('memberships').select('profile_id, joined_at, profiles(*)').eq('table_id', id),
        db.from('antes').select('*').eq('table_id', id),
        db.from('powerups').select('*').eq('table_id', id),
        db.from('markers').select('*').eq('table_id', id),
        db.from('payments').select('*').eq('table_id', id),
      ])
      if (tableRes.error) throw new Error(readable(tableRes.error))

      if (paymentRes.error) throw new Error(readable(paymentRes.error))
      const t = tableRes.data
      const tz = String(t.tz)
      const today = localDayKey(new Date(), tz)

      const anteIds = (anteRes.data ?? []).map((a) => String(a.id))
      const [reactionRes, commentRes] = await Promise.all([
        anteIds.length ? db.from('reactions').select('*').in('ante_id', anteIds) : { data: [] },
        anteIds.length ? db.from('comments').select('*').in('ante_id', anteIds) : { data: [] },
      ])

      const reactionsByAnte = new Map<string, Ante['reactions']>()
      for (const r of (reactionRes.data ?? []) as Row[]) {
        const key = String(r.ante_id)
        const bucket = reactionsByAnte.get(key) ?? {}
        const emoji = String(r.emoji)
        bucket[emoji] = [...(bucket[emoji] ?? []), String(r.profile_id)]
        reactionsByAnte.set(key, bucket)
      }

      const commentsByAnte = new Map<string, Ante['comments']>()
      for (const c of (commentRes.data ?? []) as Row[]) {
        const key = String(c.ante_id)
        commentsByAnte.set(key, [
          ...(commentsByAnte.get(key) ?? []),
          {
            id: String(c.id),
            playerId: String(c.profile_id),
            body: String(c.body),
            createdAt: String(c.created_at),
          },
        ])
      }

      const signedProofs = await signProofs(
        (anteRes.data ?? []).map((a) => String((a as Row).photo_path ?? '')).filter(Boolean),
      )

      const players: Player[] = (memberRes.data ?? []).map((row, i) => {
        const m = row as unknown as Row
        const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Row
        return {
          id: String(p.id),
          displayName: String(p.display_name),
          leetcodeUsername: String(p.leetcode_username),
          suit: (p.suit as Suit) ?? SUITS[i % SUITS.length],
          chips: 0,
          lifetimeSolved: Number(p.lifetime_solved ?? 0),
          usernameLockedUntil: (p.username_locked_until as string) ?? undefined,
          venmoHandle: (p.venmo_handle as string) ?? undefined,
          joinedAt: String(m.joined_at ?? today),
        }
      })

      const daily = await fetchDaily()

      return {
        table: {
          id: String(t.id),
          name: String(t.name),
          discordWebhookUrl: t.discord_webhook_url ?? undefined,
          joinCode: String(t.join_code),
          buyInCents: 100,
          tz,
          doubleOrNothingEnabled: false,
          rakeBps: 0,
        },
        players,
        meId: userId,
        today,
        daily: daily.ok
          ? {
              date: daily.date,
              slug: daily.slug,
              title: daily.title,
              difficulty: daily.difficulty,
              link: daily.link,
            }
          : {
              date: today,
              slug: '',
              title: 'Daily unavailable',
              difficulty: 'Medium',
              link: '/problemset/',
            },
        antes: (anteRes.data ?? []).map((a) =>
          asAnte(
            a as Row,
            reactionsByAnte.get(String(a.id)) ?? {},
            commentsByAnte.get(String(a.id)) ?? [],
            signedProofs,
          ),
        ),
        payments: (paymentRes.data ?? []).map((p) => ({
          id: String(p.id),
          from: String(p.from_profile),
          to: String(p.to_profile),
          cents: Number(p.cents),
          createdAt: String(p.created_at),
          confirmedAt: p.confirmed_at ? String(p.confirmed_at) : undefined,
        })),
        markers: (markerRes.data ?? []).map((m): Marker => ({
          id: String(m.id),
          debtorId: String(m.debtor_id),
          creditorId: String(m.creditor_id),
          cents: Number(m.cents),
          reason: String(m.reason),
          dayDate: String(m.day_date),
          settledIn: (m.settled_in as string) ?? undefined,
        })),
        powerups: (powerRes.data ?? []).map((p): Powerup => ({
          id: String(p.id),
          kind: p.kind as PowerupKind,
          fromId: String(p.from_id),
          targetId: String(p.target_id),
          playedOn: String(p.played_on),
          clearedOn: (p.cleared_on as string) ?? undefined,
        })),
        lastSweptDay: String(t.last_swept_day),
      }
    },

    checkToday,

    async submitAnte(draft: AnteDraft) {
      let photoPath: string | undefined
      if (draft.photo) {
        const userId = await requireUser()
        photoPath = await uploadProof(draft.photo, userId, await resolveTable(userId))
      }
      return recordAnte({ caption: draft.caption, photoPath })
    },

    async pay(to, cents) {
      const from = await requireUser()
      const { error } = await db
        .from('payments')
        .insert({ table_id: await resolveTable(from), from_profile: from, to_profile: to, cents })
      if (error) throw new Error(readable(error))
    },
    async confirmPayment(id) {
      const { error } = await db
        .from('payments')
        .update({ confirmed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('to_profile', await requireUser())
        .is('confirmed_at', null)
      if (error) throw new Error(readable(error))
    },
    async playPowerup(targetId: string, kind: PowerupKind) {
      const userId = await requireUser()
      const id = await resolveTable(userId)
      const { data: t } = await db.from('tables_').select('tz').eq('id', id).single()

      const { error } = await db.from('powerups').insert({
        table_id: id,
        kind,
        from_id: userId,
        target_id: targetId,
        played_on: localDayKey(new Date(), String(t?.tz ?? 'UTC')),
      })
      if (error) throw new Error(readable(error))
    },

    async react(anteId: string, emoji: string) {
      const userId = await requireUser()
      const { data: existing } = await db
        .from('reactions')
        .select('emoji')
        .eq('ante_id', anteId)
        .eq('profile_id', userId)
        .eq('emoji', emoji)
        .maybeSingle()
      if (existing) {
        await db
          .from('reactions')
          .delete()
          .eq('ante_id', anteId)
          .eq('profile_id', userId)
          .eq('emoji', emoji)
      } else {
        await db.from('reactions').insert({ ante_id: anteId, profile_id: userId, emoji })
      }
    },

    async comment(anteId: string, body: string) {
      const userId = await requireUser()
      await db.from('comments').insert({ ante_id: anteId, profile_id: userId, body })
    },

    async updateProfile(patch) {
      const userId = await requireUser()
      const { error } = await db
        .from('profiles')
        .update({
          ...(patch.venmoHandle !== undefined
            ? { venmo_handle: patch.venmoHandle.trim() || null }
            : {}),
          ...(patch.displayName !== undefined ? { display_name: patch.displayName.trim() } : {}),
          ...(patch.leetcodeUsername !== undefined
            ? { leetcode_username: patch.leetcodeUsername.trim() }
            : {}),
        })
        .eq('id', userId)
      if (error) return { ok: false as const, message: readable(error) }
      return { ok: true as const }
    },

    async updateTable(patch) {
      new Intl.DateTimeFormat('en', { timeZone: patch.tz })
      const { error } = await db
        .from('tables_')
        .update({
          name: patch.name,
          tz: patch.tz,
          discord_webhook_url: patch.discordWebhookUrl || null,
        })
        .eq('id', await resolveTable(await requireUser()))
      if (error) throw new Error(readable(error))
    },
    async joinByCode(code: string) {
      const { data, error } = await db.rpc('join_table_by_code', { code })
      if (error) return { ok: false as const, message: 'No table with that code' }
      tableId = String(data)
      return { ok: true as const }
    },

    subscribe(onChange: () => void) {
      const channel = db
        .channel('table-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, onChange)

        .on('postgres_changes', { event: '*', schema: 'public', table: 'antes' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'powerups' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'markers' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'memberships' }, onChange)
        .subscribe()
      return () => {
        void db.removeChannel(channel)
      }
    },
  }
}
