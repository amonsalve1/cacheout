import { describe, expect, it } from 'vitest'
import { formatCents, netBalances, netTransfers, rake, settleDay, splitMarker } from './marker.ts'
import { MISS_CENTS } from './rules.ts'
import type { Marker } from './types.ts'

const marker = (debtorId: string, creditorId: string, cents: number): Marker => ({
  id: `${debtorId}-${creditorId}-${cents}`,
  debtorId,
  creditorId,
  cents,
  reason: 't',
  dayDate: '2026-08-31',
})

describe('splitMarker', () => {
  it('charges the full price to each finisher', () => {
    expect(splitMarker(100, ['a', 'b', 'c', 'd'])).toEqual([
      { creditorId: 'a', cents: 100 },
      { creditorId: 'b', cents: 100 },
      { creditorId: 'c', cents: 100 },
      { creditorId: 'd', cents: 100 },
    ])
  })
  it('charges whole dollars regardless of finish order', () => {
    const split = splitMarker(100, ['first', 'second', 'third'])
    expect(split.map((s) => s.cents)).toEqual([100, 100, 100])
  })
  it('charges the price times the number of finishers', () => {
    for (let n = 1; n <= 9; n++) {
      for (const cents of [100, 200, 400, 800, 137]) {
        const ids = Array.from({ length: n }, (_, i) => `p${i}`)
        const total = splitMarker(cents, ids).reduce((s, x) => s + x.cents, 0)
        expect(total).toBe(cents * n)
      }
    }
  })
  it('pays nobody when nobody anted', () => {
    expect(splitMarker(800, [])).toEqual([])
  })
})

describe('settleDay', () => {
  it('voids the day when nobody anted, rather than inventing a pot', () => {
    expect(
      settleDay({
        dayDate: '2026-08-31',
        finishOrder: [],
        busts: [
          { playerId: 'a', cents: MISS_CENTS },
          { playerId: 'b', cents: MISS_CENTS },
        ],
      }),
    ).toEqual([])
  })

  it('routes a bust to everyone who anted', () => {
    const rows = settleDay({
      dayDate: '2026-08-31',
      finishOrder: ['x', 'y'],
      busts: [{ playerId: 'a', cents: MISS_CENTS }],
    })
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.debtorId === 'a')).toBe(true)
    expect(rows.reduce((s, r) => s + r.cents, 0)).toBe(200)
  })

  it('charges exactly what the rules priced, and does not reprice it', () => {
    const rows = settleDay({
      dayDate: 'd',
      finishOrder: ['x'],
      busts: [{ playerId: 'a', cents: 250, reason: 'powerup' }],
    })
    expect(rows[0].cents).toBe(250)
    expect(rows[0].reason).toBe('powerup')
  })

  it('handles several busts on the same day independently', () => {
    const rows = settleDay({
      dayDate: 'd',
      finishOrder: ['x', 'y'],
      busts: [
        { playerId: 'a', cents: 100 },
        { playerId: 'b', cents: 400 },
      ],
    })
    const owed = (id: string) =>
      rows.filter((r) => r.debtorId === id).reduce((s, r) => s + r.cents, 0)
    expect(owed('a')).toBe(200)
    expect(owed('b')).toBe(800)
  })
})

describe('netTransfers', () => {
  it('collapses a tangled week into at most n-1 payments', () => {
    const ids = ['ana', 'bo', 'cy', 'dee', 'eli']
    const markers: Marker[] = []

    for (const a of ids) for (const b of ids) if (a !== b) markers.push(marker(a, b, 25))
    const transfers = netTransfers(markers)
    expect(transfers.length).toBeLessThanOrEqual(ids.length - 1)
  })

  it('preserves every net balance exactly', () => {
    const markers = [
      marker('ana', 'bo', 300),
      marker('ana', 'cy', 150),
      marker('bo', 'cy', 220),
      marker('cy', 'dee', 90),
      marker('dee', 'ana', 410),
      marker('bo', 'dee', 75),
    ]
    const before = netBalances(markers)
    const after = new Map<string, number>()
    for (const t of netTransfers(markers)) {
      after.set(t.from, (after.get(t.from) ?? 0) - t.cents)
      after.set(t.to, (after.get(t.to) ?? 0) + t.cents)
    }
    for (const [id, net] of before) expect(after.get(id) ?? 0).toBe(net)
  })

  it('moves no money when the ledger already nets to zero', () => {
    expect(netTransfers([marker('a', 'b', 500), marker('b', 'a', 500)])).toEqual([])
  })

  it('is deterministic for the same ledger', () => {
    const markers = [
      marker('a', 'b', 100),
      marker('c', 'b', 100),
      marker('a', 'd', 250),
      marker('d', 'c', 60),
    ]
    expect(netTransfers(markers)).toEqual(netTransfers([...markers].reverse()))
  })

  it('never emits a zero or negative transfer', () => {
    const markers = [marker('a', 'b', 100), marker('b', 'c', 100), marker('c', 'a', 100)]
    for (const t of netTransfers(markers)) expect(t.cents).toBeGreaterThan(0)
  })
})

describe('rake and formatting', () => {
  it('takes 5% and rounds down, never up, in the House-s favour only to a cent', () => {
    expect(rake(1000, 500)).toBe(50)
    expect(rake(199, 500)).toBe(9)
    expect(rake(0, 500)).toBe(0)
  })
  it('formats cents as dollars', () => {
    expect(formatCents(100)).toBe('$1.00')
    expect(formatCents(2350)).toBe('$23.50')
    expect(formatCents(-475)).toBe('-$4.75')
  })
})

describe('confirmed payments', () => {
  const debt = [marker('a', 'b', 300)]
  const paid = { id: 'p', from: 'a', to: 'b', cents: 200, createdAt: '2026-10-01' }
  it('keeps pending payments in the balance', () => {
    expect(netBalances(debt, [paid]).get('a')).toBe(-300)
  })
  it('subtracts confirmed payments without aging out old debts', () => {
    const payments = [{ ...paid, confirmedAt: '2026-10-02' }]
    expect(netBalances(debt, payments).get('a')).toBe(-100)
    expect(netBalances(debt, payments).get('b')).toBe(100)
    expect(netTransfers(debt, payments)).toEqual([{ from: 'a', to: 'b', cents: 100 }])
  })
  it('does not include explicitly settled markers', () => {
    expect(netTransfers([{ ...debt[0], settledIn: 'old' }])).toEqual([])
  })
})
