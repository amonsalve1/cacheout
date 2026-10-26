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

