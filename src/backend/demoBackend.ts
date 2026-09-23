import type {
  AnteDraft,
  Backend,
  Identity,
  SignInResult,
  Snapshot,
  Solved,
  TodayResult,
} from './types.ts'
import type { Ante, Marker } from '../lib/types.ts'
import type { PowerupKind } from '../lib/rules.ts'
import { deadlineOf, settleFor } from '../lib/rules.ts'
import { PROBLEMS } from '../lib/problems.ts'
import { buildDemo } from '../lib/demo.ts'
import { playerIdFor } from '../lib/session.ts'

const KEY = 'cache-out/demo-v2'

type Stored = Snapshot & { identity: Identity | null }

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Stored
  } catch {}
  return { ...buildDemo(), identity: null }
}

function save(state: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    try {
      const trimmed: Stored = {
        ...state,
        antes: state.antes.map(({ photo: _photo, ...rest }) => rest as Ante),
      }
      localStorage.setItem(KEY, JSON.stringify(trimmed))
      console.warn('cache-out: storage full — dropped stored proof photos to keep the ledger')
    } catch {
      console.warn('cache-out: could not persist (storage full)')
    }
  }
}

export function createDemoBackend(): Backend {
  let state = load()

  const commit = (next: Partial<Stored>) => {
    state = { ...state, ...next }
    save(state)
  }

  const inventSolve = (): Solved => {
    const requirement = settleFor(
      state.powerups,
      state.antes,
      state.meId,
      state.today,
      state.daily.slug,
    ).requirement

    if (requirement.daily) {
      return {
        slug: state.daily.slug,
        title: state.daily.title,
        difficulty: state.daily.difficulty,
        at: Math.floor(Date.now() / 1000),
        isDaily: true,
      }
    }

    const pool = requirement.hard ? PROBLEMS.filter((p) => p.difficulty === 'Hard') : PROBLEMS
    const problem = pool[Math.floor(Math.random() * pool.length)] ?? PROBLEMS[0]
    return {
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      at: Math.floor(Date.now() / 1000),
      isDaily: problem.slug === state.daily.slug,
    }
  }

  return {
    kind: 'demo',

    browsableSignedOut: true,

    async currentIdentity() {
      return state.identity
    },

    async signIn({ displayName, leetcodeUsername }): Promise<SignInResult> {
      const id = playerIdFor(displayName)
      const existing = state.players.find((p) => p.id === id)
      const player = existing ?? {
        id,
        displayName: displayName.trim().toUpperCase(),
        leetcodeUsername: leetcodeUsername.trim(),
        suit: (['spade', 'heart', 'club', 'diamond'] as const)[state.players.length % 4],
        chips: 0,
        lifetimeSolved: 0,
        joinedAt: state.today,
      }
      const identity: Identity = {
        playerId: player.id,
        displayName: player.displayName,
        leetcodeUsername: player.leetcodeUsername,
      }
      commit({
        players: existing ? state.players : [...state.players, player],
        meId: player.id,
        identity,
      })
      return { ok: true, identity }
    },

    async signOut() {
      commit({ identity: null })
    },

    async load() {
      const { identity: _identity, ...snapshot } = state
      return snapshot
    },

    async checkToday(): Promise<TodayResult> {
      return { ok: true, solved: [inventSolve()], truncated: false }
    },

    async submitAnte(draft: AnteDraft): Promise<TodayResult> {
      if (draft.photo) {
        const existing = state.antes.find(
          (a) => a.playerId === state.meId && a.dayDate === state.today && a.status === 'verified',
        )
        if (!existing)
          return { ok: false, reason: 'nothing-today', message: 'Check your LeetCode first.' }
        commit({ antes: state.antes.map((a) => (a.id === existing.id ? { ...a, ...draft } : a)) })
        return { ok: true, solved: [], truncated: false }
      }
      const found = inventSolve()
      const id = `${state.today}-${state.meId}-${found.slug}`
      const ante: Ante = {
        id,
        playerId: state.meId,
        dayDate: state.today,
        status: 'verified',
        lcSlug: found.slug,
        lcTitle: found.title,
        lcDifficulty: found.difficulty,
        lcTimestamp: found.at,
        isDaily: found.isDaily,
        photo: draft.photo,
        caption: draft.caption,
        chipsAwarded: 0,
        reactions: {},
        comments: [],
        calls: [],
      }
      commit({ antes: [...state.antes.filter((a) => a.id !== id), ante] })
      return { ok: true, solved: [found], truncated: false }
    },

    async pay(to, cents) {
      if (
        !Number.isSafeInteger(cents) ||
        cents <= 0 ||
        to === state.meId ||
        !state.players.some((p) => p.id === to)
      )
        throw new Error('Invalid payment')
      if (state.payments.some((p) => p.from === state.meId && p.to === to && !p.confirmedAt))
        throw new Error('A payment is already pending')
      commit({
        payments: [
          ...state.payments,
          {
            id: crypto.randomUUID(),
            from: state.meId,
            to,
            cents,
            createdAt: new Date().toISOString(),
          },
        ],
      })
    },
    async confirmPayment(id) {
      const payment = state.payments.find((p) => p.id === id)
      if (!payment || payment.to !== state.meId || payment.confirmedAt)
        throw new Error('Only the recipient can confirm')
      commit({
        payments: state.payments.map((p) =>
          p.id === id ? { ...p, confirmedAt: new Date().toISOString() } : p,
        ),
      })
    },
  } as Backend & {
    applySweep: (m: Marker[], p: Snapshot['powerups'], d: string) => void
  }
}
