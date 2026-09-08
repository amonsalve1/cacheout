#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng } from './src/png.ts'
import { CACHE_OUT, hexToRgb } from './src/palette.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'out', 'pixel_art_render.png')
const LOW = 128
const UPSCALE = 8

let failures = 0
let checks = 0

function check(label: string, ok: boolean, detail = ''): void {
  checks++
  if (ok) {
    console.log(`  \x1b[32mPASS\x1b[0m ${label}${detail ? `  ${detail}` : ''}`)
  } else {
    failures++
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? `  ${detail}` : ''}`)
  }
}

console.log('\npixeltracer verification\n')

console.log('environment')
const major = Number(process.versions.node.split('.')[0])
check('node >= 22 (native TypeScript execution)', major >= 22, `found v${process.versions.node}`)
const pkgDeps = (() => {
  const p = join(HERE, '..', '..', 'package.json')
  if (!existsSync(p)) return {}
  const j = JSON.parse(readFileSync(p, 'utf8'))
  return { ...j.dependencies, ...j.devDependencies }
})()
const sourceFiles = execFileSync('find', [join(HERE, 'src'), join(HERE, 'scenes'), '-name', '*.ts'])
  .toString()
  .trim()
  .split('\n')
const badImports: string[] = []
for (const f of sourceFiles) {
  for (const m of readFileSync(f, 'utf8').matchAll(/from\s+'([^']+)'/g)) {
    const spec = m[1]
    if (!spec.startsWith('.') && !spec.startsWith('node:')) badImports.push(`${f}: ${spec}`)
  }
}
check(
  'renderer imports nothing outside node: and relative paths',
  badImports.length === 0,
  badImports.length ? badImports.join(', ') : `${sourceFiles.length} files scanned`,
)
check(
  'no third-party package needed to run',
  !Object.keys(pkgDeps).some((d) => d === 'canvas' || d === 'sharp' || d === 'pngjs'),
)

console.log('\nrender')
const t0 = Date.now()
execFileSync(process.execPath, [join(HERE, 'cli.ts'), '--out', OUT], { stdio: 'pipe' })
const renderMs = Date.now() - t0
check('cli exits cleanly', true, `${renderMs}ms`)
check('output file exists', existsSync(OUT))
const size = existsSync(OUT) ? statSync(OUT).size : 0
check('output file is non-empty', size > 0, `${(size / 1024).toFixed(1)} KiB`)

console.log('\nimage')
const png = decodePng(readFileSync(OUT))
check(
  'dimensions are lowRes x upscale',
  png.width === LOW * UPSCALE && png.height === LOW * UPSCALE,
  `${png.width}x${png.height}`,
)

const palette = new Set(CACHE_OUT.entries.map((e) => hexToRgb(e.hex).join(',')))
const used = new Set<string>()
let outside = 0
for (let i = 0; i < png.data.length; i += 4) {
  const key = `${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`
  used.add(key)
  if (!palette.has(key)) outside++
}
check(
  'every pixel is a declared palette colour',
  outside === 0,
  outside === 0
    ? `${used.size}/${CACHE_OUT.entries.length} entries used`
    : `${outside} stray pixels`,
)

check(
  'frame is not uniform (catches an all-black render)',
  used.size > 4,
  `${used.size} distinct colours`,
)

const half = (png.height / 2) | 0
const lumaOf = (y0: number, y1: number): number => {
  let s = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < png.width; x += 4) {
      const i = (y * png.width + x) * 4
      s += png.data[i] * 0.3 + png.data[i + 1] * 0.6 + png.data[i + 2] * 0.1
      n++
    }
  }
  return s / n
}
check(
  'geometry is present (top and bottom differ)',
  Math.abs(lumaOf(0, half) - lumaOf(half, png.height)) > 4,
  `top ${lumaOf(0, half).toFixed(1)} vs bottom ${lumaOf(half, png.height).toFixed(1)}`,
)

let impure = 0
for (let by = 0; by < LOW && impure === 0; by++) {
  for (let bx = 0; bx < LOW; bx++) {
    const base = (by * UPSCALE * png.width + bx * UPSCALE) * 4
    for (let dy = 0; dy < UPSCALE; dy++) {
      for (let dx = 0; dx < UPSCALE; dx++) {
        const i = ((by * UPSCALE + dy) * png.width + bx * UPSCALE + dx) * 4
        if (
          png.data[i] !== png.data[base] ||
          png.data[i + 1] !== png.data[base + 1] ||
          png.data[i + 2] !== png.data[base + 2]
        ) {
          impure++
          break
        }
      }
    }
  }
}
check(
  'upscale produced exact NxN blocks (no interpolation)',
  impure === 0,
  impure === 0 ? `${UPSCALE}x${UPSCALE}` : `${impure} smeared blocks`,
)

console.log('\ndeterminism')
const first = createHash('sha256').update(readFileSync(OUT)).digest('hex')
execFileSync(process.execPath, [join(HERE, 'cli.ts'), '--out', OUT], { stdio: 'pipe' })
const second = createHash('sha256').update(readFileSync(OUT)).digest('hex')
check('two renders are byte-identical', first === second, first.slice(0, 16))

console.log(
  `\n${failures === 0 ? '\x1b[32mall checks passed\x1b[0m' : `\x1b[31m${failures} failed\x1b[0m`}  (${checks - failures}/${checks})\n`,
)
process.exit(failures === 0 ? 0 : 1)
