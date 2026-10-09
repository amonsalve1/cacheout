import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('cache-out: render failed', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[30rem] flex-col justify-center gap-6 px-5 py-16">
        <div className="text-center">
          <span className="chrome-text block font-[family-name:var(--font-display)] text-2xl leading-none">
            CACHE OUT
          </span>
        </div>
        <section className="plaque p-6">
          <div className="hud-label text-[var(--ink-3)]">The room went dark</div>
          <p className="hud-body mt-3 text-[14px] leading-snug text-[var(--ink-2)]">
            Something broke while drawing the table. Nothing has been charged and nothing has been
            lost — the ledger lives on the server, not in this page.
          </p>
          <p className="hud-num mt-3 break-words text-[12px] leading-snug text-[var(--ink-3)]">
            {error.message}
          </p>
          <button
            type="button"
            className="hud-action mt-5 w-full"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </section>
      </main>
    )
  }
}
