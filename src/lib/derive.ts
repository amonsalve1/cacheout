import type { Ante } from './types.ts'
import { addDays } from './time.ts'

export function streakOf(antes: Ante[], playerId: string, upTo: string): number {
  const byDay = new Map(antes.filter((a) => a.playerId === playerId).map((a) => [a.dayDate, a]))
  let streak = 0
  let day = upTo

  if (!byDay.has(day)) day = addDays(day, -1)
  for (let i = 0; i < 400; i++) {
    const ante = byDay.get(day)
    if (!ante) break
    if (ante.status === 'verified' || ante.status === 'insured') streak++
    else break
    day = addDays(day, -1)
  }
  return streak
}
