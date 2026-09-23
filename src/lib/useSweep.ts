import { useEffect, useState } from 'react'
import { useTable } from '../store/useTable.ts'

export type SweepNotice = { daysSwept: string[]; markersAdded: number }

export function useSweep(): SweepNotice | null {
  const runSweep = useTable((s) => s.runSweep)
  const identity = useTable((s) => s.identity)
  const [notice, setNotice] = useState<SweepNotice | null>(null)

  useEffect(() => {
    if (!identity) return

    const run = () => {
      const result = runSweep()
      if (result.daysSwept.length > 0) setNotice(result)
    }

    run()
    const timer = setInterval(run, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [runSweep, identity])

  return notice
}
