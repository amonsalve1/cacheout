import type { ReactNode } from 'react'

export function PixelButton({
  children,
  onClick,
  tone = 'gold',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'gold' | 'pink' | 'ghost' | 'danger'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) {
  const primary = tone === 'gold' || tone === 'pink'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${primary ? 'hud-action' : 'hud-ghost'} disabled:cursor-not-allowed
        ${tone === 'danger' ? 'border-[color-mix(in_oklab,var(--co-chip-red)_55%,transparent)] text-[var(--co-chip-red-lt)] hover:border-[var(--co-chip-red)] hover:text-[var(--co-chip-red-lt)]' : ''}
        ${className}`}
    >
      {children}
    </button>
  )
}
