// Generated from src/lib/rules.ts; run npm run sync:shared.

import type { Ante, Cents, Difficulty } from './types.ts'
import { addDays } from './time.ts'

export type PowerupKind = 'double' | 'hard' | 'daily'

export type PowerupSpec = {
  label: string

  blurb: string
  problems: number
  hard: boolean
  daily: boolean

  days: number
}

export const POWERUPS: Record<PowerupKind, PowerupSpec> = {
  double: {
    label: 'Double',
    blurb: 'Solve 2 problems instead of 1',
    problems: 2,
    hard: false,
    daily: false,
    days: 3,
  },
  hard: {
    label: 'Hard mode',
    blurb: 'Your problem has to be a Hard',
    problems: 1,
    hard: true,
    daily: false,
    days: 3,
  },
  daily: {
    label: 'The Daily',
    blurb: "It has to be today's official Daily",
    problems: 1,
    hard: false,
    daily: true,
    days: 2,
  },
}

export type Powerup = {
  id: string
  kind: PowerupKind

  fromId: string

  targetId: string

  playedOn: string

  clearedOn?: string
}

export function deadlineOf(powerup: Powerup): string {
  return addDays(powerup.playedOn, POWERUPS[powerup.kind].days - 1)
}

export function activePowerups(powerups: Powerup[], playerId: string, today: string): Powerup[] {
  return powerups.filter(
    (p) => p.targetId === playerId && !p.clearedOn && p.playedOn <= today && today <= deadlineOf(p),
  )
}

export type Requirement = {
  problems: number
  hard: boolean
  daily: boolean

  powerup?: Powerup

  from: string
  until: string

  daysLeft: number

  sentence: string
}

export function requirementFor(powerups: Powerup[], playerId: string, today: string): Requirement {
  const active = activePowerups(powerups, playerId, today)

  if (active.length === 0) {
    return {
      problems: 1,
      hard: false,
      daily: false,
      from: today,
      until: today,
      daysLeft: 1,
      sentence: 'Solve 1 problem today',
    }
  }

  const hardest = active.reduce((worst, p) =>
    POWERUPS[p.kind].problems > POWERUPS[worst.kind].problems ? p : worst,
  )
  const spec = POWERUPS[hardest.kind]
  const until = deadlineOf(hardest)
  const daysLeft = daysBetween(today, until) + 1

  return {
    problems: spec.problems,
    hard: spec.hard,
    daily: spec.daily,
    powerup: hardest,
    from: hardest.playedOn,
    until,
    daysLeft,
    sentence: spec.blurb,
  }
}

function daysBetween(from: string, to: string): number {
  let n = 0
  let cursor = from

  while (cursor < to && n < 365) {
    cursor = addDays(cursor, 1)
    n++
  }
  return n
}

export type Progress = {
  done: number
  needed: number
  satisfied: boolean
}

function qualifies(ante: Ante, requirement: Requirement, dailySlug?: string): boolean {
  if (ante.status !== 'verified') return false
  if (requirement.hard && ante.lcDifficulty !== ('Hard' satisfies Difficulty)) return false
  if (requirement.daily && ante.lcSlug !== dailySlug) return false
  return true
}

export function progressToward(
  requirement: Requirement,
  antes: Ante[],
  playerId: string,
  dailySlug?: string,
): Progress {
  const done = antes.filter(
    (a) =>
      a.playerId === playerId &&
      a.dayDate >= requirement.from &&
      a.dayDate <= requirement.until &&
      qualifies(a, requirement, dailySlug),
  ).length
  return { done, needed: requirement.problems, satisfied: done >= requirement.problems }
}

export const MISS_CENTS: Cents = 100

export const FAILED_POWERUP_CENTS: Cents = 200

export type Standing = {
  requirement: Requirement
  progress: Progress

  owedIfDayEnds: Cents

  status: 'clear' | 'due-today' | 'owing'
}

export function settleFor(
  powerups: Powerup[],
  antes: Ante[],
  playerId: string,
  today: string,
  dailySlug?: string,
): Standing {
  const requirement = requirementFor(powerups, playerId, today)
  const progress = progressToward(requirement, antes, playerId, dailySlug)

  if (progress.satisfied) {
    return { requirement, progress, owedIfDayEnds: 0, status: 'clear' }
  }

  if (requirement.daysLeft > 1) {
    return { requirement, progress, owedIfDayEnds: 0, status: 'due-today' }
  }
  return {
    requirement,
    progress,
    owedIfDayEnds: requirement.powerup ? FAILED_POWERUP_CENTS : MISS_CENTS,
    status: 'due-today',
  }
}
