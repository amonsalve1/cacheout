#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodePng, decodePng } from '../pixeltracer/src/png.ts'
import { CACHE_OUT } from '../pixeltracer/src/palette.ts'
import { defaultRenderOpts, renderRaw, pixelize } from '../pixeltracer/src/render.ts'
import { cherry } from '../pixeltracer/scenes/cacheout/symbols.ts'
import { Art, CAST, P, bulbFrame, carpet, marquee, person, type Face, type Img } from './pixel.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const OUT = resolve(ROOT, 'docs', 'readme')
const K = 4
const LW = 250
const W = LW * K

const CREAM = '#fff1d6'
const SOFT = '#cbbfdd'
const MUTE = '#9c8cb8'

type FontKey = 'serif' | 'serifUp' | 'mono' | 'mono5' | 'sans' | 'pixel'
const FONT_FILES: Record<FontKey, [string, string]> = {
  serif: ['fraunces-italic.woff2', 'italic'],
  serifUp: ['fraunces.woff2', 'normal'],
  mono: ['dm-mono.woff2', 'normal'],
  mono5: ['dm-mono-500.woff2', 'normal'],
  sans: ['chivo.woff2', 'normal'],
  pixel: ['press-start.woff2', 'normal'],
}

class Svg {
  parts: string[] = []
  used = new Set<FontKey>()

  text(
    lx: number,
    ly: number,
    s: string,
    o: { size?: number; fill?: string; font?: FontKey; weight?: number; anchor?: 'start' | 'middle' | 'end'; track?: number } = {},
  ): this {
    const { size = 14, fill = SOFT, font = 'sans', weight = 400, anchor = 'start', track = 0 } = o
    this.used.add(font)
    this.parts.push(
      `<text x="${lx * K}" y="${ly * K}" font-family="r-${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${track ? ` letter-spacing="${track}"` : ''}>${esc(s)}</text>`,
    )
    return this
  }

