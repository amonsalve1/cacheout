import { useEffect, useRef } from 'react'
import sheet from '../assets/backdrops/floor.png'
export default function LandingBackdrop() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const timer = setInterval(() => {
      frame = (frame + 1) % 64
      if (ref.current)
        ref.current.style.backgroundPosition = `${((frame % 8) / 7) * 100}% ${(Math.floor(frame / 8) / 7) * 100}%`
    }, 160)
    return () => clearInterval(timer)
  }, [])
  return (
    <div
      aria-hidden
      ref={ref}
      className="landing-backdrop"
      style={{ backgroundImage: `url(${sheet})` }}
    />
  )
}
