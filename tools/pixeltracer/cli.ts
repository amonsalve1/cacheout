#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { ShadeMode } from './src/scene.ts'
import type { DitherKind } from './src/quantize.ts'
import { resolvePalette } from './src/palette.ts'
import { defaultRenderOpts, renderRaw, renderScene } from './src/render.ts'
import { encodePng } from './src/png.ts'

type Args = Record<string, string | boolean>

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
    } else {
      out[key] = next
      i++
    }
  }
  return out
}

const num = (a: Args, k: string, d: number): number => {
  if (a[k] === undefined) return d
  const n = Number(a[k])
  if (!Number.isFinite(n)) throw new Error(`--${k} must be a number, got "${a[k]}"`)
  return n
}
const str = (a: Args, k: string, d: string): string =>
  typeof a[k] === 'string' ? (a[k] as string) : d

const SCENES: Record<
  string,
  () => Promise<{ build: (aspect: number) => import('./src/scene.ts').Scene }>
> = {
  demo: () => import('./scenes/demo.ts'),
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    console.log(`pixeltracer — a CPU ray tracer that outputs retro pixel art

  --scene <name>       ${Object.keys(SCENES).join(' | ')}          (default: demo)
  --width  <n>         low-res render width                        (default: 128)
  --height <n>         low-res render height                       (default: 128)
  --upscale <n>        integer nearest-neighbour factor            (default: 8)
  --palette <name>     cacheout | pico8                            (default: cacheout)
  --dither <kind>      none | bayer2 | bayer4 | bayer8             (default: bayer4)
  --dither-strength    0..1                                        (default: 0.55)
  --snap <n>           OKLab radius that snaps without dithering    (default: 0.07)
  --mode <shade>       cel | dither | hybrid                       (default: hybrid)
  --bands <n>          cel band count                              (default: 4)
  --ssaa <n>           samples per axis; >1 softens edges          (default: 1)
  --exposure <n>                                                   (default: 1)
  --gamma <n>                                                      (default: 1)
  --seed <n>           PRNG seed; renders are reproducible
  --raw                skip quantise/dither/upscale (debug the shading alone)
  --out <path>         output PNG                                  (default: out/pixel_art_render.png)`)
    return
  }

  const sceneName = str(args, 'scene', 'demo')
  const loader = SCENES[sceneName]
  if (!loader)
    throw new Error(`unknown scene "${sceneName}" (have: ${Object.keys(SCENES).join(', ')})`)

  const palette = resolvePalette(str(args, 'palette', 'cacheout'))
  const width = num(args, 'width', 128)
  const height = num(args, 'height', 128)

  const opts = {
    ...defaultRenderOpts(palette),
    width,
    height,
    upscale: num(args, 'upscale', 8),
    dither: str(args, 'dither', 'bayer4') as DitherKind,
    ditherStrength: num(args, 'dither-strength', 0.55),
    snapThreshold: num(args, 'snap', 0.07),
    ssaa: num(args, 'ssaa', 1),
    exposure: num(args, 'exposure', 1),
    gamma: num(args, 'gamma', 1),
  }

  const mod = await loader()
  const scene = mod.build(width / height)
  scene.shadeMode = str(args, 'mode', scene.shadeMode) as ShadeMode
  scene.celBands = num(args, 'bands', scene.celBands)
  scene.seed = num(args, 'seed', scene.seed)

  const outPath = resolve(
    process.cwd(),
    str(args, 'out', 'tools/pixeltracer/out/pixel_art_render.png'),
  )
  mkdirSync(dirname(outPath), { recursive: true })

  const img = args.raw ? { ...renderRaw(scene, opts), ms: 0 } : renderScene(scene, opts)
  writeFileSync(outPath, encodePng(img.data, img.width, img.height))

  console.log(
    `rendered ${sceneName}  ${width}x${height} -> ${img.width}x${img.height}  ` +
      `(${opts.upscale}x)  palette=${palette.name}/${palette.entries.length}  ` +
      `mode=${scene.shadeMode} bands=${scene.celBands} dither=${opts.dither}  ` +
      `${img.ms.toFixed(0)}ms`,
  )
  console.log(`wrote ${outPath}`)
}

main().catch((err) => {
  console.error(`pixeltracer: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
