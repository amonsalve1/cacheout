export type PaletteEntry = { name: string; hex: string }
export type Palette = { name: string; entries: PaletteEntry[] }

const e = (name: string, hex: string): PaletteEntry => ({ name, hex })

export const PICO8: Palette = {
  name: 'pico8',
  entries: [
    e('black', '#000000'),
    e('dark-blue', '#1d2b53'),
    e('dark-purple', '#7e2553'),
    e('dark-green', '#008751'),
    e('brown', '#ab5236'),
    e('dark-grey', '#5f574f'),
    e('light-grey', '#c2c3c7'),
    e('white', '#fff1e8'),
    e('red', '#ff004d'),
    e('orange', '#ffa300'),
    e('yellow', '#ffec27'),
    e('green', '#00e436'),
    e('blue', '#29adff'),
    e('lavender', '#83769c'),
    e('pink', '#ff77a8'),
    e('peach', '#ffccaa'),
  ],
}

export const CACHE_OUT: Palette = {
  name: 'cacheout',
  entries: [
    e('void', '#000000'),
    e('ink', '#11081c'),
    e('velvet', '#241734'),
    e('dusk', '#3d2a52'),
    e('mauve', '#5b4478'),
    e('chrome-dim', '#8b7aa8'),
    e('chrome', '#c2b8d4'),
    e('white', '#ffffff'),

    e('felt-deep', '#052e18'),
    e('felt', '#0a5c36'),
    e('felt-lit', '#12a05c'),
    e('mint', '#3ee88a'),

    e('blood', '#3d0410'),
    e('chip-red-dk', '#8f0c26'),
    e('chip-red', '#e01e3c'),
    e('chip-red-lt', '#ff6b7f'),

    e('magenta-dk', '#a8006b'),
    e('hot-pink', '#ff2d95'),
    e('pink-lt', '#ff8fd0'),

    e('navy', '#062a4d'),
    e('blue', '#0a5c9e'),
    e('cyan', '#1fb6e8'),
    e('ice', '#7ff0ff'),

    e('bronze-dk', '#4d2f00'),
    e('bronze', '#a06a00'),
    e('gold', '#ffb020'),
    e('gold-lt', '#ffe680'),

    e('ember', '#d13800'),
    e('orange', '#ff7a1a'),

    e('violet', '#6b00d1'),
    e('amethyst', '#a855f7'),
    e('lilac', '#d9a5ff'),
  ],
}

export const PALETTES: Record<string, Palette> = {
  pico8: PICO8,
  cacheout: CACHE_OUT,
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function paletteBytes(p: Palette): Uint8Array {
  const out = new Uint8Array(p.entries.length * 3)
  p.entries.forEach((entry, i) => {
    const [r, g, b] = hexToRgb(entry.hex)
    out[i * 3] = r
    out[i * 3 + 1] = g
    out[i * 3 + 2] = b
  })
  return out
}

export function resolvePalette(name: string): Palette {
  const p = PALETTES[name]
  if (!p) throw new Error(`unknown palette "${name}" (have: ${Object.keys(PALETTES).join(', ')})`)
  return p
}

export function hexV3(hex: string): { x: number; y: number; z: number } {
  const [r, g, b] = hexToRgb(hex)
  return { x: r / 255, y: g / 255, z: b / 255 }
}

export function color(p: Palette, name: string): { x: number; y: number; z: number } {
  const entry = p.entries.find((e) => e.name === name)
  if (!entry) throw new Error(`no colour "${name}" in palette "${p.name}"`)
  return hexV3(entry.hex)
}
