import { useEffect, useState } from 'react'
import { msUntilMidnight } from '../lib/time.ts'

export function useCountdown(tz: string): number {
  const [ms, setMs] = useState(() => msUntilMidnight(new Date(), tz))
  useEffect(() => {
    const id = setInterval(() => setMs(msUntilMidnight(new Date(), tz)), 1000)
    return () => clearInterval(id)
  }, [tz])
  return ms
}
