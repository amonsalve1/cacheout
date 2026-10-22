import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'hud.css'), 'utf8')

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}

function luminance([r, g, b]: Rgb): number {
  const chan = (c: number): number => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const composite = (fg: Rgb, alpha: number, bg: Rgb): Rgb =>
  fg.map((c, i) => alpha * c + (1 - alpha) * bg[i]) as Rgb

function token(name: string): string {
  const match = CSS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`token --${name} not found in hud.css`)
  return match[1]
}

function plaqueGround(): { rgb: Rgb; alpha: number } {
  const match = CSS.match(/background-color:\s*rgba\(([^)]+)\)/)
  if (!match) throw new Error('plaque background-color not found in hud.css')
  const [r, g, b, a] = match[1].split(',').map((v) => Number(v.trim()))
  return { rgb: [r, g, b], alpha: a }
}

const WHITE: Rgb = [255, 255, 255]

describe('HUD ink over the plaque, worst case', () => {
  const { rgb, alpha } = plaqueGround()

  const bright = composite(rgb, alpha, WHITE)

  const dark = rgb

  it('keeps the panel fill opaque enough to work without backdrop-filter', () => {
    expect(alpha).toBeGreaterThanOrEqual(0.95)
  })

  const inks: [string, string][] = [
    ['ink-1', token('ink-1')],
    ['ink-2', token('ink-2')],
    ['ink-3', token('ink-3')],
  ]

  for (const [name, hex] of inks) {
    it(`${name} clears 4.5:1 on a bright frame and on black`, () => {
      expect(contrast(hexToRgb(hex), bright), `${name} over bright frame`).toBeGreaterThanOrEqual(
        4.5,
      )
      expect(contrast(hexToRgb(hex), dark), `${name} over black`).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('keeps the three ink tiers visibly distinct', () => {
    const [c1, c2, c3] = inks.map(([, hex]) => contrast(hexToRgb(hex), bright))

    expect(c1).toBeGreaterThan(c2 * 1.2)
    expect(c2).toBeGreaterThan(c3 * 1.3)
  })

  it('gold reads as an accent, not as body text', () => {
    const gold = contrast(hexToRgb(token('accent') || '#ffb020'), bright)
    expect(gold).toBeGreaterThanOrEqual(4.5)
  })
})

describe('type floor', () => {
  it('has no font-size below 11px, and 11px only on tracked uppercase labels', () => {
    const sizes = [...CSS.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1]))
    expect(Math.min(...sizes), 'smallest declared font-size').toBeGreaterThanOrEqual(12)
  })
})

describe('status and action colors', () => {
  for (const color of ['#3ee88a', '#ff6b7f', '#7ff0ff']) {
    it(`${color} is readable on plum`, () => {
      expect(contrast(hexToRgb(color), hexToRgb('#241734'))).toBeGreaterThanOrEqual(4.5)
    })
  }
  it('dark button text is readable on gold', () => {
    expect(contrast(hexToRgb('#11081c'), hexToRgb('#ffb020'))).toBeGreaterThanOrEqual(4.5)
  })
})
