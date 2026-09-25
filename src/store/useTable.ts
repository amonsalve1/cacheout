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
