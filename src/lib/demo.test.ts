import { describe, expect, it } from 'vitest'
import { buildDemo, DEMO_TZ } from './demo.ts'
import { streakOf } from './derive.ts'
import { localDayKey } from './time.ts'
import type { Ante } from './types.ts'

const ante = (playerId: string, dayDate: string, status: Ante['status']): Ante => ({
  id: `${dayDate}-${playerId}`,
  playerId,
  dayDate,
  status,
  isDaily: false,
  chipsAwarded: 0,
  reactions: {},
  comments: [],
  calls: [],
})

describe('streakOf', () => {
  it('counts consecutive verified days', () => {
    const antes = [
      ante('a', '2026-08-29', 'verified'),
      ante('a', '2026-08-30', 'verified'),
      ante('a', '2026-08-31', 'verified'),
    ]
    expect(streakOf(antes, 'a', '2026-08-31')).toBe(3)
  })

  it('does not reset while today is still undecided', () => {
    const antes = [
      ante('a', '2026-08-28', 'verified'),
      ante('a', '2026-08-29', 'verified'),
      ante('a', '2026-08-30', 'verified'),
    ]
    expect(streakOf(antes, 'a', '2026-08-31')).toBe(3)
  })

  it('breaks on a bust, not on a gap in the present day', () => {
    const antes = [
      ante('a', '2026-08-28', 'verified'),
      ante('a', '2026-08-29', 'bust'),
      ante('a', '2026-08-30', 'verified'),
    ]
    expect(streakOf(antes, 'a', '2026-08-30')).toBe(1)
  })

  it('counts an insured day as keeping the streak alive', () => {
    const antes = [
      ante('a', '2026-08-29', 'verified'),
      ante('a', '2026-08-30', 'insured'),
      ante('a', '2026-08-31', 'verified'),
    ]
    expect(streakOf(antes, 'a', '2026-08-31')).toBe(3)
  })

  it('is zero for a player with no history', () => {
    expect(streakOf([], 'nobody', '2026-08-31')).toBe(0)
  })
})

describe('buildDemo', () => {
  const AT_EVENING = new Date('2026-08-31T23:30:00Z')

  it('is deterministic for the same clock', () => {
    const a = buildDemo(AT_EVENING)
    const b = buildDemo(AT_EVENING)
    expect(a.antes.map((x) => `${x.id}:${x.status}`)).toEqual(
      b.antes.map((x) => `${x.id}:${x.status}`),
    )
    expect(a.markers.length).toBe(b.markers.length)
  })

  it('never stamps an ante in the future', () => {
    for (const iso of ['2026-08-31T06:00:00Z', '2026-08-31T14:00:00Z', '2026-08-31T23:30:00Z']) {
      const now = new Date(iso)
      const state = buildDemo(now)
      const nowUnix = Math.floor(now.getTime() / 1000)
      const future = state.antes.filter((a) => (a.lcTimestamp ?? 0) > nowUnix)
      expect(future, `future-dated antes at ${iso}`).toEqual([])
    }
  })

  it('seats reliable players before unreliable ones as the day progresses', () => {
    const morning = buildDemo(new Date('2026-08-31T14:00:00Z'))
    const night = buildDemo(new Date('2026-09-01T03:45:00Z'))
    const seated = (s: ReturnType<typeof buildDemo>) =>
      s.antes.filter((a) => a.dayDate === s.today && a.status === 'verified').map((a) => a.playerId)

    expect(seated(morning)).toContain('kevin')
    expect(seated(night).length).toBeGreaterThanOrEqual(seated(morning).length)
  })

  it('leaves the viewer un-anted, so the locked table is what you land on', () => {
    const state = buildDemo(AT_EVENING)
    expect(
      state.antes.find((a) => a.dayDate === state.today && a.playerId === 'you'),
    ).toBeUndefined()
  })

  it('uses the table timezone for the current day, not the runner-s', () => {
    const state = buildDemo(new Date('2026-08-31T03:30:00Z'))
    expect(state.today).toBe(localDayKey(new Date('2026-08-31T03:30:00Z'), DEMO_TZ))
    expect(state.today).toBe('2026-08-30')
  })
})
