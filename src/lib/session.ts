export type Session = {
  playerId: string
  displayName: string
  leetcodeUsername: string
}

export function makeJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function playerIdFor(displayName: string): string {
  return (
    displayName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'player'
  )
}

export function joinCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const code = new URLSearchParams(window.location.search).get('join')
  return code ? code.toUpperCase() : null
}

export function inviteLink(joinCode: string): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('join', joinCode)
  return url.toString()
}

const INVITE_KEY = 'cache-out/pending-invite'

export function rememberInvite(code: string): void {
  try {
    localStorage.setItem(INVITE_KEY, code.trim().toUpperCase())
  } catch {}
}

export function pendingInvite(): string | null {
  try {
    const stored = localStorage.getItem(INVITE_KEY)
    if (stored) return stored
  } catch {}
  return joinCodeFromUrl()
}

export function clearInvite(): void {
  try {
    localStorage.removeItem(INVITE_KEY)
  } catch {}
}
