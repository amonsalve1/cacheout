#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CACHE_OUT } from './src/palette.ts'
import { defaultRenderOpts, renderRaw, pixelize } from './src/render.ts'
import { encodePng } from './src/png.ts'
import { chip } from './scenes/cacheout/chip.ts'
import { build as table } from './scenes/env/table.ts'
import type { Scene } from './src/scene.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(HERE, '..', '..', 'public')

type IconSpec = {
  file: string

  width: number
  height: number
  upscale: number
  transparent: boolean
  scene: (aspect: number) => Scene
}

const ICONS: IconSpec[] = [
  {
    file: 'favicon-32.png',
    width: 32,
    height: 32,
    upscale: 1,
    transparent: true,
    scene: (a) => chip('red', 0.6, a),
  },
  {
    file: 'favicon-192.png',
    width: 48,
    height: 48,
    upscale: 4,
    transparent: true,
    scene: (a) => chip('red', 0.6, a),
  },

  {
    file: 'apple-touch-icon.png',
    width: 45,
    height: 45,
    upscale: 4,
    transparent: false,
    scene: (a) => chip('red', 0.6, a),
  },

  {
    file: 'og.png',
    width: 240,
    height: 126,
    upscale: 5,
    transparent: false,
    scene: (a) => table(a, 0.15),
  },
]

function main(): void {
  mkdirSync(PUBLIC, { recursive: true })
  const t0 = Date.now()

  for (const spec of ICONS) {
    const opts = {
      ...defaultRenderOpts(CACHE_OUT),
      width: spec.width,
      height: spec.height,
      upscale: spec.upscale,
      transparentBackground: spec.transparent,
    }
    const image = pixelize(renderRaw(spec.scene(spec.width / spec.height), opts), opts)
    writeFileSync(join(PUBLIC, spec.file), encodePng(image.data, image.width, image.height))
    console.log(`  ${spec.file.padEnd(22)} ${image.width}x${image.height}`)
  }

  console.log(`\nrendered ${ICONS.length} icons into public/ in ${Date.now() - t0}ms`)
}

main()
