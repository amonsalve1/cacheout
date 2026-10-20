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
  }
}
