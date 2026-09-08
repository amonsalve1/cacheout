#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Scene } from './src/scene.ts'
import { CACHE_OUT } from './src/palette.ts'
import { defaultRenderOpts, pixelize, renderRaw } from './src/render.ts'
import { encodePng } from './src/png.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

type Args = Record<string, string | boolean>

function parseArgs(argv: string[]): Args {
  const out: Args = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return out
}

const num = (a: Args, k: string, d: number): number => (a[k] === undefined ? d : Number(a[k]))
const str = (a: Args, k: string, d: string): string =>
  typeof a[k] === 'string' ? (a[k] as string) : d

type EnvModule = { build: (aspect: number, t: number) => Scene; CONCEPT?: string }

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    console.log(`sheet — render an animated environment to a grid sprite sheet

  --scene <path>    module exporting build(aspect, t)     (relative to tools/pixeltracer)
  --frames <n>      frames around the loop                (default: 48)
  --cols <n>        sheet columns                         (default: 8)
  --width <n>       frame width in pixels                 (default: 224)
  --height <n>      frame height in pixels                (default: 126)
  --out <path>      output PNG, relative to repo root     (default: src/assets/backdrops/<scene>.png)
  --alpha           keep transparency (for foreground plates)`)
    return
  }

  const scenePath = str(args, 'scene', 'scenes/env/floor.ts')
  const frames = Math.max(1, num(args, 'frames', 48))
  const cols = Math.max(1, num(args, 'cols', 8))
  const rows = Math.ceil(frames / cols)
  const width = num(args, 'width', 224)
  const height = num(args, 'height', 126)

  const name = basename(scenePath).replace(/\.ts$/, '')
  const outPath = resolve(HERE, '..', '..', str(args, 'out', `src/assets/backdrops/${name}.png`))

  const mod = (await import(pathToFileURL(resolve(HERE, scenePath)).href)) as EnvModule
  if (typeof mod.build !== 'function') throw new Error(`${scenePath} does not export build()`)

  const opts = {
    ...defaultRenderOpts(CACHE_OUT),
    width,
    height,

    upscale: 1,

    transparentBackground: Boolean(args.alpha),
  }

  const sheetW = width * cols
  const sheetH = height * rows
  const sheet = new Uint8Array(sheetW * sheetH * 4)
  const t0 = Date.now()

  for (let i = 0; i < frames; i++) {
    const t = i / frames
    const frame = pixelize(renderRaw(mod.build(width / height, t), opts), opts)
    const col = i % cols
    const row = Math.floor(i / cols)
    for (let y = 0; y < height; y++) {
      const src = y * width * 4
      const dst = ((row * height + y) * sheetW + col * width) * 4
      sheet.set(frame.data.subarray(src, src + width * 4), dst)
    }
    if ((i + 1) % 8 === 0 || i === frames - 1) {
      process.stdout.write(
        `\r  ${i + 1}/${frames} frames  ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      )
    }
  }
  process.stdout.write('\n')

  mkdirSync(dirname(outPath), { recursive: true })
  const png = encodePng(sheet, sheetW, sheetH)
  writeFileSync(outPath, png)

  const manifestPath = join(dirname(outPath), 'manifest.json')
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>)
    : {}
  manifest[name] = {
    file: basename(outPath),
    frames,
    cols,
    rows,
    frameWidth: width,
    frameHeight: height,
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(
    `  ${name}: ${frames} frames, ${cols}x${rows} grid, ${sheetW}x${sheetH}px, ` +
      `${(png.length / 1024).toFixed(0)} KiB, ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  )
  if (mod.CONCEPT) console.log(`  "${mod.CONCEPT}"`)
}

main().catch((err) => {
  console.error(`sheet: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
