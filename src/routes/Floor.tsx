import { useEffect, useState } from 'react'
import { PixelButton } from '../components/ui.tsx'
import { backendKind } from '../backend/index.ts'
import { joinCodeFromUrl, rememberInvite } from '../lib/session.ts'
import { supabase } from '../lib/supabase.ts'
import { useTable } from '../store/useTable.ts'

export function Floor() {
  const { players, table, signIn } = useTable()
  const isDemo = backendKind() === 'demo'
  const invited = joinCodeFromUrl()

  const [inviteName, setInviteName] = useState('')
  const [cooldown, setCooldown] = useState(0)
  useEffect(() => {
    if (!invited) return
    if (isDemo) {
      setInviteName(table.name)
      return
    }
    void supabase
      ?.rpc('invite_table_name', { code: invited })
      .then(({ data }) => setInviteName(data ?? ''))
  }, [invited, isDemo, table.name])
  useEffect(() => {
    if (!cooldown) return
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [code, setCode] = useState(invited ?? '')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)

  const canEnter =
    name.trim().length > 0 && handle.trim().length > 0 && (isDemo || email.trim().length > 0)

  const enter = async () => {
    setBusy(true)
    setNotice(null)
    const typed = code.trim().toUpperCase()
    if (typed) rememberInvite(typed)
    const result = await signIn({
      email: email.trim() || undefined,
      displayName: name,
      leetcodeUsername: handle,
    })
    if (result.ok === 'pending') {
      setNotice({ tone: 'ok', text: result.message })
      setCooldown(30)
    } else if (result.ok === false) setNotice({ tone: 'bad', text: result.message })
    setBusy(false)
  }

  const field = 'field mt-2'

  return (
    <main className="door relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[30rem] flex-col justify-center gap-6 px-5 py-16">
      <div className="text-center">
        <span className="chrome-text block font-[family-name:var(--font-display)] text-2xl leading-none">
          CACHE OUT
        </span>
        <p className="hud-body mt-4 text-[16px] text-[var(--ink-2)]">
          Solve one LeetCode problem a day. Miss it and you owe everyone who didn&rsquo;t.
        </p>
      </div>

      <section className="plaque p-6">
        {isDemo && <p className="chip mb-4">Local demo · saved in this browser</p>}
        {invited && (
          <div className="mb-5 border-b border-[var(--edge-soft)] pb-4">
            <div className="hud-label">
              {inviteName ? `You're joining ${inviteName}` : 'You’ve been invited'}
            </div>
            <p className="hud-body mt-2 text-[14px] text-[var(--ink-2)]">
              Code <span className="hud-num text-[var(--accent-lt)]">{invited}</span> — sign in and
              it will be redeemed for you.
            </p>
          </div>
        )}

        {!isDemo && (
          <label className="block">
            <span className="hud-label text-[var(--ink-3)]">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="we send a sign-in link, not a password"
              className={field}
            />
          </label>
        )}

        <label className={`block ${isDemo ? '' : 'mt-4'}`}>
          <span className="hud-label text-[var(--ink-3)]">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={14}
            placeholder="what the table calls you"
            className={field}
          />
        </label>

        <label className="mt-4 block">
          <span className="hud-label text-[var(--ink-3)]">LeetCode username</span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={32}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="how we check you actually solved it"
            className={field}
          />
        </label>

        {!isDemo && !invited && (
          <label className="mt-4 block">
            <span className="hud-label text-[var(--ink-3)]">
              Invite code <span className="text-[var(--ink-3)] opacity-70">(optional)</span>
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="leave blank to open your own table"
              className={`${field} tracking-[0.2em]`}
            />
          </label>
        )}

        <PixelButton
          tone="gold"
          className="mt-6 w-full"
          disabled={!canEnter || busy || cooldown > 0}
          onClick={() => void enter()}
        >
          {busy
            ? 'One moment…'
            : cooldown
              ? `Resend in ${cooldown}s`
              : notice?.tone === 'ok'
                ? 'Resend magic link'
                : isDemo
                  ? 'Take your seat'
                  : 'Send magic link'}
        </PixelButton>

        {notice && (
          <p
            className={`hud-body mt-3 text-[14px] leading-snug ${
              notice.tone === 'ok' ? 'text-[var(--co-mint)]' : 'text-[var(--co-chip-red-lt)]'
            }`}
          >
            {notice.tone === 'ok' ? `Check your email. ${notice.text}` : notice.text}
          </p>
        )}

        <p className="hud-body mt-3 text-[12px] leading-snug text-[var(--ink-3)]">
          {isDemo
            ? 'Nothing is sent anywhere — this build keeps your table in this browser. Signing in with a name already at the table resumes that seat.'
            : 'We only use your email to send the sign-in link.'}
        </p>
      </section>

      {isDemo && (
        <section>
          <div className="hud-label text-[var(--ink-3)]">Or resume a seat</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  void signIn({ displayName: p.displayName, leetcodeUsername: p.leetcodeUsername })
                }
                className="hud-ghost"
              >
                {p.displayName}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
