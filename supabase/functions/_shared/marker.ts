// Generated from src/lib/marker.ts; run npm run sync:shared.

import type { Cents, Marker, Payment } from './types.ts'

export type Split = { creditorId: string; cents: Cents }

export function splitMarker(cents: Cents, finishOrder: string[]): Split[] {
  if (cents <= 0 || finishOrder.length === 0) return []
  return [...new Set(finishOrder)].map((creditorId) => ({ creditorId, cents }))
}

export type DayOutcome = {
  dayDate: string

  busts: { playerId: string; cents: Cents; reason?: string }[]

  finishOrder: string[]
}

export function settleDay(outcome: DayOutcome): Omit<Marker, 'id'>[] {
  if (outcome.finishOrder.length === 0) return []
  const rows: Omit<Marker, 'id'>[] = []
  for (const bust of outcome.busts) {
    for (const split of splitMarker(bust.cents, outcome.finishOrder)) {
      if (split.cents <= 0) continue
      rows.push({
        debtorId: bust.playerId,
        creditorId: split.creditorId,
        cents: split.cents,
        reason: bust.reason ?? 'missed the day',
        dayDate: outcome.dayDate,
      })
    }
  }
  return rows
}

export type Transfer = { from: string; to: string; cents: Cents }

export function netBalances(markers: Marker[], payments: Payment[] = []): Map<string, Cents> {
  const net = new Map<string, Cents>()
  const bump = (id: string, delta: Cents) => net.set(id, (net.get(id) ?? 0) + delta)
  for (const m of markers.filter((row) => !row.settledIn)) {
    bump(m.debtorId, -m.cents)
    bump(m.creditorId, m.cents)
  }
  for (const p of payments) {
    if (!p.confirmedAt) continue
    bump(p.from, p.cents)
    bump(p.to, -p.cents)
  }
  return net
}

export function netTransfers(markers: Marker[], payments: Payment[] = []): Transfer[] {
  const net = netBalances(markers, payments)
  const debtors = [...net.entries()].filter(([, c]) => c < 0).map(([id, c]) => ({ id, cents: -c }))
  const creditors = [...net.entries()].filter(([, c]) => c > 0).map(([id, c]) => ({ id, cents: c }))

  const bySize = (a: { id: string; cents: Cents }, b: { id: string; cents: Cents }) =>
    b.cents - a.cents || a.id.localeCompare(b.id)
  debtors.sort(bySize)
  creditors.sort(bySize)

  const transfers: Transfer[] = []
  let d = 0
  let c = 0
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].cents, creditors[c].cents)
    if (amount > 0) transfers.push({ from: debtors[d].id, to: creditors[c].id, cents: amount })
    debtors[d].cents -= amount
    creditors[c].cents -= amount
    if (debtors[d].cents === 0) d++
    if (creditors[c].cents === 0) c++
  }
  return transfers
}

export function rake(cents: Cents, rakeBps: number): Cents {
  return Math.floor((cents * rakeBps) / 10000)
}

export function formatCents(cents: Cents): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${(abs / 100).toFixed(2)}`
}
