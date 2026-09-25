import { useMemo } from 'react'
import { create } from 'zustand'
import type { Marker } from '../lib/types.ts'
import type { AnteDraft, Identity, Snapshot, TodayResult } from '../backend/index.ts'
import type { PowerupKind } from '../lib/rules.ts'
import { backend } from '../backend/index.ts'
import { emptySnapshot } from '../backend/types.ts'
import { sweep } from '../lib/sweep.ts'

export type Status = 'loading' | 'ready' | 'error'

type Actions = {
  init: () => Promise<void>
  refresh: () => Promise<void>

  dismissError: () => void

  toggleMuted: () => void

  signIn: (input: {
    email?: string
    displayName: string
    leetcodeUsername: string
  }) => Promise<{ ok: true } | { ok: 'pending'; message: string } | { ok: false; message: string }>
  signOut: () => Promise<void>
  updateTable: (patch: { name: string; tz: string; discordWebhookUrl?: string }) => Promise<void>
  joinByCode: (code: string) => Promise<{ ok: true } | { ok: false; message: string }>
  updateProfile: (patch: {
    venmoHandle?: string
    displayName?: string
    leetcodeUsername?: string
  }) => Promise<{ ok: true } | { ok: false; message: string }>

  checkToday: () => Promise<TodayResult>
  submitAnte: (draft: AnteDraft) => Promise<TodayResult>
  pay: (to: string, cents: number) => Promise<void>
  confirmPayment: (id: string) => Promise<void>
  playPowerup: (targetId: string, kind: PowerupKind) => Promise<void>
  react: (anteId: string, emoji: string) => Promise<void>
  comment: (anteId: string, body: string) => Promise<void>

  runSweep: (now?: Date) => { daysSwept: string[]; markersAdded: number }
}

export type TableStore = Snapshot & {
  status: Status
  error: string | null
  identity: Identity | null
  muted: boolean
} & Actions

async function attempt(
  set: (partial: Partial<TableStore>) => void,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run()
    set({ error: null })
  } catch (err) {
    set({ error: err instanceof Error ? err.message : 'that did not go through' })
  }
}

export const useTable = create<TableStore>()((set, get) => ({
  ...emptySnapshot(),
  status: 'loading',
  error: null,
  identity: null,
  muted: true,

  init: async () => {
    const api = backend()
    try {
      const identity = await api.currentIdentity()
      if (!identity) {
        if (api.browsableSignedOut) {
          const snapshot = await api.load()
          set({ ...snapshot, identity: null, status: 'ready', error: null })
        } else {
          set({ ...emptySnapshot(), identity: null, status: 'ready' })
        }
        return
      }
      const snapshot = await api.load()
      set({ ...snapshot, identity, status: 'ready', error: null })
      api.subscribe(() => {
        void get().refresh()
      })
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'could not load the table',
      })
    }
  },

  refresh: async () => {
    try {
      const snapshot = await backend().load()
      set({ ...snapshot, error: null })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'could not refresh' })
    }
  },

  toggleMuted: () => set((s) => ({ muted: !s.muted })),

  signIn: async (input) => {
    const result = await backend().signIn(input)
    if (result.ok === true) {
      await get().init()
      return { ok: true }
    }
    if (result.ok === 'pending') return { ok: 'pending', message: result.message }
    return { ok: false, message: result.message }
  },

  signOut: async () => {
    await backend().signOut()

    set({ ...emptySnapshot(), identity: null, status: 'ready', error: null })
  },

  dismissError: () => set({ error: null }),

  updateProfile: async (patch) => {
    const result = await backend().updateProfile(patch)
    if (result.ok) await get().refresh()
    return result
  },

  updateTable: async (patch) => {
    await attempt(set, async () => {
      await backend().updateTable(patch)
      await get().refresh()
    })
  },
  joinByCode: async (code) => {
    const result = await backend().joinByCode(code)
    if (result.ok) await get().refresh()
    return result
  },

  checkToday: () => backend().checkToday(),

  submitAnte: async (draft) => {
    const result = await backend().submitAnte(draft)

    if (result.ok) await get().refresh()
    return result
  },

  pay: async (to, cents) => {
    await attempt(set, async () => {
      await backend().pay(to, cents)
      await get().refresh()
    })
  },
  confirmPayment: async (id) => {
    await attempt(set, async () => {
      await backend().confirmPayment(id)
      await get().refresh()
    })
  },
  playPowerup: async (targetId, kind) => {
    if (targetId === get().meId) return
    await attempt(set, async () => {
      await backend().playPowerup(targetId, kind)
      await get().refresh()
    })
  },

  react: async (anteId, emoji) => {
    await attempt(set, async () => {
      await backend().react(anteId, emoji)
      await get().refresh()
    })
  },

  comment: async (anteId, body) => {
    await attempt(set, async () => {
      await backend().comment(anteId, body)
      await get().refresh()
    })
  },

  runSweep: (now = new Date()) => {
    const s = get()

    if (backend().kind !== 'demo') return { daysSwept: [], markersAdded: 0 }

    const result = sweep(
      {
        tz: s.table.tz,
        lastSweptDay: s.lastSweptDay,
        playerIds: s.players.map((p) => p.id),
        antes: s.antes,
        powerups: s.powerups,
        dailySlugFor: (day) => (day === s.today ? s.daily.slug : undefined),
      },
      now,
    )
    if (result.daysSwept.length === 0) return { daysSwept: [], markersAdded: 0 }

    const failed = new Set(result.failedPowerups)
    const markers: Marker[] = [
      ...s.markers,
      ...result.markers.map((m, i): Marker => ({ ...m, id: `swp-${s.markers.length + i}` })),
    ]
    const powerups = s.powerups.map((p) =>
      failed.has(p.id) ? { ...p, clearedOn: result.lastSweptDay } : p,
    )
    set({ markers, powerups, lastSweptDay: result.lastSweptDay })

    const api = backend() as ReturnType<typeof backend> & {
      applySweep?: (m: Marker[], p: typeof powerups, d: string) => void
    }
    api.applySweep?.(markers, powerups, result.lastSweptDay)

    return { daysSwept: result.daysSwept, markersAdded: result.markers.length }
  },
}))

export function useToday() {
  const antes = useTable((s) => s.antes)
  const players = useTable((s) => s.players)
  const today = useTable((s) => s.today)
  const meId = useTable((s) => s.meId)

  return useMemo(() => {
    const todays = antes.filter((a) => a.dayDate === today)
    const anted = todays.filter((a) => a.status === 'verified' || a.status === 'insured')
    const meAnte = todays.find((a) => a.playerId === meId && a.status === 'verified')
    return {
      todays,
      anted,
      meAnte,

      locked: !todays.some((a) => a.playerId === meId && a.status === 'verified' && a.photo),
      holdouts: players.filter((p) => !anted.some((a) => a.playerId === p.id)),
    }
  }, [antes, players, today, meId])
}
