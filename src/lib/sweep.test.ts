import { describe, expect, it } from 'vitest'
import { sweep } from './sweep.ts'
import { FAILED_POWERUP_CENTS, MISS_CENTS, type Powerup } from './rules.ts'
import type { Ante } from './types.ts'

const TZ = 'America/New_York'

const ante = (playerId: string, dayDate: string, at = 1_700_000_000): Ante => ({
  id: `${dayDate}-${playerId}`,
  playerId,
  dayDate,
  status: 'verified',
  lcDifficulty: 'Medium',
  lcSlug: 'two-sum',
  lcTimestamp: at,
  isDaily: false,
  chipsAwarded: 0,
  reactions: {},
  comments: [],
  calls: [],
})

const power = (kind: Powerup['kind'], playedOn: string, targetId: string): Powerup => ({
  id: `pw-${kind}-${playedOn}-${targetId}`,
  kind,
  fromId: 'kevin',
  targetId,
  playedOn,
})

const noonOn = (day: string) => new Date(`${day}T17:00:00Z`)

const base = {
  tz: TZ,
  playerIds: ['you', 'kevin', 'ana'],
  antes: [] as Ante[],
  powerups: [] as Powerup[],
}

describe('what the sweep settles', () => {
  it('never charges for today — the day has not closed', () => {
    const r = sweep({ ...base, lastSweptDay: '2026-08-30' }, noonOn('2026-08-31'))
    expect(r.daysSwept).toEqual(['2026-08-30'.replace('30', '30')].slice(0, 0).concat([]))

    expect(r.daysSwept).toEqual([])
    expect(r.markers).toEqual([])
  })

  it('settles every day that closed while nobody was looking', () => {
    const r = sweep({ ...base, lastSweptDay: '2026-08-27' }, noonOn('2026-08-31'))
    expect(r.daysSwept).toEqual(['2026-08-28', '2026-08-29', '2026-08-30'])
    expect(r.lastSweptDay).toBe('2026-08-30')
  })

  it('charges a flat dollar to whoever missed, paid to whoever did not', () => {
    const antes = [ante('kevin', '2026-08-30'), ante('ana', '2026-08-30')]
    const r = sweep({ ...base, lastSweptDay: '2026-08-29', antes }, noonOn('2026-08-31'))
    const owed = r.markers.filter((m) => m.debtorId === 'you')
    expect(owed.reduce((s, m) => s + m.cents, 0)).toBe(MISS_CENTS * 2)

    expect(new Set(owed.map((m) => m.creditorId))).toEqual(new Set(['kevin', 'ana']))
    expect(r.markers.some((m) => m.debtorId !== 'you')).toBe(false)
  })

  it('voids a day nobody cleared rather than inventing a creditor', () => {
    const r = sweep({ ...base, lastSweptDay: '2026-08-29' }, noonOn('2026-08-31'))
    expect(r.daysSwept).toEqual(['2026-08-30'])
    expect(r.markers).toEqual([])
  })

  it('pays a whole dollar to every finisher', () => {
    const antes = [
      ante('kevin', '2026-08-30', 1_700_000_100),
      ante('ana', '2026-08-30', 1_700_000_900),
      ante('you', '2026-08-30', 1_700_000_500),
    ]

    const r = sweep(
      { ...base, playerIds: [...base.playerIds, 'bo'], lastSweptDay: '2026-08-29', antes },
      noonOn('2026-08-31'),
    )
    const rows = r.markers.filter((m) => m.debtorId === 'bo')
    expect(rows.reduce((s, m) => s + m.cents, 0)).toBe(MISS_CENTS * 3)

    expect(rows[0].creditorId).toBe('kevin')
    expect(rows[0].cents).toBe(100)
  })
})

