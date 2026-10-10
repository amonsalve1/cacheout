import { useState } from 'react'
import { inviteLink } from '../lib/session.ts'
import { useTable } from '../store/useTable.ts'

export function Invite() {
  const { table, players } = useTable()
  const link = inviteLink(table.joinCode)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const copy = async (what: 'code' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      setCopied(null)
      window.prompt('Copy this:', text)
    }
  }

  return (
    <div>
      <p className="hud-body mt-3 text-[14px] text-[var(--ink-2)]">
        {players.length} at {table.name}. Anyone with the code can pull up a chair.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="hud-label text-[var(--ink-3)]">Code</span>
        <span className="hud-value text-[28px] tracking-[0.24em] text-[var(--accent-lt)]">
          {table.joinCode}
        </span>
        <button
          type="button"
          onClick={() => copy('code', table.joinCode)}
          className="hud-ghost ml-auto"
        >
          {copied === 'code' ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-4 border-t border-[var(--edge-soft)] pt-4">
        <span className="hud-label text-[var(--ink-3)]">Invite link</span>
        <div className="mt-2 flex items-center gap-2">
          <code className="field hud-num min-w-0 flex-1 truncate !py-2 !text-[14px] text-[var(--ink-2)]">
            {link}
          </code>
          <button type="button" onClick={() => copy('link', link)} className="hud-ghost shrink-0">
            {copied === 'link' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}
