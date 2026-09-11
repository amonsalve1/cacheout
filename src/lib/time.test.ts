import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayEndUnix,
  dayStartUnix,
  formatCountdown,
  localDayKey,
  msUntilMidnight,
  withinDay,
} from './time.ts'

const NY = 'America/New_York'
const TOKYO = 'Asia/Tokyo'
const KOLKATA = 'Asia/Kolkata'
const HOURS = (n: number) => n * 3600

describe('localDayKey', () => {
  it('reports the table-local day, not the viewer-s', () => {
    const at = new Date('2026-08-31T03:30:00Z')
    expect(localDayKey(at, NY)).toBe('2026-08-30')
    expect(localDayKey(at, TOKYO)).toBe('2026-08-31')
    expect(localDayKey(at, 'UTC')).toBe('2026-08-31')
  })

  it('handles a half-hour-offset zone', () => {
    expect(localDayKey(new Date('2026-08-30T19:00:00Z'), KOLKATA)).toBe('2026-08-31')
  })
})

describe('day boundaries', () => {
  it('spans exactly 24 hours on an ordinary day', () => {
    expect(dayEndUnix('2026-08-31', NY) - dayStartUnix('2026-08-31', NY)).toBe(HOURS(24))
  })

  it('spans 23 hours on the spring-forward day', () => {
    expect(dayEndUnix('2026-03-08', NY) - dayStartUnix('2026-03-08', NY)).toBe(HOURS(23))
  })

  it('spans 25 hours on the fall-back day', () => {
    expect(dayEndUnix('2026-11-01', NY) - dayStartUnix('2026-11-01', NY)).toBe(HOURS(25))
  })

  it('starts each day at local midnight', () => {
    for (const [tz, day] of [
      [NY, '2026-03-08'],
      [NY, '2026-11-01'],
      [TOKYO, '2026-08-31'],
      [KOLKATA, '2026-01-15'],
    ] as const) {
      const start = new Date(dayStartUnix(day, tz) * 1000)
      const hhmm = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(start)
      expect(hhmm).toBe('00:00')
      expect(localDayKey(start, tz)).toBe(day)
    }
  })

  it('leaves no gap between consecutive days', () => {
    for (const day of ['2026-03-07', '2026-03-08', '2026-10-31', '2026-11-01']) {
      expect(dayEndUnix(day, NY)).toBe(dayStartUnix(addDays(day, 1), NY))
    }
  })
})

describe('withinDay', () => {
  it('accepts a submission at the first second and rejects the last boundary', () => {
    const start = dayStartUnix('2026-08-31', NY)
    const end = dayEndUnix('2026-08-31', NY)
    expect(withinDay(start, '2026-08-31', NY)).toBe(true)
    expect(withinDay(end - 1, '2026-08-31', NY)).toBe(true)

    expect(withinDay(end, '2026-08-31', NY)).toBe(false)
    expect(withinDay(start - 1, '2026-08-31', NY)).toBe(false)
  })
})

describe('countdown', () => {
  it('never goes negative once the deadline passes', () => {
    expect(formatCountdown(-5000)).toBe('00:00:00')
    expect(msUntilMidnight(new Date('2026-08-31T23:59:59Z'), 'UTC')).toBeLessThanOrEqual(1000)
  })
  it('pads every field so the layout cannot jitter', () => {
    expect(formatCountdown(HOURS(4) * 1000 + 5000)).toBe('04:00:05')
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(HOURS(23) * 1000 + 59 * 60 * 1000 + 59000)).toBe('23:59:59')
  })
})

describe('addDays', () => {
  it('rolls across month and year ends', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })
})
