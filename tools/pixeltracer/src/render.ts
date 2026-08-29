import type { Scene } from './scene.ts'
import type { Palette } from './palette.ts'
import type { DitherKind } from './quantize.ts'
import { clamp01 } from './vec3.ts'
import { rayThrough } from './camera.ts'
import { hitScene, trace } from './trace.ts'
import { mulberry32 } from './rng.ts'
import { quantize } from './quantize.ts'
import { upscaleNearest } from './upscale.ts'

export type Image = { data: Uint8Array; width: number; height: number }

export type RenderOpts = {
  width: number
  height: number

  upscale: number
  palette: Palette
  dither: DitherKind
  ditherStrength: number

  ssaa: number

  snapThreshold?: number
  exposure: number

  gamma: number

  transparentBackground?: boolean
}

export const defaultRenderOpts = (palette: Palette): RenderOpts => ({
  width: 128,
  height: 128,
  upscale: 8,
  palette,
  dither: 'bayer4',

  ditherStrength: 0.55,
  ssaa: 1,
  snapThreshold: 0.07,
  exposure: 1,
  gamma: 1,
})

export function renderRaw(scene: Scene, opts: RenderOpts): Image {
  const { width: w, height: h, ssaa } = opts
  const data = new Uint8Array(w * h * 4)
  const rng = mulberry32(scene.seed)
  const n = Math.max(1, Math.floor(ssaa))
  const inv = 1 / (n * n)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0
      let g = 0
      let b = 0
      let hits = 0

      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const u = (x + (sx + 0.5) / n) / w
          const v = 1 - (y + (sy + 0.5) / n) / h
          const primary = rayThrough(scene.camera, u, v)

          if (opts.transparentBackground && !hitScene(scene, primary, 1e-4, Infinity)) {
            continue
          }
          hits++
          const c = trace(scene, primary, scene.maxDepth, rng)
          r += c.x
          g += c.y
          b += c.z
        }
      }

      const i = (y * w + x) * 4
      if (hits === 0) {
        data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0
        continue
      }

      const tone = (v: number): number => {
        const e = v * inv * opts.exposure
        const gm = opts.gamma === 1 ? e : Math.pow(Math.max(0, e), 1 / opts.gamma)
        return Math.round(clamp01(gm) * 255)
      }
      data[i] = tone(r)
      data[i + 1] = tone(g)
      data[i + 2] = tone(b)
      data[i + 3] = Math.round(hits * inv * 255)
    }
  }
  return { data, width: w, height: h }
}

export function pixelize(img: Image, opts: RenderOpts): Image {
  const q = quantize(img.data, img.width, img.height, {
    palette: opts.palette,
    dither: opts.dither,
    strength: opts.ditherStrength,
    snapThreshold: opts.snapThreshold,
  })
  const up = upscaleNearest(q, img.width, img.height, opts.upscale)
  return { data: up.data, width: up.width, height: up.height }
}

export function renderScene(scene: Scene, opts: RenderOpts): Image & { ms: number } {
  const t0 = process.hrtime.bigint()
  const raw = renderRaw(scene, opts)
  const out = pixelize(raw, opts)
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  return { ...out, ms }
}
