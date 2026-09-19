import type { Ante, DailyChallenge, Marker, Player, TableConfig } from './types.ts'
import type { Powerup } from './rules.ts'
import { settleDay } from './marker.ts'
import { MISS_CENTS } from './rules.ts'
import { addDays, dayStartUnix, localDayKey } from './time.ts'
import { LANGUAGES, PROBLEMS } from './problems.ts'
import { fakeProof } from './proof.ts'
import { rng } from './rng.ts'

export const DEMO_TZ = 'America/New_York'
const HISTORY_DAYS = 14

export const DEMO_SEED = 8

const CAST: {
  id: string
  displayName: string
  suit: Player['suit']
  reliability: number
  solved: number
}[] = [
  { id: 'you', displayName: 'YOU', suit: 'spade', reliability: 0.78, solved: 214 },
  { id: 'kevin', displayName: 'KEVIN', suit: 'diamond', reliability: 0.97, solved: 892 },
  { id: 'ana', displayName: 'ANA', suit: 'heart', reliability: 0.86, solved: 401 },
  { id: 'bo', displayName: 'BO', suit: 'club', reliability: 0.62, solved: 138 },
  { id: 'dee', displayName: 'DEE', suit: 'heart', reliability: 0.71, solved: 267 },
]

const CAPTIONS = [
  'ez clap',
  'took me 47 min do not perceive me',
  'one line. one.',
  'i hate graphs',
  'binary search my beloved',
  'brute forced it, no regrets',
  'TLE 6 times first',
  'almost gave up on this one',
  'woke up at 11:58pm for this',
  'my dp table is crying',
  'off by one for 20 minutes',
  'accepted on vibes alone',
]

const COMMENTS = [
  'that runtime is embarrassing',
  'beats 12%?? lmao',
  'we can all see the timestamp',
  'this is the same problem as yesterday',
  'nice',
  'suspicious.',
  'carried',
  'you did NOT write that yourself',
]

export type DemoState = {
  table: TableConfig
  players: Player[]
  meId: string
  today: string
  daily: DailyChallenge
  antes: Ante[]
  markers: Marker[]
  payments: import('./types.ts').Payment[]
  powerups: Powerup[]

  lastSweptDay: string
}
