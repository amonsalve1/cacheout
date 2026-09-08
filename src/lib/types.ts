export type Suit = 'spade' | 'heart' | 'club' | 'diamond'
export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type Cents = number
export type Chips = number

export type Player = {
  id: string
  displayName: string
  leetcodeUsername: string
  suit: Suit
  chips: Chips

  lifetimeSolved: number

  usernameLockedUntil?: string
  venmoHandle?: string
  joinedAt: string
}

export type AnteStatus = 'verified' | 'insured' | 'bust' | 'disputed' | 'pending'

export type Ante = {
  id: string
  playerId: string

  dayDate: string
  status: AnteStatus
  lcSlug?: string
  lcTitle?: string
  lcDifficulty?: Difficulty

  lcTimestamp?: number

  isDaily: boolean
  photo?: string
  caption?: string
  chipsAwarded: Chips
  reactions: Record<string, string[]>
  comments: Comment[]
  calls: string[]
}

export type Comment = {
  id: string
  playerId: string
  body: string
  createdAt: string
}

export type Marker = {
  id: string
  debtorId: string
  creditorId: string
  cents: Cents
  reason: string
  dayDate: string
  settledIn?: string
}

export type SideBet = {
  id: string
  bettorId: string
  subjectId: string
  dayDate: string
  direction: 'bust' | 'survive'
  chips: Chips
  oddsBps: number
  payout?: Chips
}

export type DailyChallenge = {
  date: string
  slug: string
  title: string
  difficulty: Difficulty
  link: string
}

export type TableConfig = {
  id: string
  name: string
  discordWebhookUrl?: string
  joinCode: string
  buyInCents: Cents
  tz: string
  doubleOrNothingEnabled: boolean
  rakeBps: number
}

export type Payment = {
  id: string
  from: string
  to: string
  cents: Cents
  createdAt: string
  confirmedAt?: string
}