  rich(lx: number, ly: number, spans: [string, string][], o: { size: number; font: FontKey; weight?: number; anchor?: string }): this {
    this.used.add(o.font)
    const t = spans.map(([s, c]) => `<tspan fill="${c}">${esc(s)}</tspan>`).join('')
    this.parts.push(
      `<text x="${lx * K}" y="${ly * K}" font-family="r-${o.font}" font-size="${o.size}" font-weight="${o.weight ?? 400}" text-anchor="${o.anchor ?? 'start'}">${t}</text>`,
    )
    return this
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function fontCss(used: Set<FontKey>): string {
  return [...used]
    .map((k) => {
      const [file, style] = FONT_FILES[k]
      const b64 = readFileSync(resolve(HERE, 'fonts', file)).toString('base64')
      return `@font-face{font-family:"r-${k}";font-style:${style};font-weight:100 900;src:url(data:font/woff2;base64,${b64}) format("woff2")}`
    })
    .join('')
}

function save(name: string, art: Art, svg: Svg, alt: string): void {
  const img = art.image(K)
  const png = encodePng(img.data, img.width, img.height).toString('base64')
  const H = art.h * K
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(alt)}">`,
    `<title>${esc(alt)}</title>`,
    `<style>${fontCss(svg.used)}</style>`,
    `<defs><clipPath id="c"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs>`,
    `<g clip-path="url(#c)">`,
    `<image width="${W}" height="${H}" href="data:image/png;base64,${png}"/>`,
    ...svg.parts,
    `</g>`,
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="none" stroke="${P.dusk}" stroke-width="2"/>`,
    `</svg>`,
  ].join('\n')
  writeFileSync(resolve(OUT, `${name}.svg`), out + '\n')
  console.log(`  ${name}.svg ${(out.length / 1024).toFixed(0)} KB`)
}

function header(art: Art, svg: Svg, title: [string, string][], kicker: string): void {
  carpet(art)
  marquee(art, 0)
  svg.rich(14, 23, title, { size: 46, font: 'serif', weight: 560 })
  svg.text(14.5, 30.5, kicker, { font: 'mono5', size: 13, fill: MUTE, track: 3 })
}

function nativeSprite(name: string): Img {
  const raw = decodePng(readFileSync(resolve(ROOT, 'src/assets/sprites', `${name}.png`)))
  const k = 8
  const w = raw.width / k
  const h = raw.height / k
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out.set(raw.data.subarray(((y * k + 3) * raw.width + x * k + 3) * 4, ((y * k + 3) * raw.width + x * k + 3) * 4 + 4), (y * w + x) * 4)
  return { data: out, width: w, height: h }
}

function dealerBot(art: Art, x: number, y: number): void {
  art.grid(x, y, [
    '.......y........',
    '.......o........',
    '...oooooooooo...',
    '..oPPPPPPPPPPo..',
    '..oPkkkkkkkkPo..',
    '..oPkCCkkCCkPo..',
    '..oPkkkkkkkkPo..',
    '..oPPPPmmPPPPo..',
    '..oLPPPPPPPPLo..',
    '...oooooooooo...',
    '.....oRRRRo.....',
    '..ooWWRrrRWWoo..',
    '.oVVVWWRRWWVVVo.',
    '.oVVVVWggWVVVVo.',
    'oVVoVVWggWVVoVVo',
    'oVVoVVVWWVVVoVVo',
    'oPPoVVVVVVVVoPPo',
  ], {
    y: P.gold,
    o: P.ink,
    P: P['pink-lt'],
    L: P['hot-pink'],
    k: '#160c22',
    C: P.ice,
    m: P.mauve,
    R: P['chip-red'],
    r: P['chip-red-dk'],
    W: P.white,
    V: P.violet,
    g: P.gold,
  })
}

function miniChip(art: Art, x: number, y: number, face = P['chip-red'], edge = P.white): void {
  art.ellipse(x, y + 1, 3, 2, P['chip-red-dk'])
  art.ellipse(x, y, 3, 2, face)
  art.px(x - 2, y, edge)
  art.px(x + 2, y, edge)
  art.px(x, y - 1, edge)
}

function stack(art: Art, x: number, y: number, n: number, face: string, dk: string): void {
  for (let i = 0; i < n; i++) {
    const yy = y - i * 3
    art.rect(x - 4, yy, 9, 3, P.void)
    art.rect(x - 4, yy, 9, 2, face)
    art.hline(x - 4, yy + 2, 9, dk)
    art.px(x - 2, yy, P.white)
    art.px(x + 2, yy, P.white)
    art.px(x - 2, yy + 1, P.white)
    art.px(x + 2, yy + 1, P.white)
  }
  const top = y - n * 3
  art.rect(x - 3, top + 1, 7, 2, face)
  art.hline(x - 4, top + 2, 9, face)
  art.px(x, top + 1, P.white)
}

function felt(art: Art, y0: number, y1: number): void {
  art.rect(0, y0, art.w, 2, P.gold)
  art.rect(0, y0 + 2, art.w, 2, P.bronze)
  art.rect(0, y0 + 4, art.w, y1 - y0 - 4, P.felt)
  art.dither(0, y0 + 4, art.w, y1 - y0 - 4, P['felt-deep'], (_i, j) => j / (y1 - y0) * 0.9)
  art.dither(0, y0 + 4, art.w, 6, P['felt-lit'], (_i, j) => 0.35 - j * 0.06)
}

function plate(art: Art, svg: Svg, cx: number, y: number, name: string, color: string): void {
  const w = name.length * 3 + 10
  art.box(cx - w / 2, y, w, 9, { face: P.ink, edge: P.void, hi: color, shadow: false })
  svg.text(cx, y + 6.6, name, { font: 'mono5', size: 12, fill: CREAM, anchor: 'middle', track: 1 })
}

