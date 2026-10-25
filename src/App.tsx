import { lazy, Suspense, useEffect } from 'react'
import { SpriteKeyframes } from './components/Sprite.tsx'
import { Today } from './routes/Today.tsx'
import { Floor } from './routes/Floor.tsx'
import { formatCents } from './lib/marker.ts'
import { settleFor } from './lib/rules.ts'
import { atStakeTonight } from './lib/standing.ts'
import { navigate, useLocation } from './lib/navigation.ts'
import { useSweep } from './lib/useSweep.ts'
import { useTable } from './store/useTable.ts'
const Powerups = lazy(() => import('./routes/Powerups.tsx').then((m) => ({ default: m.Powerups })))
const Settle = lazy(() => import('./routes/Settle.tsx').then((m) => ({ default: m.Settle })))
const Profile = lazy(() =>
  import('./routes/ProfileSheet.tsx').then((m) => ({ default: m.ProfileSheet })),
)
const Backdrop = lazy(() => import('./components/LandingBackdrop.tsx'))
const tabs = [
  ['/', 'Today'],
  ['/powerups', 'Powerups'],
  ['/settle', 'Settle up'],
]
function Skeleton() {
  return (
    <div aria-label="Loading" className="stack">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  )
}
export default function App() {
  const s = useTable()
  const location = useLocation()
  const url = new URL(location, window.location.origin)
  const profile = url.searchParams.has('me')
  const close = () => {
    if (window.history.state?.profile) window.history.back()
    else {
      url.searchParams.delete('me')
      navigate(url.pathname + url.search)
    }
  }
  useSweep()
  useEffect(() => {
    void s.init()
  }, [s.init])
  useEffect(() => {
    if (!s.error) return
    const timer = setTimeout(s.dismissError, 7000)
    return () => clearTimeout(timer)
  }, [s.error, s.dismissError])
  const stake = atStakeTonight(settleFor(s.powerups, s.antes, s.meId, s.today, s.daily.slug))
  if (s.status === 'loading')
    return (
      <main className="app-content">
        <Skeleton />
      </main>
    )
  if (!s.identity)
    return (
      <>
        <Suspense fallback={null}>
          <Backdrop />
        </Suspense>
        <Floor />
      </>
    )
  return (
    <>
      <SpriteKeyframes />
      <header className="app-header">
        <a
          href="/"
          className="wordmark"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          CACHE OUT
        </a>
        <nav aria-label="Main navigation">
          {tabs.map(([href, title]) => (
            <a
              key={href}
              href={href}
              aria-current={url.pathname === href ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                navigate(href)
              }}
            >
              {title}
            </a>
          ))}
        </nav>
        <div className="header-account">
          <span className="header-stake">
            <span className="hud-label">At stake tonight</span>
            <strong className={stake ? 'danger' : 'safe'}>{formatCents(stake)}</strong>
          </span>
          <button
            className="avatar"
            aria-label="Open profile"
            onClick={() => {
              url.searchParams.set('me', '1')
              window.history.pushState({ profile: true }, '', url.pathname + url.search)
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          >
            {s.identity.displayName[0]}
          </button>
          <button className="mute" aria-label={s.muted ? 'Unmute' : 'Mute'} onClick={s.toggleMuted}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path d="M2 7h4l5-4v14l-5-4H2z" fill="currentColor" />
              {s.muted ? (
                <path d="m14 7 4 6m0-6-4 6" stroke="currentColor" strokeWidth="2" />
              ) : (
                <path d="M14 5q6 5 0 10" fill="none" stroke="currentColor" strokeWidth="2" />
              )}
            </svg>
          </button>
        </div>
      </header>
      <main className="app-content">
        <Suspense fallback={<Skeleton />}>
          {url.pathname === '/powerups' ? (
            <Powerups />
          ) : url.pathname === '/settle' ? (
            <Settle />
          ) : (
            <Today />
          )}
        </Suspense>
      </main>
      {profile && (
        <Suspense fallback={null}>
          <Profile close={close} />
        </Suspense>
      )}
      {s.error && (
        <div className="toast" role="status">
          <span>{s.error}</span>
          <button aria-label="Dismiss error" onClick={s.dismissError}>
            ✕
          </button>
        </div>
      )}
    </>
  )
}