describe('powerups across the sweep', () => {
  it('charges nothing while the window is still open', () => {
    const powerups = [power('double', '2026-08-30', 'you')]
    const antes = [ante('kevin', '2026-08-30')]
    const r = sweep({ ...base, lastSweptDay: '2026-08-29', antes, powerups }, noonOn('2026-08-31'))
    expect(r.markers.some((m) => m.debtorId === 'you')).toBe(false)
    expect(r.failedPowerups).toEqual([])
  })

  it('charges double when the window closes unmet, and names it', () => {
    const powerups = [power('double', '2026-08-28', 'you')]
    const antes = [ante('kevin', '2026-08-30')]
    const r = sweep({ ...base, lastSweptDay: '2026-08-29', antes, powerups }, noonOn('2026-08-31'))
    const owed = r.markers.filter((m) => m.debtorId === 'you')
    expect(owed.reduce((s, m) => s + m.cents, 0)).toBe(FAILED_POWERUP_CENTS)
    expect(owed[0].reason).toMatch(/failed double/)
    expect(r.failedPowerups).toEqual(['pw-double-2026-08-28-you'])
  })

  it('charges nothing if the window was met, even on the last day', () => {
    const powerups = [power('double', '2026-08-28', 'you')]
    const antes = [
      ante('you', '2026-08-29'),
      ante('you', '2026-08-30'),
      ante('kevin', '2026-08-30'),
    ]
    const r = sweep({ ...base, lastSweptDay: '2026-08-29', antes, powerups }, noonOn('2026-08-31'))
    expect(r.markers.some((m) => m.debtorId === 'you')).toBe(false)
    expect(r.failedPowerups).toEqual([])
  })
})

describe('the sweep is safe to re-run', () => {
  it('is idempotent — a second run over the same span charges nothing more', () => {
    const antes = [ante('kevin', '2026-08-30')]
    const first = sweep({ ...base, lastSweptDay: '2026-08-29', antes }, noonOn('2026-08-31'))
    const second = sweep({ ...base, lastSweptDay: first.lastSweptDay, antes }, noonOn('2026-08-31'))
    expect(first.markers.length).toBeGreaterThan(0)
    expect(second.markers).toEqual([])
    expect(second.daysSwept).toEqual([])
  })

  it('refuses to walk more than a couple of months of backlog', () => {
    const r = sweep({ ...base, lastSweptDay: '2020-01-01' }, noonOn('2026-08-31'))
    expect(r.daysSwept.length).toBeLessThanOrEqual(60)
  })
})

describe('regressions that cost people money', () => {
  it('re-sweeping a day produces the identical markers, so a retry cannot double-charge', () => {
    const antes = [ante('kevin', '2026-08-30'), ante('ana', '2026-08-30')]
    const input = { ...base, antes, lastSweptDay: '2026-08-29' }

    const first = sweep(input, noonOn('2026-08-31'))
    const second = sweep(input, noonOn('2026-08-31'))

    expect(first.markers.length).toBeGreaterThan(0)
    expect(second.markers).toEqual(first.markers)

    const key = (m: (typeof first.markers)[number]) =>
      [m.debtorId, m.creditorId, m.dayDate, m.reason].join('|')
    expect(second.markers.map(key)).toEqual(first.markers.map(key))
  })

  it("a Daily powerup is satisfied when the day's Daily is known", () => {
    const solvedTheDaily: Ante = {
      ...ante('you', '2026-08-30'),
      lcSlug: 'palindrome-number',
      isDaily: true,
    }
    const r = sweep(
      {
        ...base,
        antes: [solvedTheDaily, ante('kevin', '2026-08-30'), ante('ana', '2026-08-30')],
        powerups: [power('daily', '2026-08-29', 'you')],
        lastSweptDay: '2026-08-29',
        dailySlugFor: (day) => (day === '2026-08-30' ? 'palindrome-number' : undefined),
      },
      noonOn('2026-08-31'),
    )
    expect(r.markers.filter((m) => m.debtorId === 'you')).toEqual([])
  })

  it('and is NOT satisfied by a different problem, at the higher price', () => {
    const solvedSomethingElse = ante('you', '2026-08-30')
    const r = sweep(
      {
        ...base,
        antes: [solvedSomethingElse, ante('kevin', '2026-08-30'), ante('ana', '2026-08-30')],
        powerups: [power('daily', '2026-08-29', 'you')],
        lastSweptDay: '2026-08-29',
        dailySlugFor: (day) => (day === '2026-08-30' ? 'palindrome-number' : undefined),
      },
      noonOn('2026-08-31'),
    )
    const owed = r.markers.filter((m) => m.debtorId === 'you')
    expect(owed.length).toBeGreaterThan(0)
    expect(owed.reduce((sum, m) => sum + m.cents, 0)).toBe(FAILED_POWERUP_CENTS * 2)
  })
})
