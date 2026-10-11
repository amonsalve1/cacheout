import { useState } from 'react'
import { formatCents, netBalances, netTransfers } from '../lib/marker.ts'
import { useTable } from '../store/useTable.ts'

export function Settle() {
  const { players, meId, markers, payments, pay, confirmPayment } = useTable()
  const [busy, setBusy] = useState(false)
  const balance = netBalances(markers, payments).get(meId) ?? 0
  const name = (id: string) => players.find((p) => p.id === id)?.displayName ?? id
  const pending = payments.filter((p) => !p.confirmedAt)
  const transfers = netTransfers(markers, payments).sort(
    (a, b) => Number(b.from === meId || b.to === meId) - Number(a.from === meId || a.to === meId),
  )
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="stack">
      <section className="plaque p-6">
        <div className="hud-label">Balance</div>
        <h1 className={balance < 0 ? 'danger' : balance > 0 ? 'safe' : ''}>
          {balance < 0
            ? `You owe ${formatCents(-balance)}`
            : balance > 0
              ? `You're owed ${formatCents(balance)}`
              : 'All square'}
        </h1>
        <p>All days, less confirmed payments.</p>
      </section>
      <section className="plaque p-6">
        <h2>Transfers</h2>
        {!transfers.length && <p>Nothing owed. Keep it that way.</p>}
        <ul className="stack">
          {transfers.map((t) => {
            const handle = players.find((p) => p.id === t.to)?.venmoHandle
            const waiting = pending.some((p) => p.from === t.from && p.to === t.to)
            return (
              <li className="transfer" key={`${t.from}-${t.to}`}>
                <div>
                  {name(t.from)} → {name(t.to)} <strong>{formatCents(t.cents)}</strong>
                </div>
                {t.from === meId && !waiting && (
                  <div className="actions">
                    {handle && (
                      <a
                        className="hud-ghost"
                        href={`https://venmo.com/${encodeURIComponent(handle)}?txn=pay&amount=${(t.cents / 100).toFixed(2)}&note=CACHE%20OUT`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Venmo
                      </a>
                    )}
                    <button disabled={busy} onClick={() => void run(() => pay(t.to, t.cents))}>
                      I paid
                    </button>
                  </div>
                )}
                {waiting && <span className="chip">Pending confirmation</span>}
              </li>
            )
          })}
        </ul>
      </section>
      {pending.length > 0 && (
        <section className="plaque p-6">
          <h2>Pending payments</h2>
          <ul className="stack">
            {pending.map((p) => (
              <li className="transfer" key={p.id}>
                <span>
                  {name(p.from)} → {name(p.to)} <strong>{formatCents(p.cents)}</strong>
                </span>
                {p.to === meId ? (
                  <button disabled={busy} onClick={() => void run(() => confirmPayment(p.id))}>
                    Confirm
                  </button>
                ) : (
                  <span className="chip">Pending</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <details className="plaque p-6">
        <summary>How the money works</summary>
        <p>
          Miss your daily requirement and owe $1 to each player who met theirs. Miss a powerup
          deadline and owe $2 to each player who cleared; confirmed payments reduce your balance.
        </p>
      </details>
    </div>
  )
}
