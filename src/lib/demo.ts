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

export function buildDemo(now: Date = new Date(), seed = DEMO_SEED): DemoState {
  const r = rng(seed)
  const today = localDayKey(now, DEMO_TZ)
  const nowUnix = Math.floor(now.getTime() / 1000)
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(today, i - HISTORY_DAYS + 1))

  const table: TableConfig = {
    id: 'table-1',
    name: 'THE NIGHT SHIFT',
    joinCode: 'ALLIN',
    buyInCents: 100,
    tz: DEMO_TZ,
    doubleOrNothingEnabled: false,
    rakeBps: 500,
  }

  const players: Player[] = CAST.map((c) => ({
    id: c.id,
    displayName: c.displayName,
    leetcodeUsername: c.id === 'you' ? 'your_handle' : c.id,
    suit: c.suit,
    chips: 0,
    lifetimeSolved: c.solved,
    joinedAt: addDays(today, -HISTORY_DAYS),
  }))
  const byId = new Map(players.map((p) => [p.id, p]))

  const daily: DailyChallenge = {
    date: today,
    slug: 'find-the-minimum-and-maximum-number-of-nodes-between-critical-points',
    title: 'Find the Minimum and Maximum Number of Nodes Between Critical Points',
    difficulty: 'Medium',
    link: '/problems/find-the-minimum-and-maximum-number-of-nodes-between-critical-points/',
  }

  const antes: Ante[] = []
  const markers: Marker[] = []
  const bustStreak = new Map<string, number>(players.map((p) => [p.id, 0]))
  const verifiedStreak = new Map<string, number>(players.map((p) => [p.id, 0]))

  days.forEach((day, dayIndex) => {
    const isToday = day === today
    const dayStart = dayStartUnix(day, DEMO_TZ)
    const finished: { id: string; at: number }[] = []
    const busts: { playerId: string; cents: number }[] = []

    const elapsedFraction = isToday ? Math.min(1, Math.max(0, (nowUnix - dayStart) / 86400)) : 1

    for (const cast of CAST) {
      const player = byId.get(cast.id)!

      const typicalFinish = Math.min(0.97, 0.36 + (1 - cast.reliability) * 1.65)

      const anted =
        isToday && cast.id === 'you'
          ? false
          : r.chance(cast.reliability) && elapsedFraction >= typicalFinish

      if (!anted) {
        if (isToday) continue
        const streak = (bustStreak.get(cast.id) ?? 0) + 1
        bustStreak.set(cast.id, streak)
        verifiedStreak.set(cast.id, 0)

        busts.push({ playerId: cast.id, cents: MISS_CENTS })
        antes.push(blankAnte(cast.id, day, 'bust'))
        continue
      }

      bustStreak.set(cast.id, 0)
      const vs = (verifiedStreak.get(cast.id) ?? 0) + 1
      verifiedStreak.set(cast.id, vs)

      const hour = cast.reliability > 0.9 ? 8 + r.int(4) : 17 + r.int(6)
      let at = dayStart + hour * 3600 + r.int(3600)
      if (isToday) {
        at = Math.min(
          dayStart + Math.floor(typicalFinish * 86400) + r.int(1800),
          Math.max(dayStart + 60, nowUnix - 60),
        )
      }
      const problem = r.pick(PROBLEMS)
      const isDaily = r.chance(0.42)
      const base = problem.difficulty === 'Hard' ? 30 : problem.difficulty === 'Medium' ? 20 : 10
      const chipsAwarded = Math.round(base * (isDaily ? 2 : 1) * (1 + Math.min(vs, 20) / 20))

      finished.push({ id: cast.id, at })
      antes.push({
        id: `${day}-${cast.id}`,
        playerId: cast.id,
        dayDate: day,
        status: 'verified',
        lcSlug: isDaily ? daily.slug : problem.slug,
        lcTitle: isDaily ? daily.title : problem.title,
        lcDifficulty: isDaily ? daily.difficulty : problem.difficulty,
        lcTimestamp: at,
        isDaily,
        photo: fakeProof({
          title: isDaily ? daily.title : problem.title,
          difficulty: isDaily ? daily.difficulty : problem.difficulty,
          runtimeMs: 12 + r.int(900),
          beats: 5 + r.int(94),
          language: r.pick(LANGUAGES),
          seed: dayIndex * 17 + cast.id.length,
        }),
        caption: r.pick(CAPTIONS),
        chipsAwarded,
        reactions: pickReactions(r, cast.id),
        comments: r.chance(0.5)
          ? [
              {
                id: `${day}-${cast.id}-c`,
                playerId: r.pick(CAST.filter((c) => c.id !== cast.id)).id,
                body: r.pick(COMMENTS),
                createdAt: day,
              },
            ]
          : [],
        calls: [],
      })
      player.chips += chipsAwarded
    }

    if (isToday) return
    finished.sort((a, b) => a.at - b.at)
    for (const row of settleDay({ dayDate: day, busts, finishOrder: finished.map((f) => f.id) })) {
      markers.push({ ...row, id: `m${markers.length}` })
    }
  })

  const powerups: Powerup[] = [
    { id: 'pw-1', kind: 'double', fromId: 'kevin', targetId: 'you', playedOn: addDays(today, -1) },
    { id: 'pw-2', kind: 'hard', fromId: 'ana', targetId: 'bo', playedOn: addDays(today, -2) },
  ]

  const lastSweptDay = addDays(today, -1)

  return {
    payments: [],
    table,
    players,
    meId: 'you',
    today,
    daily,
    antes,
    markers,
    powerups,
    lastSweptDay,
  }
}

function blankAnte(playerId: string, dayDate: string, status: Ante['status']): Ante {
  return {
    id: `${dayDate}-${playerId}`,
    playerId,
    dayDate,
    status,
    isDaily: false,
    chipsAwarded: 0,
    reactions: {},
    comments: [],
    calls: [],
  }
}

function pickReactions(r: ReturnType<typeof rng>, self: string): Record<string, string[]> {
  const pool = ['🔥', '💀', '🧢', '👑', '🤡']
  const out: Record<string, string[]> = {}
  for (const emoji of pool) {
    const fans = CAST.filter((c) => c.id !== self && r.chance(0.22)).map((c) => c.id)
    if (fans.length) out[emoji] = fans
  }
  return out
}
