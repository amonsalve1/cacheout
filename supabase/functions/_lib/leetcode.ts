const LEETCODE = 'https://leetcode.com/graphql'

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  Referer: 'https://leetcode.com',
}

export class LeetCodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LeetCodeError'
  }
}

export const NO_SUCH_USER = /does not exist/i

export const isNoSuchUser = (err: unknown): boolean =>
  err instanceof LeetCodeError && NO_SUCH_USER.test(err.message)

export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch(LEETCODE, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`leetcode responded ${res.status}`)
  const body = await res.json()
  if (body.errors?.length) throw new LeetCodeError(body.errors[0]?.message ?? 'leetcode error')
  return body.data as T
}

const DAILY = `query {
  activeDailyCodingChallengeQuestion {
    date link
    question { title titleSlug difficulty }
  }
}`

const PROFILE = `query p($u: String!) {
  matchedUser(username: $u) {
    username
    submitStats { acSubmissionNum { difficulty count } }
  }
}`

const RECENT = `query r($u: String!, $limit: Int!) {
  recentAcSubmissionList(username: $u, limit: $limit) {
    title titleSlug timestamp
  }
}`

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type Daily = {
  date: string
  link: string
  slug: string
  title: string
  difficulty: Difficulty
}

export type Accepted = { title: string; slug: string; at: number }

export async function fetchDaily(): Promise<Daily> {
  const data = await graphql<{
    activeDailyCodingChallengeQuestion: {
      date: string
      link: string
      question: { title: string; titleSlug: string; difficulty: string }
    }
  }>(DAILY)
  const d = data.activeDailyCodingChallengeQuestion
  return {
    date: d.date,
    link: d.link,
    slug: d.question.titleSlug,
    title: d.question.title,
    difficulty: d.question.difficulty as Difficulty,
  }
}

export async function fetchProfile(
  username: string,
): Promise<{ username: string; totalSolved: number } | null> {
  const data = await graphql<{
    matchedUser: {
      username: string
      submitStats: { acSubmissionNum: { difficulty: string; count: number }[] }
    } | null
  }>(PROFILE, { u: username })
  if (!data.matchedUser) return null
  const all = data.matchedUser.submitStats.acSubmissionNum.find((s) => s.difficulty === 'All')
  return { username: data.matchedUser.username, totalSolved: all?.count ?? 0 }
}

export async function fetchRecentAccepted(
  username: string,
  limit = 20,
): Promise<{ all: Accepted[]; limit: number } | null> {
  const data = await graphql<{
    recentAcSubmissionList: { title: string; titleSlug: string; timestamp: string }[] | null
  }>(RECENT, { u: username, limit })
  if (data.recentAcSubmissionList === null) return null
  return {
    all: data.recentAcSubmissionList.map((s) => ({
      title: s.title,
      slug: s.titleSlug,
      at: Number(s.timestamp),
    })),
    limit,
  }
}

export function within(all: Accepted[], fromUnix: number, toUnix: number, limit = 20) {
  const solved = all.filter((s) => s.at >= fromUnix && s.at < toUnix)
  return {
    solved,
    truncated: all.length === limit && all[all.length - 1].at >= fromUnix,
  }
}

export async function fetchDifficulties(slugs: string[]): Promise<Map<string, Difficulty>> {
  const out = new Map<string, Difficulty>()
  const unique = [...new Set(slugs)]
  if (unique.length === 0) return out

  const params = unique.map((_, i) => `$s${i}: String!`).join(', ')
  const fields = unique
    .map((_, i) => `q${i}: question(titleSlug: $s${i}) { titleSlug difficulty }`)
    .join('\n    ')
  const variables = Object.fromEntries(unique.map((slug, i) => [`s${i}`, slug]))

  const data = await graphql<Record<string, { titleSlug: string; difficulty: string } | null>>(
    `query d(${params}) {\n    ${fields}\n  }`,
    variables,
  )
  for (const value of Object.values(data)) {
    if (value?.titleSlug) out.set(value.titleSlug, value.difficulty as Difficulty)
  }
  return out
}
