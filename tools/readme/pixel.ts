import { CACHE_OUT } from '../pixeltracer/src/palette.ts'
import { upscaleNearest } from '../pixeltracer/src/upscale.ts'

export const P = Object.fromEntries(CACHE_OUT.entries.map((e) => [e.name, e.hex])) as Record<string, string>

export type Img = { data: Uint8Array; width: number; height: number }

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export class Art {
  readonly w: number
  readonly h: number
  readonly data: Uint8Array

  constructor(w: number, h: number, bg?: string) {
    this.w = w
    this.h = h
    this.data = new Uint8Array(w * h * 4)
    if (bg) this.rect(0, 0, w, h, bg)
  }

  px(x: number, y: number, hex: string, a = 1): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    const [r, g, b] = rgb(hex)
    if (a >= 1 || this.data[i + 3] === 0) {
      this.data[i] = r
      this.data[i + 1] = g
      this.data[i + 2] = b
      this.data[i + 3] = 255
      return
    }
    this.data[i] = Math.round(this.data[i] * (1 - a) + r * a)
    this.data[i + 1] = Math.round(this.data[i + 1] * (1 - a) + g * a)
    this.data[i + 2] = Math.round(this.data[i + 2] * (1 - a) + b * a)
  }

  rect(x: number, y: number, w: number, h: number, hex: string, a = 1): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, hex, a)
  }

  hline(x: number, y: number, w: number, hex: string): void {
    this.rect(x, y, w, 1, hex)
  }

  vline(x: number, y: number, h: number, hex: string): void {
    this.rect(x, y, 1, h, hex)
  }

  dither(x: number, y: number, w: number, h: number, hex: string, t: (i: number, j: number) => number): void {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const X = x + i
        const Y = y + j
        if (t(i, j) * 16 > BAYER4[(Y & 3) * 4 + (X & 3)] + 0.5) this.px(X, Y, hex)
      }
  }

  box(
    x: number,
    y: number,
    w: number,
    h: number,
    o: { face?: string; edge?: string; hi?: string; lo?: string; shadow?: boolean } = {},
  ): void {
    const { face = P.ink, edge = P.void, hi = P.dusk, lo, shadow = true } = o
    if (shadow) this.rect(x + 2, y + 2, w, h, P.void, 0.55)
    this.rect(x, y, w, h, edge)
    this.rect(x + 1, y + 1, w - 2, h - 2, face)
    this.hline(x + 1, y + 1, w - 2, hi)
    this.vline(x + 1, y + 1, h - 2, hi)
    if (lo) {
      this.hline(x + 1, y + h - 2, w - 2, lo)
      this.vline(x + w - 2, y + 1, h - 2, lo)
    }
  }

  disc(cx: number, cy: number, r: number, hex: string, squash = 1): void {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + (y * squash) ** 2 <= r * r + r * 0.6) this.px(cx + x, cy + y, hex)
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, hex: string): void {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1.02) this.px(cx + x, cy + y, hex)
  }

  grid(x: number, y: number, rows: string[], map: Record<string, string>, flip = false): void {
    rows.forEach((row, j) => {
      const r = flip ? [...row].reverse().join('') : row
      for (let i = 0; i < r.length; i++) {
        const hex = map[r[i]]
        if (hex) this.px(x + i, y + j, hex)
      }
    })
  }

  dots(points: [number, number][], hex: string, every = 3, offset = 0): void {
    let k = offset
    for (let n = 0; n < points.length - 1; n++) {
      const [x0, y0] = points[n]
      const [x1, y1] = points[n + 1]
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
      for (let s = 0; s < steps; s++) {
        if (k++ % every === 0) this.px(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, hex)
      }
    }
  }

  curve(x0: number, y0: number, x1: number, y1: number, hex: string, every = 3, bend = 0.5): [number, number][] {
    const pts: [number, number][] = []
    const mx = x0 + (x1 - x0) * bend
    const n = 48
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const a = (1 - t) ** 3
      const b = 3 * (1 - t) ** 2 * t
      const c = 3 * (1 - t) * t * t
      const d = t ** 3
      pts.push([a * x0 + b * mx + c * mx + d * x1, a * y0 + b * y0 + c * y1 + d * y1])
    }
    this.dots(pts, hex, every)
    return pts
  }

  arrow(x: number, y: number, hex: string, dir: 'r' | 'l' | 'd' | 'u' = 'r'): void {
    const g = ['x...', 'xx..', 'xxx.', 'xx..', 'x...']
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 4; i++) {
        if (g[j][i] !== 'x') continue
        if (dir === 'r') this.px(x - 3 + i, y - 2 + j, hex)
        if (dir === 'l') this.px(x + 3 - i, y - 2 + j, hex)
        if (dir === 'd') this.px(x - 2 + j, y - 3 + i, hex)
        if (dir === 'u') this.px(x - 2 + j, y + 3 - i, hex)
      }
  }

  blit(img: Img, x: number, y: number): void {
    for (let j = 0; j < img.height; j++)
      for (let i = 0; i < img.width; i++) {
        const s = (j * img.width + i) * 4
        const a = img.data[s + 3]
        if (a < 128) continue
        const X = x + i
        const Y = y + j
        if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue
        const d = (Y * this.w + X) * 4
        this.data[d] = img.data[s]
        this.data[d + 1] = img.data[s + 1]
        this.data[d + 2] = img.data[s + 2]
        this.data[d + 3] = 255
      }
  }

  image(k: number): Img {
    return upscaleNearest(this.data, this.w, this.h, k)
  }
}

