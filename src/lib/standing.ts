import type { Standing } from './rules.ts'

export function atStakeTonight(standing: Standing): number {
  return standing.status === 'clear' ? 0 : standing.owedIfDayEnds
}
