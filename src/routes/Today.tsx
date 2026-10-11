import { useRef, useState } from 'react'
import { useCountdown } from '../components/Countdown.tsx'
import { Invite } from '../components/Invite.tsx'
import { Sprite } from '../components/Sprite.tsx'
import { formatCountdown } from '../lib/time.ts'
import { formatCents, netBalances } from '../lib/marker.ts'
import { atStakeTonight } from '../lib/standing.ts'
import { POWERUPS, settleFor } from '../lib/rules.ts'
import { compressImage } from '../lib/image.ts'
import { useTodayAction } from '../lib/useTodayAction.ts'
import { navigate } from '../lib/navigation.ts'
import { useTable } from '../store/useTable.ts'

const time = (at?: number) =>
  at ? new Date(at * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
export function Today() {
  const s = useTable()
  const action = useTodayAction()
  const { standing: mine } = action
  const ms = useCountdown(s.table.tz)
  const [photo, setPhoto] = useState('')
  const [caption, setCaption] = useState('')
  const [fileError, setFileError] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const file = useRef<HTMLInputElement>(null)
  const balance = netBalances(s.markers, s.payments).get(s.meId) ?? 0
  const crew = s.players
    .map((player) => ({
      player,
      standing: settleFor(s.powerups, s.antes, player.id, s.today, s.daily.slug),
      at: s.antes
        .filter((a) => a.playerId === player.id && a.dayDate === s.today && a.status === 'verified')
        .reduce((at, a) => Math.max(at, a.lcTimestamp ?? 0), 0),
    }))
    .sort(
      (a, b) =>
        Number(b.standing.status === 'clear') - Number(a.standing.status === 'clear') ||
        a.at - b.at,
    )
  const feed = s.antes.filter((a) => a.dayDate === s.today && a.photo && a.status === 'verified')
  const name = (id: string) => s.players.find((p) => p.id === id)?.displayName ?? id
  return (
    <div className="stack today">
      <section className="countdown">
        <div className="hud-label">Table closes in</div>
        <div className={`clock ${ms < 3600000 ? 'danger' : ''}`} aria-label={formatCountdown(ms)}>
          {formatCountdown(ms)
            .split('')
            .map((digit, i) => (
              <span aria-hidden key={i}>
                {digit}
              </span>
            ))}
        </div>
        <p>{s.table.name}</p>
      </section>
      <section className="plaque status-card">
        <div className="hud-label">Your status tonight</div>
        <h1>{mine.requirement.sentence}</h1>
        {mine.requirement.powerup && (
          <p className="ice">
            {POWERUPS[mine.requirement.powerup.kind].label} from{' '}
            {name(mine.requirement.powerup.fromId)}, {mine.requirement.daysLeft} days left
          </p>
        )}
        <div className="progress-number">
          {mine.progress.done}/{mine.progress.needed}
        </div>
        <div
          className="segments"
          aria-label={`${mine.progress.done} of ${mine.progress.needed} solved`}
        >
          {Array.from({ length: mine.progress.needed }, (_, i) => (
            <span key={i} className={i < mine.progress.done ? 'filled' : ''} />
          ))}
        </div>
        <p
          className={
            mine.status === 'clear' ? 'safe' : mine.requirement.daysLeft > 1 ? 'ice' : 'danger'
          }
        >
          {mine.status === 'clear'
            ? "You're clear tonight"
            : mine.requirement.daysLeft > 1
              ? `Powerup window: ${mine.requirement.daysLeft} days left`
              : `${formatCents(atStakeTonight(mine))} at stake if you stop now, per clear player`}
        </p>
        <a
          className="balance-link"
          href="/settle"
          onClick={(e) => {
            e.preventDefault()
            navigate('/settle')
          }}
        >
          Balance{' '}
          <strong className={balance < 0 ? 'danger' : balance > 0 ? 'safe' : ''}>
            {formatCents(balance)}
          </strong>
          <span aria-hidden>→</span>
        </a>
        <div className="primary-bar">
          <button
            className={`hud-action ${action.state === 'clear' ? 'clear-button' : ''}`}
            disabled={action.state === 'clear' || action.state === 'scanning'}
            onClick={() => (action.state === 'photo' ? file.current?.click() : void action.check())}
          >
            {action.label}
          </button>
          {action.state === 'partial' && (
            <span>{Math.max(0, mine.progress.needed - mine.progress.done)} more to go</span>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Proof photo"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              setPhoto(await compressImage(f))
              setFileError('')
            } catch {
              setFileError('Could not read that photo. Try another.')
            }
          }}
        />
        {(action.message || fileError) && (
          <p role="status" className="danger">
            {action.message || fileError}
          </p>
        )}
        {photo && (
          <form
            className="stack proof-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await action.post(photo, caption)) setPhoto('')
            }}
          >
            <img src={photo} alt="Your proof preview" />
            <label>
              Caption
              <input value={caption} maxLength={80} onChange={(e) => setCaption(e.target.value)} />
            </label>
            <button disabled={action.state === 'scanning'}>Post proof</button>
          </form>
        )}
      </section>
      <div className="dealer">
        <Sprite name="dealer-idle" size={40} />
        <p>
          {mine.status === 'clear'
            ? 'Nice. The table can sweat without you.'
            : 'One accepted submission beats a very good excuse.'}
        </p>
      </div>
      <section className="plaque p-6">
        <div className="section-heading">
          <h2>The crew</h2>
          <span className="hud-label">
            {crew.filter((p) => p.standing.status === 'clear').length} of {crew.length} clear
          </span>
        </div>
        {crew.length <= 1 ? (
          <Invite />
        ) : (
          <ul>
            {crew.map(({ player, standing, at }) => (
              <li className="crew-row" key={player.id}>
                <span className="avatar" aria-hidden>
                  {player.displayName[0]}
                </span>
                <div className="crew-name">
                  <strong>{player.displayName}</strong>
                  {standing.requirement.powerup && (
                    <span className="ice">{POWERUPS[standing.requirement.powerup.kind].label}</span>
                  )}
                  {standing.status === 'clear' && <small>{time(at)}</small>}
                </div>
                <span className="score">
                  {standing.progress.done}/{standing.progress.needed}
                </span>
                <span
                  className={`chip ${standing.status === 'clear' ? 'safe' : standing.requirement.powerup ? 'ice' : 'danger'}`}
                >
                  {standing.status === 'clear'
                    ? 'Clear'
                    : standing.requirement.powerup
                      ? 'Powerup'
                      : 'Still out'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h2>Proofs</h2>
          <span className="hud-label">{action.posted ? 'Cards up' : 'Face down'}</span>
        </div>
        {!action.posted ? (
          <>
            <p>Post yours to flip these</p>
            <div className="proof-grid">
              {[0, 1].map((i) => (
                <div key={i} className="face-down" aria-hidden>
                  ♠
                </div>
              ))}
            </div>
          </>
        ) : !feed.length ? (
          <p>No proofs yet. Yours can start the table.</p>
        ) : (
          <div className="proof-grid">
            {feed.map((a) => (
              <article className="plaque proof" key={a.id}>
                <header>
                  <strong>{name(a.playerId)}</strong>
                  <small>{time(a.lcTimestamp)}</small>
                </header>
                <img src={a.photo} alt={`${name(a.playerId)}'s proof, ${time(a.lcTimestamp)}`} />
                <p>{a.caption}</p>
                <div className="reactions">
                  {['🔥', '💀', '👑'].map((emoji) => (
                    <button
                      aria-label={`React ${emoji}`}
                      aria-pressed={a.reactions[emoji]?.includes(s.meId) ?? false}
                      key={emoji}
                      onClick={() => void s.react(a.id, emoji)}
                    >
                      {emoji} {a.reactions[emoji]?.length || ''}
                    </button>
                  ))}
                </div>
                {a.comments.map((c) => (
                  <p key={c.id}>
                    <b>{name(c.playerId)}</b> {c.body}
                  </p>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (drafts[a.id]?.trim()) {
                      void s.comment(a.id, drafts[a.id].trim())
                      setDrafts({ ...drafts, [a.id]: '' })
                    }
                  }}
                >
                  <input
                    aria-label={`Comment on ${name(a.playerId)}'s proof`}
                    placeholder="Say something"
                    maxLength={90}
                    value={drafts[a.id] ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
                  />
                  <button>Send</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
