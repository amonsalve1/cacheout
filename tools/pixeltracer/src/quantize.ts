import type { Palette } from './palette.ts'
import type { Lab } from './oklab.ts'
import { paletteBytes } from './palette.ts'
import { labDist2, rgbToOklab } from './oklab.ts'

export type DitherKind = 'none' | 'bayer2' | 'bayer4' | 'bayer8'

export function bayerMatrix(size: number): number[][] {
  if (size === 1) return [[0]]
  const half = size / 2
  const prev = bayerMatrix(half)
  const quad = [
    [0, 2],
    [3, 1],
  ]
  const out: number[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      out[y][x] = 4 * prev[y % half][x % half] + quad[Math.floor(y / half)][Math.floor(x / half)]
    }
  }
  return out
}

function matrixFor(kind: DitherKind): number[][] | null {
  if (kind === 'none') return null
  const size = kind === 'bayer2' ? 2 : kind === 'bayer4' ? 4 : 8
  return bayerMatrix(size)
}

export type PreparedPalette = {
  bytes: Uint8Array
  labs: Lab[]
  count: number
}

export function preparePalette(p: Palette): PreparedPalette {
  const bytes = paletteBytes(p)
  const labs: Lab[] = []
  for (let i = 0; i < p.entries.length; i++) {
    labs.push(rgbToOklab(bytes[i * 3] / 255, bytes[i * 3 + 1] / 255, bytes[i * 3 + 2] / 255))
  }
  return { bytes, labs, count: p.entries.length }
}

export function nearestTwo(pal: PreparedPalette, lab: Lab): [number, number, number] {
  let i0 = 0
  let i1 = 0
  let d0 = Infinity
  let d1 = Infinity
  for (let i = 0; i < pal.count; i++) {
    const d = labDist2(lab, pal.labs[i])
    if (d < d0) {
      d1 = d0
      i1 = i0
      d0 = d
      i0 = i
    } else if (d < d1) {
      d1 = d
      i1 = i
    }
  }
  return [i0, i1, d0]
}

export type QuantizeOpts = {
  palette: Palette
  dither?: DitherKind

  strength?: number

  snapThreshold?: number
}

export function quantize(rgba: Uint8Array, w: number, h: number, opts: QuantizeOpts): Uint8Array {
  const pal = preparePalette(opts.palette)
  const matrix = matrixFor(opts.dither ?? 'none')
  const strength = opts.strength ?? 1
  const snap2 = (opts.snapThreshold ?? 0.02) ** 2
  const n = matrix ? matrix.length : 0
  const denom = n * n
  const out = new Uint8Array(rgba.length)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const lab = rgbToOklab(rgba[i] / 255, rgba[i + 1] / 255, rgba[i + 2] / 255)
      const [i0, i1, d0] = nearestTwo(pal, lab)

      let pick = i0
      if (matrix && i0 !== i1 && d0 > snap2) {
        const c0 = pal.labs[i0]
        const c1 = pal.labs[i1]
        const dL = c1.L - c0.L
        const da = c1.a - c0.a
        const db = c1.b - c0.b
        const len2 = dL * dL + da * da + db * db
        if (len2 > 1e-9) {
          const t = ((lab.L - c0.L) * dL + (lab.a - c0.a) * da + (lab.b - c0.b) * db) / len2
          const ratio = Math.max(0, Math.min(1, t)) * strength
          const threshold = (matrix[y % n][x % n] + 0.5) / denom
          if (ratio > threshold) pick = i1
        }
      }

      out[i] = pal.bytes[pick * 3]
      out[i + 1] = pal.bytes[pick * 3 + 1]
      out[i + 2] = pal.bytes[pick * 3 + 2]
      out[i + 3] = rgba[i + 3]
    }
  }
  return out
}
