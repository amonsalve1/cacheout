import { describe, expect, it } from 'vitest'
import {
  activePowerups,
  deadlineOf,
  FAILED_POWERUP_CENTS,
  MISS_CENTS,
  POWERUPS,
  progressToward,
  requirementFor,
  settleFor,
  type Powerup,
} from './rules.ts'
import type { Ante, Difficulty } from './types.ts'

const ante = (
  playerId: string,
  dayDate: string,
  opts: { status?: Ante['status']; difficulty?: Difficulty; slug?: string } = {},
): Ante => ({
  id: `${dayDate}-${playerId}-${opts.slug ?? 'x'}`,
  playerId,
  dayDate,
  status: opts.status ?? 'verified',
  lcDifficulty: opts.difficulty ?? 'Medium',
  lcSlug: opts.slug ?? 'two-sum',
  isDaily: false,
  chipsAwarded: 0,
  reactions: {},
  comments: [],
  calls: [],
})

const power = (kind: Powerup['kind'], playedOn: string, targetId = 'me'): Powerup => ({
  id: `p-${kind}-${playedOn}`,
  kind,
  fromId: 'kevin',
  targetId,
  playedOn,
})

describe('the default requirement', () => {
  it('is one problem today, and says so in one sentence', () => {
    const r = requirementFor([], 'me', '2026-08-31')
    expect(r.problems).toBe(1)
    expect(r.hard).toBe(false)
    expect(r.daily).toBe(false)
    expect(r.daysLeft).toBe(1)
    expect(r.sentence).toBe('Solve 1 problem today')
  })

  it('is cleared by a single accepted problem', () => {
    const r = requirementFor([], 'me', '2026-08-31')
    const p = progressToward(r, [ante('me', '2026-08-31')], 'me')
    expect(p).toEqual({ done: 1, needed: 1, satisfied: true })
  })

  it('does not count an unverified attempt', () => {
    const r = requirementFor([], 'me', '2026-08-31')
    for (const status of ['bust', 'pending', 'insured', 'disputed'] as const) {
      const p = progressToward(r, [ante('me', '2026-08-31', { status })], 'me')
      expect(p.satisfied, status).toBe(false)
    }
  })
})

describe('powerups', () => {
  it('gives the target several days, counting the day it was played', () => {
    expect(deadlineOf(power('double', '2026-08-31'))).toBe('2026-09-02')
    expect(deadlineOf(power('daily', '2026-08-31'))).toBe('2026-09-01')
  })

  it('is active across its window and inert outside it', () => {
    const p = [power('double', '2026-08-31')]
    expect(activePowerups(p, 'me', '2026-08-30')).toHaveLength(0)
    expect(activePowerups(p, 'me', '2026-08-31')).toHaveLength(1)
    expect(activePowerups(p, 'me', '2026-09-02')).toHaveLength(1)
    expect(activePowerups(p, 'me', '2026-09-03')).toHaveLength(0)
  })

  it('only lands on its target', () => {
    expect(activePowerups([power('double', '2026-08-31', 'bo')], 'me', '2026-08-31')).toHaveLength(
      0,
    )
  })

  it('stops counting once cleared', () => {
    const p = { ...power('double', '2026-08-31'), clearedOn: '2026-09-01' }
    expect(activePowerups([p], 'me', '2026-09-01')).toHaveLength(0)
  })

  it('raises the bar to two problems and counts them across the window', () => {
    const today = '2026-09-01'
    const r = requirementFor([power('double', '2026-08-31')], 'me', today)
    expect(r.problems).toBe(2)
    expect(r.daysLeft).toBe(2)

    const p = progressToward(r, [ante('me', '2026-08-31'), ante('me', today)], 'me')
    expect(p).toEqual({ done: 2, needed: 2, satisfied: true })
  })

  it('hard mode only accepts a Hard', () => {
    const r = requirementFor([power('hard', '2026-08-31')], 'me', '2026-08-31')
    expect(
      progressToward(r, [ante('me', '2026-08-31', { difficulty: 'Medium' })], 'me').satisfied,
    ).toBe(false)
    expect(
      progressToward(r, [ante('me', '2026-08-31', { difficulty: 'Hard' })], 'me').satisfied,
    ).toBe(true)
  })

  it('the Daily only accepts the official problem', () => {
    const r = requirementFor([power('daily', '2026-08-31')], 'me', '2026-08-31')
    const wrong = [ante('me', '2026-08-31', { slug: 'two-sum' })]
    const right = [ante('me', '2026-08-31', { slug: 'todays-daily' })]
    expect(progressToward(r, wrong, 'me', 'todays-daily').satisfied).toBe(false)
    expect(progressToward(r, right, 'me', 'todays-daily').satisfied).toBe(true)
  })

  it('takes the hardest live powerup rather than stacking them', () => {
    const r = requirementFor(
      [power('double', '2026-08-31'), power('hard', '2026-08-31'), power('daily', '2026-08-31')],
      'me',
      '2026-08-31',
    )
    expect(r.problems).toBe(2)
    expect(r.problems).toBeLessThanOrEqual(
      Math.max(...Object.values(POWERUPS).map((p) => p.problems)),
    )
  })
})

describe('what you owe', () => {
  const today = '2026-08-31'

  it('is nothing when you have met the requirement', () => {
    const s = settleFor([], [ante('me', today)], 'me', today)
    expect(s.owedIfDayEnds).toBe(0)
    expect(s.status).toBe('clear')
  })

  it('is a flat dollar for an ordinary miss — nothing compounds', () => {
    const s = settleFor([], [], 'me', today)
    expect(s.owedIfDayEnds).toBe(MISS_CENTS)
  })

  it('stays a flat dollar however many days you have missed', () => {
    const misses = ['2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'].map(() => 0)
    expect(misses.every(() => settleFor([], [], 'me', today).owedIfDayEnds === MISS_CENTS)).toBe(
      true,
    )
  })

  it('owes nothing while a powerup window is still open', () => {
    const s = settleFor([power('double', today)], [], 'me', today)
    expect(s.owedIfDayEnds).toBe(0)
    expect(s.requirement.daysLeft).toBe(3)
  })

  it('charges double only when a powerup window actually closes unmet', () => {
    const s = settleFor([power('double', '2026-08-29')], [], 'me', '2026-08-31')
    expect(s.requirement.daysLeft).toBe(1)
    expect(s.owedIfDayEnds).toBe(FAILED_POWERUP_CENTS)
  })

  it('owes nothing if the powerup is cleared on the last day', () => {
    const s = settleFor(
      [power('double', '2026-08-29')],
      [ante('me', '2026-08-30'), ante('me', '2026-08-31')],
      'me',
      '2026-08-31',
    )
    expect(s.owedIfDayEnds).toBe(0)
    expect(s.status).toBe('clear')
  })
})
