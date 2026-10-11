import { useState } from 'react'
import { Sheet } from '../components/Sheet.tsx'
import { Invite } from '../components/Invite.tsx'
import { addDays } from '../lib/time.ts'
import { streakOf } from '../lib/derive.ts'
import { useTable } from '../store/useTable.ts'
export function ProfileSheet({ close }: { close: () => void }) {
  const s = useTable()
  const me = s.players.find((p) => p.id === s.meId)
  const [name, setName] = useState(me?.displayName ?? '')
  const [handle, setHandle] = useState(me?.leetcodeUsername ?? '')
  const [venmo, setVenmo] = useState(me?.venmoHandle ?? '')
  const [tableName, setTableName] = useState(s.table.name)
  const [tz, setTz] = useState(s.table.tz)
  const [webhook, setWebhook] = useState(s.table.discordWebhookUrl ?? '')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const days = Array.from({ length: 14 }, (_, i) => addDays(s.today, -i - 1)).filter(
    (day) => !me?.joinedAt || day >= me.joinedAt.slice(0, 10),
  )
  const done = days.filter((day) =>
    s.antes.some((a) => a.playerId === s.meId && a.dayDate === day && a.status === 'verified'),
  ).length
  return (
    <Sheet title="Your profile" close={close}>
      <div className="stack">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              const r = await s.updateProfile({
                displayName: name,
                leetcodeUsername: handle,
                venmoHandle: venmo,
              })
              setNotice(r.ok ? 'Profile saved.' : r.message)
            } catch {
              setNotice('Could not save. Try again.')
            } finally {
              setBusy(false)
            }
          }}
        >
          <label>
            Name
            <input required maxLength={14} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            LeetCode handle
            <input
              required
              maxLength={39}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={Boolean(
                me?.usernameLockedUntil &&
                me.usernameLockedUntil > new Date().toISOString().slice(0, 10),
              )}
            />
          </label>
          <p>
            {me?.usernameLockedUntil
              ? `Handle locked until ${me.usernameLockedUntil}.`
              : 'Changing your handle locks it for 7 days.'}
          </p>
          <label>
            Venmo handle
            <input
              value={venmo}
              maxLength={30}
              onChange={(e) => setVenmo(e.target.value.replace(/^@/, ''))}
            />
          </label>
          <button disabled={busy}>Save profile</button>
          <p role="status">{notice}</p>
        </form>
        <section>
          <h2>Last 14 days</h2>
          <p>
            {done} done · {days.length - done} missed · {streakOf(s.antes, s.meId, s.today)} day
            streak
          </p>
        </section>
        <section>
          <h2>Invite your crew</h2>
          <Invite />
        </section>
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            await s.updateTable({ name: tableName, tz, discordWebhookUrl: webhook })
            setBusy(false)
          }}
        >
          <h2>Table settings</h2>
          <label>
            Table name
            <input
              required
              maxLength={40}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </label>
          <label>
            Timezone
            <input required value={tz} onChange={(e) => setTz(e.target.value)} />
          </label>
          <label>
            Discord webhook (optional)
            <input
              type="url"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://discord.com/api/webhooks/…"
            />
          </label>
          <button disabled={busy}>Save table settings</button>
        </form>
        <button
          onClick={() => {
            close()
            void s.signOut()
          }}
        >
          Sign out
        </button>
      </div>
    </Sheet>
  )
}