export function carpet(art: Art, y0 = 0, y1 = art.h): void {
  art.rect(0, y0, art.w, y1 - y0, P.velvet)
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < art.w; x++) {
      const u = ((x + 3) % 12) - 6
      const v = ((y + (Math.floor((x + 3) / 12) % 2) * 6) % 12) - 6
      const d = Math.abs(u) + Math.abs(v)
      if (d === 5) art.px(x, y, '#2c1d3f')
      if (d === 0) art.px(x, y, '#33224a')
    }
}

export function marquee(art: Art, y = 0, x0 = 0, x1 = art.w, phase = 0): void {
  art.rect(x0, y, x1 - x0, 7, P.ink)
  art.hline(x0, y + 7, x1 - x0, P.bronze)
  art.hline(x0, y + 8, x1 - x0, P['bronze-dk'])
  for (let x = x0 + 3, k = phase; x < x1 - 2; x += 6, k++) {
    const lit = k % 2 === 0
    const c = lit ? P['gold-lt'] : P.bronze
    if (lit) {
      art.px(x - 1, y + 2, P.gold, 0.5)
      art.px(x + 2, y + 2, P.gold, 0.5)
      art.px(x - 1, y + 4, P.gold, 0.5)
      art.px(x + 2, y + 4, P.gold, 0.5)
    }
    art.rect(x, y + 2, 2, 3, c)
    if (lit) art.px(x, y + 2, P.white)
  }
}

export function bulbFrame(art: Art, x: number, y: number, w: number, h: number, phase = 0): void {
  let k = phase
  const bulb = (bx: number, by: number) => {
    const lit = k++ % 2 === 0
    art.rect(bx, by, 2, 2, lit ? P['gold-lt'] : P.bronze)
    if (lit) art.px(bx, by, P.white)
  }
  for (let i = x + 2; i < x + w - 3; i += 5) bulb(i, y + 1)
  for (let j = y + 6; j < y + h - 5; j += 5) bulb(x + w - 3, j)
  for (let i = x + w - 5; i > x + 1; i -= 5) bulb(i, y + h - 3)
  for (let j = y + h - 8; j > y + 4; j -= 5) bulb(x + 1, j)
}

export type Face = 'happy' | 'sad' | 'sweat' | 'smug' | 'shock' | 'money' | 'neutral' | 'cool'
export type Hair = 'short' | 'long' | 'cap' | 'bun' | 'spiky' | 'curly'
export type Look = { skin: string; hair: string; hairStyle: Hair; shirt: string; shirtDk: string; pants?: string }

export const SKIN = { light: '#f6cfa8', tan: '#e0a878', brown: '#a8693f', deep: '#6e4024' }

export const CAST: Record<string, Look> = {
  KEVIN: { skin: SKIN.tan, hair: '#1b1220', hairStyle: 'short', shirt: P.cyan, shirtDk: P.blue },
  ANA: { skin: SKIN.brown, hair: '#4a2412', hairStyle: 'long', shirt: P['hot-pink'], shirtDk: P['magenta-dk'] },
  BO: { skin: SKIN.light, hair: '#c8862a', hairStyle: 'cap', shirt: P['felt-lit'], shirtDk: P.felt },
  DEE: { skin: SKIN.deep, hair: '#140b10', hairStyle: 'curly', shirt: P.amethyst, shirtDk: P.violet },
  YOU: { skin: SKIN.light, hair: '#3a2416', hairStyle: 'spiky', shirt: P.gold, shirtDk: P.bronze },
  MAX: { skin: SKIN.tan, hair: '#5a3a1e', hairStyle: 'bun', shirt: P.orange, shirtDk: P.ember },
}

