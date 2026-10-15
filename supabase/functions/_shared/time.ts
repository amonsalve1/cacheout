// Generated from src/lib/time.ts; run npm run sync:shared.

function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? 0)

  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asUtc - at.getTime()
}

export function localDayKey(at: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

export function dayStartUnix(dayKey: string, tz: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0)
  let ts = utcMidnight - tzOffsetMs(new Date(utcMidnight), tz)
  ts = utcMidnight - tzOffsetMs(new Date(ts), tz)
  return Math.floor(ts / 1000)
}

export function dayEndUnix(dayKey: string, tz: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return dayStartUnix(localDayKey(next, 'UTC'), tz)
}

export function withinDay(unixSeconds: number, dayKey: string, tz: string): boolean {
  return unixSeconds >= dayStartUnix(dayKey, tz) && unixSeconds < dayEndUnix(dayKey, tz)
}

export function msUntilMidnight(at: Date, tz: string): number {
  return Math.max(0, dayEndUnix(localDayKey(at, tz), tz) * 1000 - at.getTime())
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

export function addDays(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  return localDayKey(new Date(Date.UTC(y, m - 1, d + delta)), 'UTC')
}
