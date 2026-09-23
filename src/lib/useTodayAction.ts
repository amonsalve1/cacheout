import { useState } from 'react'
import { settleFor } from './rules.ts'
import { useTable } from '../store/useTable.ts'

export function useTodayAction() {
  const s = useTable()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const standing = settleFor(s.powerups, s.antes, s.meId, s.today, s.daily.slug)
  const mine = s.antes.filter(
    (a) => a.playerId === s.meId && a.dayDate === s.today && a.status === 'verified',
  )
  const posted = mine.some((a) => a.photo)
  const state = busy
    ? 'scanning'
    : mine.length && !posted
      ? 'photo'
      : posted && standing.progress.satisfied
        ? 'clear'
        : mine.length
          ? 'partial'
          : 'check'
  const check = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await s.submitAnte({})
      if (!result.ok) setMessage(result.message)
    } catch {
      setMessage('LeetCode is unreachable. Try again.')
    } finally {
      setBusy(false)
    }
  }
  const post = async (photo: string, caption: string) => {
    setBusy(true)
    setMessage('')
    try {
      const result = await s.submitAnte({ photo, caption })
      if (!result.ok) {
        setMessage(result.message)
        return false
      }
      return true
    } catch {
      setMessage('Could not post your proof. Try again.')
      return false
    } finally {
      setBusy(false)
    }
  }
  const label =
    state === 'scanning'
      ? 'Checking…'
      : state === 'photo'
        ? 'Post your proof'
        : state === 'clear'
          ? 'Clear for tonight ✓'
          : state === 'partial'
            ? 'Check again'
            : 'Check my LeetCode'
  return { standing, state, label, message, check, post, posted }
}
