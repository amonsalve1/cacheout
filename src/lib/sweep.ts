import type { Ante, Marker } from './types.ts'
import type { Powerup } from './rules.ts'
import { settleDay } from './marker.ts'
import { settleFor } from './rules.ts'
import { addDays, localDayKey } from './time.ts'

export type SweepInput = {
  tz: string

  lastSweptDay: string
  playerIds: string[]
  antes: Ante[]
  powerups: Powerup[]

  dailySlugFor?: (day: string) => string | undefined
}

export type SweepResult = {
  daysSwept: string[]

  markers: Omit<Marker, 'id'>[]

  failedPowerups: string[]

  lastSweptDay: string
}

const MAX_DAYS = 60

export function sweep(input: SweepInput, now: Date = new Date()): SweepResult {
  const today = localDayKey(now, input.tz)
  const markers: Omit<Marker, 'id'>[] = []
  const failedPowerups: string[] = []
  const daysSwept: string[] = []

  let day = addDays(input.lastSweptDay, 1)
  let guard = 0

  while (day < today && guard < MAX_DAYS) {
    guard++
    const dailySlug = input.dailySlugFor?.(day)

    const clear: { id: string; at: number }[] = []
    const missed: { playerId: string; cents: number; reason: string }[] = []

    for (const playerId of input.playerIds) {
      const standing = settleFor(input.powerups, input.antes, playerId, day, dailySlug)

      if (standing.progress.satisfied) {
        const earliest = input.antes
          .filter((a) => a.playerId === playerId && a.dayDate === day && a.status === 'verified')
          .reduce((min, a) => Math.min(min, a.lcTimestamp ?? Infinity), Infinity)
        clear.push({ id: playerId, at: earliest })
        continue
      }

      if (standing.owedIfDayEnds === 0) continue

      const powerup = standing.requirement.powerup
      if (powerup) failedPowerups.push(powerup.id)
      missed.push({
        playerId,
        cents: standing.owedIfDayEnds,
        reason: powerup ? `failed ${powerup.kind}` : 'missed the day',
      })
    }

    clear.sort((a, b) => a.at - b.at)
    markers.push(
      ...settleDay({
        dayDate: day,
        busts: missed,
        finishOrder: clear.map((c) => c.id),
      }),
    )

    daysSwept.push(day)
    day = addDays(day, 1)
  }

  return {
    daysSwept,
    markers,
    failedPowerups,
    lastSweptDay: daysSwept.length > 0 ? daysSwept[daysSwept.length - 1] : input.lastSweptDay,
  }
}
