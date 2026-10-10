import manifest from '../assets/sprites/manifest.json'

const urls = import.meta.glob('../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export type SpriteName = keyof typeof manifest

function urlFor(file: string): string {
  const entry = Object.entries(urls).find(([path]) => path.endsWith(`/${file}`))
  if (!entry) throw new Error(`sprite "${file}" missing — run \`npm run assets\``)
  return entry[1]
}

export function Sprite({
  name,
  size = 48,
  animate = false,
  durationMs = 900,
  className = '',
  title,
}: {
  name: SpriteName
  size?: number
  animate?: boolean
  durationMs?: number
  className?: string
  title?: string
}) {
  const meta = manifest[name]
  const url = urlFor(meta.file)

  if (meta.frames === 1) {
    return (
      <img
        src={url}
        alt={title ?? ''}
        title={title}
        width={size}
        height={size}
        className={`pixelated shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      role="img"
      aria-label={title ?? name}
      title={title}
      className={`pixelated inline-block shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${url})`,
        backgroundSize: `${size * meta.frames}px ${size}px`,
        backgroundRepeat: 'no-repeat',
        animation: animate
          ? `sprite-${meta.frames} ${durationMs}ms steps(${meta.frames}) infinite`
          : undefined,
      }}
    />
  )
}

export function SpriteKeyframes() {
  const counts = [...new Set(Object.values(manifest).map((m) => m.frames))].filter((n) => n > 1)
  const css = counts
    .map((n) => `@keyframes sprite-${n}{to{background-position-x:-${n * 100}%}}`)
    .join('\n')
  return <style>{css}</style>
}
