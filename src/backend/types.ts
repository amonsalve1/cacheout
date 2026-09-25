import type { Ante, DailyChallenge, Marker, Payment, Player, TableConfig } from '../lib/types.ts'
import type { Powerup, PowerupKind } from '../lib/rules.ts'

export type Snapshot = {
  table: TableConfig
  players: Player[]
  meId: string
  today: string
  daily: DailyChallenge
  antes: Ante[]
  markers: Marker[]
  payments: Payment[]
  powerups: Powerup[]
  lastSweptDay: string
}

export type Identity = {
  playerId: string
  displayName: string
  leetcodeUsername: string
}

export type Solved = {
  slug: string
  title: string
  difficulty?: Ante['lcDifficulty']

  at: number
  isDaily: boolean
}

export type TodayResult =
  | { ok: true; solved: Solved[]; truncated: boolean }
  | {
      ok: false
      reason: 'nothing-today' | 'no-such-user' | 'unavailable' | 'rate-limited'
      message: string
    }

export type AnteDraft = {
  photo?: string
  caption?: string
}

export type SignInResult =
  | { ok: true; identity: Identity }
  | { ok: 'pending'; message: string }
  | { ok: false; message: string }

export interface Backend {
  readonly kind: 'demo' | 'supabase'

  readonly browsableSignedOut: boolean

  currentIdentity(): Promise<Identity | null>
  signIn(input: {
    email?: string
    displayName: string
    leetcodeUsername: string
  }): Promise<SignInResult>
  signOut(): Promise<void>

  load(): Promise<Snapshot>

  checkToday(): Promise<TodayResult>

  submitAnte(draft: AnteDraft): Promise<TodayResult>
  pay(to: string, cents: number): Promise<void>
  confirmPayment(id: string): Promise<void>
  playPowerup(targetId: string, kind: PowerupKind): Promise<void>
  react(anteId: string, emoji: string): Promise<void>
  comment(anteId: string, body: string): Promise<void>

  updateProfile(patch: {
    venmoHandle?: string
    displayName?: string
    leetcodeUsername?: string
  }): Promise<{ ok: true } | { ok: false; message: string }>

  updateTable(patch: { name: string; tz: string; discordWebhookUrl?: string }): Promise<void>
  joinByCode(code: string): Promise<{ ok: true } | { ok: false; message: string }>

  subscribe(onChange: () => void): () => void
}

export function emptySnapshot(): Snapshot {
  const today = new Date().toISOString().slice(0, 10)
  return {
    table: {
      id: '',
      name: '',
      joinCode: '',
      buyInCents: 100,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      doubleOrNothingEnabled: false,
      rakeBps: 0,
    },
    players: [],
    meId: '',
    today,
    daily: { date: today, slug: '', title: '', difficulty: 'Medium', link: '' },
    antes: [],
    markers: [],
    payments: [],
    powerups: [],
    lastSweptDay: today,
  }
}