const HEAD = [
  '..oooooooo..',
  '.oHHHHHHHHo.',
  'oHHHHHHHHHHo',
  'oHssssssssHo',
  'osssssssssso',
  'osssssssssso',
  'osssssssssso',
  'osssssssssso',
  'osssssssssso',
  '.osssssssso.',
  '..oooooooo..',
]

const FACES: Record<Face, Record<number, string>> = {
  neutral: { 5: '..e....e..', 6: '..e....e..', 8: '....mm....' },
  happy: { 5: '..e....e..', 6: '..e....e..', 7: '.c......c.', 8: '..m....m..', 9: '...mmmm...' },
  sad: { 4: '.bb....bb.', 5: '..e....e..', 6: '..e....et.', 7: '.........t', 8: '...mmmm...', 9: '..m....m..' },
  sweat: { 4: '.........w', 5: '..e....e.w', 6: '..e....e..', 8: '..mmmmmm..', 9: '..m.m.m.m.' },
  smug: { 4: '.bbb..bbb.', 5: '..ee...ee.', 7: '.c......c.', 8: '......mm..', 9: '..mmmm....' },
  shock: { 4: '.b......b.', 5: '.ee....ee.', 6: '.ee....ee.', 8: '....mm....', 9: '....mm....' },
  money: { 4: '.gg....gg.', 5: '.gg....gg.', 6: '.gg....gg.', 7: '.c......c.', 8: '..m....m..', 9: '...mmmm...' },
  cool: { 5: '.KKKKKKKK.', 6: '..KK..KK..', 8: '..m....m..', 9: '...mmmm...' },
}

const HAIR: Record<Hair, Record<number, string>> = {
  short: { 3: 'oHHsssssHHHo' },
  long: { 3: 'oHHssssssHHo', 4: 'HHsssssssHHo', 5: 'Hsssssssssso', 6: 'Hsssssssssso', 7: 'HHssssssssHH', 8: 'HHssssssssHH', 9: 'HHossssssoHH', 10: '.HHooooooHH.' },
  cap: { 0: '..CCCCCCCC..', 1: '.CCCCCCCCCC.', 2: 'CCCCCCCCCCCC', 3: 'oDDDDDDDDDDDD' },
  bun: { 0: '....HHHH....', 1: '...HHHHHH...', 2: '.oHHHHHHHHo.', 3: 'oHHssssssHHo' },
  spiky: { 0: '.H.H.H.H.H..', 1: '.HHHHHHHHHH.', 2: 'oHHHHHHHHHHo', 3: 'oHsHsssHsHHo' },
  curly: { 0: '.HH.HHHH.HH.', 1: 'HHHHHHHHHHHH', 2: 'HHHHHHHHHHHH', 3: 'HHsssssssHHH', 4: 'Hssssssssssh', 5: 'Hsssssssssso' },
}

const BODY = [
  '...oSSSSo...',
  '.ooSSSSSSoo.',
  'oSSSSSSSSSSo',
  'oSDSSSSSSDSo',
  'osDSSSSSSDso',
  'osoSSSSSSoso',
  '.oopppppppo.',
  '..opp..ppo..',
  '..opp..ppo..',
  '..okk..kko..',
]

function headRows(face: Face, hair: Hair): string[] {
  const rows = [...HEAD]
  const h = HAIR[hair]
  for (const [j, r] of Object.entries(h)) rows[+j] = r.slice(0, 12).padEnd(12, '.')
  const f = FACES[face]
  for (const [j, r] of Object.entries(f)) {
    const row = [...rows[+j]]
    for (let i = 0; i < r.length; i++) if (r[i] !== '.') row[i + 1] = r[i]
    rows[+j] = row.join('')
  }
  return rows
}

function lookMap(look: Look): Record<string, string> {
  return {
    o: P.ink,
    H: look.hair,
    h: look.hair,
    s: look.skin,
    e: P.ink,
    m: '#5a1a22',
    c: '#ff9aa8',
    t: P.ice,
    w: P.ice,
    b: look.hair,
    g: P.mint,
    K: P.ink,
    C: look.shirt,
    D: look.shirtDk,
    S: look.shirt,
    p: '#2b2140',
    k: P.ink,
  }
}

export function person(art: Art, x: number, y: number, look: Look, face: Face, bust = false): void {
  const map = lookMap(look)
  art.grid(x, y, headRows(face, look.hairStyle), map)
  const body = bust ? BODY.slice(0, 4) : BODY
  art.grid(x, y + 11, body, map)
}

export const PERSON_W = 12
export const PERSON_H = 21
export const BUST_H = 15
