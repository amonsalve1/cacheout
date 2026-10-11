import { useState } from 'react'
import { Sheet } from '../components/Sheet.tsx'
import { POWERUPS, activePowerups, deadlineOf, type PowerupKind } from '../lib/rules.ts'
import { useTable } from '../store/useTable.ts'
const ends = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString([], { weekday: 'long' })
export function Powerups() {
  const s = useTable()
  const [target, setTarget] = useState('')
  const [kind, setKind] = useState<PowerupKind | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = (id: string) => s.players.find((p) => p.id === id)?.displayName ?? id
  const live = s.powerups.filter((p) => !p.clearedOn && deadlineOf(p) >= s.today)
  return (
    <div className="stack">
      <header>
        <div className="hud-label">Raise the stakes</div>
        <h1>Powerups</h1>
        <p>A little pressure. A few days to deliver.</p>
      </header>
      <section className="plaque p-6">
        <h2>1. Pick a player</h2>
        <div className="stack">
          {s.players
            .filter((p) => p.id !== s.meId)
            .map((p) => {
              const active = activePowerups(s.powerups, p.id, s.today)[0]
              return (
                <button
                  className="choice"
                  aria-pressed={target === p.id}
                  key={p.id}
                  disabled={Boolean(active)}
                  onClick={() => {
                    setTarget(p.id)
                    setKind(null)
                  }}
                >
                  <strong>{p.displayName}</strong>
                  <span>
                    {active
                      ? `Already on ${POWERUPS[active.kind].label} until ${ends(deadlineOf(active))}`
                      : 'Ready for a challenge'}
                  </span>
                </button>
              )
            })}
          {s.players.length < 2 && <p>Invite a friend from your profile to get started.</p>}
        </div>
      </section>
      {target && (
        <section className="plaque p-6">
          <h2>2. Pick a powerup</h2>
          <div className="stack">
            {(Object.keys(POWERUPS) as PowerupKind[]).map((k) => (
              <button
                className="choice"
                key={k}
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
              >
                <strong className="ice">{POWERUPS[k].label}</strong>
                <span>{POWERUPS[k].blurb}</span>
                <span>{POWERUPS[k].days} days · $2 per clear player if missed</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {target && kind && (
        <button className="hud-action" onClick={() => setConfirm(true)}>
          3. Review powerup
        </button>
      )}
      {confirm && kind && (
        <Sheet title="Play this powerup?" close={() => setConfirm(false)}>
          <p>
            {name(target)} must {POWERUPS[kind].blurb.toLowerCase()} within {POWERUPS[kind].days}{' '}
            days, or owe $2 to each player who clears.
          </p>
          <button
            className="hud-action"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await s.playPowerup(target, kind)
              setBusy(false)
              setConfirm(false)
              setTarget('')
              setKind(null)
            }}
          >
            Confirm powerup
          </button>
        </Sheet>
      )}
      {(['On you', 'Played by you'] as const).map((label) => {
        const list = live.filter((p) =>
          label === 'On you' ? p.targetId === s.meId : p.fromId === s.meId,
        )
        return (
          <section key={label} className="plaque p-6">
            <h2>{label}</h2>
            {!list.length ? (
              <p>No live powerups.</p>
            ) : (
              <ul className="stack">
                {list.map((p) => (
                  <li key={p.id}>
                    <strong className="ice">{POWERUPS[p.kind].label}</strong>{' '}
                    {label === 'On you' ? `from ${name(p.fromId)}` : `on ${name(p.targetId)}`}
                    <p>ends {ends(deadlineOf(p))}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
