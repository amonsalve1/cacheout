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

async function banner(): Promise<void> {
  const art = new Art(LW, 92)
  const svg = new Svg()
  art.rect(0, 0, LW, 92, P.ink)
  art.dither(0, 0, LW, 70, P.velvet, (_i, j) => j / 70)
  for (const [x, c] of [[8, P['hot-pink']], [14, P.cyan], [LW - 10, P.cyan], [LW - 16, P['hot-pink']]] as [number, string][]) {
    art.rect(x - 2, 8, 5, 60, c, 0.18)
    art.rect(x, 8, 1, 60, c)
    art.rect(x - 1, 8, 3, 1, c)
  }
  marquee(art, 0)
  art.box(38, 13, 174, 38, { face: P.ink, edge: P.void, hi: P.velvet })
  art.rect(40, 15, 170, 34, '#170c24')
  bulbFrame(art, 38, 13, 174, 38)
  svg.text(LW / 2 + 1.2, 33.2, 'CACHE OUT', { font: 'pixel', size: 42, fill: P['bronze-dk'], anchor: 'middle' })
  svg.text(LW / 2, 32, 'CACHE OUT', { font: 'pixel', size: 42, fill: P.gold, anchor: 'middle' })
  svg.text(LW / 2, 43.5, 'a y2k casino that makes your friends do leetcode every day', {
    font: 'serif',
    size: 21,
    fill: CREAM,
    anchor: 'middle',
  })
  const seats: [string, Face, number][] = [
    ['KEVIN', 'happy', 34],
    ['ANA', 'money', 62],
    ['YOU', 'smug', 90],
    ['BO', 'sad', 154],
    ['DEE', 'sweat', 182],
    ['MAX', 'shock', 210],
  ]
  for (const [n, f, x] of seats) person(art, x - 6, 55, CAST[n], f)
  dealerBot(art, 117, 55)
  felt(art, 72, 92)
  stack(art, 30, 82, 4, P['chip-red'], P['chip-red-dk'])
  stack(art, 40, 84, 2, P.cyan, P.blue)
  stack(art, 214, 82, 5, P.gold, P.bronze)
  stack(art, 204, 85, 2, P.amethyst, P.violet)
  for (const [x, y] of [[110, 80], [118, 81], [126, 80], [134, 81]]) {
    art.rect(x, y, 6, 8, P.void)
    art.rect(x, y - 1, 6, 8, P.white)
    art.px(x + 1, y, P['chip-red'])
  }
  save('banner', art, svg, 'CACHE OUT: a y2k casino that makes your friends do leetcode every day')
}

async function oneRule(): Promise<void> {
  const art = new Art(LW, 122)
  const svg = new Svg()
  header(art, svg, [['one ', CREAM], ['rule', P.gold], ['.', CREAM]], 'SOLVE ONE A DAY, OR PAY EVERYONE WHO DID')

  art.rect(0, 96, LW, 26, P.ink)
  art.dither(0, 96, LW, 6, P.velvet, (_i, j) => 1 - j / 6)
  art.ellipse(36, 95, 12, 2, '#1a1028')
  person(art, 30, 74, CAST.BO, 'sad')
  plate(art, svg, 36, 100, 'BO', P['chip-red'])

  art.box(140, 92, 104, 6, { face: P.felt, edge: P.void, hi: P['felt-lit'], lo: P['felt-deep'], shadow: false })
  const winners: [string, number][] = [['KEVIN', 152], ['ANA', 177], ['DEE', 202], ['YOU', 227]]
  winners.forEach(([n, cx], i) => {
    person(art, cx - 6, 71, CAST[n], i === 3 ? 'cool' : 'happy')
    plate(art, svg, cx, 100, n, P.mint)
    const x0 = 44
    const y0 = 82
    const y1 = 66
    const lift = 20 + i * 7
    const pts: [number, number][] = []
    for (let k = 0; k <= 60; k++) {
      const t = k / 60
      pts.push([x0 + (cx - x0) * t, y0 + (y1 - y0) * t - lift * 4 * t * (1 - t)])
    }
    art.dots(pts, i % 2 ? P['gold-lt'] : P.gold, 4)
    const apex = pts[36]
    miniChip(art, Math.round(apex[0]), Math.round(apex[1]))
    art.arrow(cx, y1, P.gold, 'd')
    svg.text(cx, 61, '+$1', { font: 'mono5', size: 13, fill: P['gold-lt'], anchor: 'middle' })
  })

  svg.text(14, 112.5, 'bo missed, so bo owes', { font: 'sans', size: 15, fill: SOFT })
  svg.rich(14 + 41, 112.5, [['$1 × 4 = $4', P['chip-red-lt']]], { size: 17, font: 'mono5' })
  svg.text(236, 112.5, 'clear your day and you owe nothing', { font: 'sans', size: 15, fill: SOFT, anchor: 'end' })
  save('one-rule', art, svg, 'Bo missed the day, so Bo pays $1 to each of the four players who cleared: $4')
}

function bell(art: Art, x: number, y: number): void {
  art.grid(x, y, ['...gg...', '..gGGg..', '.gGGGGg.', '.gGGGGg.', '.gGGGGg.', 'gGGGGGGg', 'gggggggg', '...bb...'], {
    g: P.bronze,
    G: P.gold,
    b: P['gold-lt'],
  })
}

async function day(): Promise<void> {
  const art = new Art(LW, 132)
  const svg = new Svg()
  header(art, svg, [['a day at ', CREAM], ['the table', P.gold], ['.', CREAM]], "EVERY TABLE RUNS ON ITS OWN TIMEZONE")
  const x0 = 18
  const x1 = 232
  const ty = 84
  const at = (h: number) => Math.round(x0 + ((x1 - x0) * h) / 24)
  art.rect(x0 - 2, ty, x1 - x0 + 4, 3, P.bronze)
  art.hline(x0 - 2, ty, x1 - x0 + 4, P.gold)
  art.rect(at(21), ty, at(24) - at(21) + 2, 3, P['chip-red'])
  art.hline(at(21), ty, at(24) - at(21) + 2, P['chip-red-lt'])
  for (let h = 0; h <= 24; h += 3) {
    art.rect(at(h), ty + 3, 1, h % 6 === 0 ? 3 : 2, P.bronze)
    if (h % 6 === 0) svg.text(at(h) + 0.5, ty + 12, ['12a', '6a', '12p', '6p', '12a'][h / 6], { font: 'mono', size: 12, fill: MUTE, anchor: 'middle' })
  }
  const events: [number, string, Face, string, string][] = [
    [9.2, 'KEVIN', 'happy', '9:14a', 'solved'],
    [13, 'ANA', 'happy', '1:02p', 'solved'],
    [16.5, 'DEE', 'cool', '4:30p', 'solved'],
  ]
  for (const [h, n, f, t] of events) {
    const x = at(h)
    person(art, x - 6, 50, CAST[n], f, true)
    art.dots([[x, 66], [x, ty - 1]], P.mint, 2)
    art.rect(x - 1, ty - 1, 3, 3, P.mint)
    svg.text(x, 47, t, { font: 'mono5', size: 12, fill: P.mint, anchor: 'middle' })
  }
  const bx = at(21)
  bell(art, bx - 4, 56)
  art.dots([[bx, 65], [bx, ty - 1]], P['gold-lt'], 2)
  svg.text(bx, 51, '~9p', { font: 'mono5', size: 12, fill: P['gold-lt'], anchor: 'middle' })
  const yx = at(22.8)
  person(art, yx - 6, 50, CAST.YOU, 'sweat', true)
  svg.text(yx - 2, 47, '10:51p', { font: 'mono5', size: 12, fill: P.mint, anchor: 'middle' })
  art.dots([[yx, 66], [yx, ty - 1]], P.mint, 2)
  const ex = at(24)
  person(art, ex - 6, ty + 16, CAST.BO, 'sad', true)

  svg.text(x0, ty + 22, 'tap check after solving. the server', { font: 'sans', size: 14, fill: SOFT })
  svg.text(x0, ty + 27, 'verifies each one against leetcode.', { font: 'sans', size: 14, fill: SOFT })
  svg.text(x0, ty + 36, 'proofs stay face down until you post yours.', { font: 'sans', size: 14, fill: MUTE })
  svg.text(118, ty + 22, '~9p discord: "3h left. bo, you."', { font: 'mono', size: 13, fill: P['gold-lt'] })
  svg.text(118, ty + 28, '12a table closes. bo is still out.', { font: 'mono', size: 13, fill: P['chip-red-lt'] })
  svg.text(118, ty + 34, ':07 pg_cron runs the sweep, bo pays.', { font: 'mono', size: 13, fill: SOFT })
  save('a-day', art, svg, 'A day at the table: players solve through the day, a Discord warning around 9pm, the table closes at midnight and the sweep settles it')
}

function phone(art: Art, x: number, y: number): void {
  art.box(x, y, 22, 38, { face: P.velvet, edge: P.void, hi: P.mauve, lo: P.ink })
  art.rect(x + 3, y + 4, 16, 27, P.ink)
  art.rect(x + 5, y + 7, 12, 2, P.chrome)
  art.rect(x + 5, y + 11, 8, 1, P['chrome-dim'])
  art.rect(x + 5, y + 14, 12, 4, P['felt-deep'])
  art.rect(x + 5, y + 24, 12, 5, P.bronze)
  art.rect(x + 5, y + 23, 12, 5, P.gold)
  art.rect(x + 9, y + 33, 4, 2, P.mauve)
}

function rack(art: Art, x: number, y: number, w: number, h: number, led = P.mint): void {
  art.box(x, y, w, h, { face: P.velvet, edge: P.void, hi: P.mauve, lo: P.ink })
  for (let j = y + 4; j < y + h - 4; j += 7) {
    art.rect(x + 3, j, w - 6, 5, P.ink)
    art.hline(x + 3, j, w - 6, P.dusk)
    art.rect(x + 5, j + 2, 2, 1, led)
    art.rect(x + 9, j + 2, 2, 1, P.cyan)
    for (let i = x + 15; i < x + w - 5; i += 3) art.px(i, j + 2, P.mauve)
  }
}

function cylinder(art: Art, x: number, y: number, w: number, h: number): void {
  const rx = Math.floor(w / 2)
  const cx = x + rx
  art.rect(x, y + 3, w, h - 6, P.blue)
  art.rect(x, y + 3, 3, h - 6, P.cyan)
  art.rect(x + w - 4, y + 3, 3, h - 6, P.navy)
  art.ellipse(cx, y + h - 3, rx, 3, P.blue)
  for (const yy of [y + 13, y + 23]) {
    art.ellipse(cx, yy, rx, 3, P.navy)
    art.ellipse(cx, yy - 1, rx, 3, P.blue)
  }
  art.ellipse(cx, y + 3, rx, 3, P.ice)
  art.ellipse(cx, y + 3, rx - 2, 2, P.cyan)
}

function lcBox(art: Art, x: number, y: number, w: number, h: number): void {
  art.box(x, y, w, h, { face: '#1a1220', edge: P.void, hi: P.dusk })
  art.rect(x + 1, y + 1, w - 2, 5, P.orange)
  art.rect(x + 3, y + 3, 1, 1, P.ink)
  art.rect(x + 5, y + 3, 1, 1, P.ink)
  art.grid(x + w / 2 - 6, y + 11, [
    '...o......o.',
    '..oo...y..oo',
    '.oo...y....oo',
    'oo...y......oo',
    '.oo.y......oo',
    '..ooy.....oo',
    '...o......o.',
  ], { o: P.orange, y: P.chrome })
  art.rect(x + 4, y + h - 8, w - 8, 1, P.dusk)
  art.rect(x + 4, y + h - 5, w - 14, 1, P.dusk)
}

function step(art: Art, svg: Svg, x: number, y: number, n: number): void {
  art.disc(x, y, 4, P.void)
  art.disc(x, y - 0.5, 4, P.gold)
  svg.text(x, y + 1.6, String(n), { font: 'mono5', size: 13, fill: P.ink, anchor: 'middle' })
}

function lock(art: Art, x: number, y: number, c = P.gold): void {
  art.grid(x, y, ['.ooo.', 'o...o', 'o...o', 'GGGGG', 'GGkGG', 'GGkGG', 'GGGGG'], { o: P['chrome-dim'], G: c, k: P.ink })
}

async function verify(): Promise<void> {
  const art = new Art(LW, 166)
  const svg = new Svg()
  header(art, svg, [['it checks ', CREAM], ['for you', P.ice], ['.', CREAM]], 'ACCEPTED SUBMISSIONS, CHECKED ON THE SERVER')

  const y = 42
  phone(art, 16, y)
  rack(art, 72, y, 40, 38)
  lcBox(art, 136, y, 40, 38)
  cylinder(art, 202, y + 1, 30, 36)

  const mid = y + 19
  art.dots([[42, mid], [66, mid]], P['chrome-dim'], 2)
  art.arrow(68, mid, P['chrome-dim'])
  art.dots([[116, mid - 6], [130, mid - 6]], P['chrome-dim'], 2)
  art.arrow(132, mid - 6, P['chrome-dim'])
  art.dots([[134, mid + 6], [118, mid + 6]], P['chrome-dim'], 2)
  art.arrow(116, mid + 6, P['chrome-dim'], 'l')
  art.dots([[114, y + 42], [114, y + 46], [216, y + 46], [216, y + 42]], P.mint, 2)
  art.arrow(216, y + 40, P.mint, 'u')
  step(art, svg, 54, mid - 7, 1)
  step(art, svg, 92, y - 6, 2)
  step(art, svg, 124, mid - 13, 3)
  step(art, svg, 166, y + 46, 4)

  const lab = (cx: number, a: string, b: string) => {
    svg.text(cx, y + 54, a, { font: 'sans', size: 15, weight: 700, fill: CREAM, anchor: 'middle' })
    svg.text(cx, y + 59, b, { font: 'mono', size: 12, fill: MUTE, anchor: 'middle' })
  }
  lab(27, 'your browser', 'react · supabase-js')
  lab(92, 'edge function', 'deno · checks your jwt')
  lab(156, 'leetcode.com', 'public graphql')
  lab(217, 'postgres', 'antes table')

  const cy = 108
  art.box(12, cy, 226, 44, { face: '#120a1c', edge: P.void, hi: P.dusk })
  art.rect(13, cy + 1, 224, 6, P.velvet)
  for (const [i, c] of [[0, P['chip-red']], [1, P.gold], [2, P.mint]] as [number, string][]) art.rect(17 + i * 5, cy + 3, 2, 2, c)
  svg.text(232, cy + 5.6, 'supabase/functions/leetcode', { font: 'mono', size: 11, fill: MUTE, anchor: 'end' })
  const lines: [string, string, string][] = [
    ['1', 'POST /functions/v1/leetcode', "{ op: 'ante' }  with your session jwt"],
    ['2', 'select leetcode_username', 'from profiles where id = auth.uid()'],
    ['3', 'recentAcSubmissionList(u, limit: 20)', '{ titleSlug timestamp }'],
    ['4', "inside the table's local day?", "upsert into antes ... status 'verified'"],
  ]
  lines.forEach(([n, a, b], i) => {
    const ly = cy + 15 + i * 8
    svg.text(18, ly, n, { font: 'mono5', size: 13, fill: P.gold })
    svg.text(25, ly, a, { font: 'mono5', size: 13, fill: P.ice })
    svg.text(128, ly, b, { font: 'mono', size: 13, fill: SOFT })
  })
  lock(art, 13, 156)
  svg.text(21, 161.6, 'the handle comes from your profile row, never the request. only the service role writes antes.', { font: 'sans', size: 12.5, fill: MUTE })
  save('it-checks', art, svg, 'Verification: the browser calls the leetcode edge function, which reads your handle, asks LeetCode for accepted submissions, and writes a verified ante')
}

function clock(art: Art, cx: number, cy: number): void {
  art.disc(cx, cy, 12, P.void)
  art.disc(cx, cy - 1, 12, P.bronze)
  art.disc(cx, cy - 1, 10, P.chrome)
  art.disc(cx, cy - 1, 9, P.white)
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2
    art.px(cx + Math.round(Math.sin(a) * 7.5), cy - 1 - Math.round(Math.cos(a) * 7.5), k % 3 === 0 ? P.ink : P['chrome-dim'])
  }
  art.dots([[cx, cy - 1], [cx, cy - 7]], P.ink, 1)
  art.dots([[cx, cy - 1], [cx + 3, cy + 2]], P['chip-red'], 1)
  art.rect(cx - 1, cy - 2, 2, 2, P.ink)
}

function ledger(art: Art, x: number, y: number): void {
  art.box(x, y, 30, 36, { face: P['chip-red-dk'], edge: P.void, hi: P['chip-red'], lo: P.blood })
  art.rect(x + 4, y + 3, 24, 30, '#f3e6c8')
  art.rect(x + 4, y + 3, 1, 30, '#d4c39e')
  for (let j = y + 7; j < y + 31; j += 4) {
    art.rect(x + 7, j, 12, 1, '#a8987a')
    art.rect(x + 21, j, 5, 1, P['chip-red'])
  }
}

function tzCard(art: Art, svg: Svg, x: number, y: number, tz: string, state: string, ok: boolean): void {
  art.box(x, y, 66, 13, { face: P.ink, edge: P.void, hi: ok ? P.mint : P.gold, shadow: true })
  svg.text(x + 4, y + 8.2, tz, { font: 'mono', size: 12, fill: CREAM })
  svg.text(x + 62, y + 8.2, state, { font: 'mono5', size: 12, fill: ok ? P.mint : P['gold-lt'], anchor: 'end' })
}

function file(art: Art, x: number, y: number, c: string): void {
  art.grid(x, y, ['oooooo..', 'oWWWWoo.', 'oWWWWoWo', 'oWWWWWWo', 'oWccWWWo', 'oWWWWWWo', 'oWcccWWo', 'oWWWWWWo', 'oWccWWWo', 'oooooooo'], {
    o: P.void,
    W: P.chrome,
    c,
  })
}

async function sweep(): Promise<void> {
  const art = new Art(LW, 140)
  const svg = new Svg()
  header(art, svg, [['the ', CREAM], ['sweep', P.gold], ['.', CREAM]], 'HOW A DAY GETS SETTLED WITH NOBODY ONLINE')
  const y = 44
  clock(art, 30, y + 18)
  rack(art, 66, y + 2, 36, 32, P.gold)
  art.dots([[44, y + 18], [60, y + 18]], P['chrome-dim'], 2)
  art.arrow(62, y + 18, P['chrome-dim'])
  tzCard(art, svg, 120, y - 2, 'america/new_york', 'settle', true)
  tzCard(art, svg, 120, y + 13, 'america/los_angeles', '9:07p', false)
  tzCard(art, svg, 120, y + 28, 'europe/london', 'settle', true)
  for (const yy of [y + 4, y + 19, y + 34]) {
    art.dots([[104, y + 18], [110, y + 18], [110, yy], [115, yy]], P['chrome-dim'], 2)
    art.arrow(117, yy, P['chrome-dim'])
  }
  ledger(art, 206, y)
  art.dots([[188, y + 4], [200, y + 4]], P.mint, 2)
  art.arrow(202, y + 4, P.mint)
  art.dots([[188, y + 34], [196, y + 34], [196, y + 10], [200, y + 10]], P.mint, 2)

  svg.text(30, y + 41, 'pg_cron', { font: 'sans', size: 15, weight: 700, fill: CREAM, anchor: 'middle' })
  svg.text(30, y + 46, "'7 * * * *'", { font: 'mono', size: 12, fill: MUTE, anchor: 'middle' })
  svg.text(84, y + 41, 'sweep', { font: 'sans', size: 15, weight: 700, fill: CREAM, anchor: 'middle' })
  svg.text(84, y + 46, 'edge function', { font: 'mono', size: 12, fill: MUTE, anchor: 'middle' })
  svg.text(153, y + 47, 'has this table hit midnight yet?', { font: 'mono', size: 12, fill: MUTE, anchor: 'middle' })
  svg.text(221, y + 46, 'markers', { font: 'sans', size: 15, weight: 700, fill: CREAM, anchor: 'middle' })

  const by = 100
  art.box(12, by, 108, 34, { face: P.ink, edge: P.void, hi: P.dusk })
  file(art, 18, by + 6, P.ice)
  file(art, 18, by + 19, P.gold)
  svg.text(31, by + 11.5, 'src/lib/rules.ts', { font: 'mono', size: 12, fill: CREAM })
  svg.text(31, by + 24.5, 'functions/_shared/rules.ts', { font: 'mono', size: 12, fill: CREAM })
  svg.text(31, by + 17.8, 'same code on both sides', { font: 'sans', size: 12, fill: MUTE })
  svg.text(31, by + 31, 'npm run check:shared fails on drift', { font: 'mono', size: 11, fill: MUTE })

  art.box(130, by, 108, 34, { face: P.ink, edge: P.void, hi: P.dusk })
  lock(art, 136, by + 6, P.mint)
  svg.text(146, by + 11.5, 'idempotent', { font: 'sans', size: 14, weight: 700, fill: CREAM })
  svg.text(146, by + 18.5, 'unique (table, debtor, creditor, day, reason)', { font: 'mono', size: 11, fill: SOFT })
  svg.text(146, by + 24, 'duplicate markers are ignored.', { font: 'sans', size: 12, fill: MUTE })
  svg.text(146, by + 29.5, 'today is never swept.', { font: 'sans', size: 12, fill: MUTE })
  save('sweep', art, svg, 'The sweep: pg_cron runs hourly, the sweep function settles each table whose local day has ended, and writes markers')
}

function tableCard(art: Art, svg: Svg, x: number, y: number, name: string, cols: string[], accent = P.gold, w = 56): void {
  const h = 9 + cols.length * 5.5
  art.box(x, y, w, Math.round(h), { face: P.ink, edge: P.void, hi: P.dusk })
  art.rect(x + 1, y + 1, w - 2, 7, P.velvet)
  art.hline(x + 1, y + 8, w - 2, accent)
  lock(art, x + w - 8, y + 1, accent)
  svg.text(x + 3, y + 6, name, { font: 'mono5', size: 12.5, fill: CREAM })
  cols.forEach((c, i) => svg.text(x + 3, y + 13.5 + i * 5.5, c, { font: 'mono', size: 11, fill: MUTE }))
}

async function data(): Promise<void> {
  const art = new Art(LW, 156)
  const svg = new Svg()
  header(art, svg, [['who can see ', CREAM], ['what', P.mint], ['.', CREAM]], 'ROW LEVEL SECURITY ON EVERY TABLE')
  const L = 10
  const M = 97
  const R = 184
  const hub = { x: M, y: 64 }
  const cards: [number, number, string, string[], string?][] = [
    [L, 40, 'profiles', ['display_name', 'leetcode_username', 'venmo_handle']],
    [L, 72, 'antes', ['day_date', "status: 'verified'", 'photo_path']],
    [L, 104, 'storage: proofs', ['<table>/<profile>/', 'signed urls, 1 hour']],
    [R, 40, 'tables_', ['join_code', 'tz', 'last_swept_day']],
    [R, 72, 'powerups', ['kind', 'from_id → target_id', 'played_on']],
    [R, 104, 'markers + payments', ['debtor → creditor', 'confirmed_at']],
  ]
  for (const [x, y, , cols] of cards) {
    const cy = y + 6
    const fromX = x === L ? x + 56 : x
    art.dots([[fromX, cy], [x === L ? M - 6 : M + 62, cy], [x === L ? M - 6 : M + 62, hub.y + 10], [x === L ? M : M + 56, hub.y + 10]], P.dusk, 2)
    void cols
  }
  for (const [x, y, n, cols] of cards) tableCard(art, svg, x, y, n, cols)
  tableCard(art, svg, M, hub.y, 'memberships', ['table_id', 'profile_id'], P.mint)
  art.box(M, 96, 56, 26, { face: '#120a1c', edge: P.void, hi: P.mint })
  svg.text(M + 28, 102.5, 'is_member(table_id)', { font: 'mono5', size: 11.5, fill: P.mint, anchor: 'middle' })
  svg.text(M + 28, 109, 'security definer', { font: 'mono', size: 11, fill: MUTE, anchor: 'middle' })
  svg.text(M + 28, 115, 'table-scoped reads', { font: 'mono', size: 11, fill: MUTE, anchor: 'middle' })
  art.dots([[M + 28, 86], [M + 28, 96]], P.mint, 2)

  art.rect(0, 132, LW, 24, P.ink, 0.6)
  svg.text(12, 141, 'table data is scoped to membership.', { font: 'sans', size: 14, fill: SOFT })
  svg.text(12, 147.5, 'markers have no insert policy: only the sweep writes the ledger.', { font: 'sans', size: 14, fill: SOFT })
  svg.text(238, 141, 'invite codes redeem through', { font: 'mono', size: 12, fill: MUTE, anchor: 'end' })
  svg.text(238, 147.5, 'join_table_by_code()', { font: 'mono5', size: 12, fill: P.mint, anchor: 'end' })
  save('data', art, svg, 'Data model: membership scopes table data; profiles also allow reading your own row')
}

async function settle(): Promise<void> {
  const art = new Art(LW, 128)
  const svg = new Svg()
  header(art, svg, [['fewer ', CREAM], ['payments', P.gold], ['.', CREAM]], 'UNPAID DEBTS, NETTED DOWN')
  const cx = 52
  const cy = 76
  const r = 30
  const ring: [string, Face][] = [['KEVIN', 'money'], ['ANA', 'sad'], ['BO', 'sad'], ['DEE', 'money'], ['YOU', 'money']]
  const pos = ring.map((_, i) => {
    const a = -Math.PI / 2 + (i / ring.length) * Math.PI * 2
    return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.82)] as [number, number]
  })
  const debts: [number, number][] = [[2, 0], [2, 4], [2, 3], [1, 0], [1, 4], [2, 1], [3, 0], [1, 3], [4, 0]]
  debts.forEach(([a, b], i) => {
    const [x0, y0] = pos[a]
    const [x1, y1] = pos[b]
    const c = [P['chip-red-lt'], P.gold, P.cyan, P.amethyst][i % 4]
    art.dots([[x0, y0], [x1, y1]], c, 3, i)
  })
  ring.forEach(([n, f], i) => {
    person(art, pos[i][0] - 6, pos[i][1] - 7, CAST[n], f, true)
    svg.text(pos[i][0], pos[i][1] + 12, n.toLowerCase(), { font: 'mono5', size: 11, fill: MUTE, anchor: 'middle' })
  })
  svg.text(cx, 122, '9 unpaid debts', { font: 'mono5', size: 13, fill: MUTE, anchor: 'middle' })

  art.box(104, 66, 30, 14, { face: P.gold, edge: P.void, hi: P['gold-lt'], lo: P.bronze })
  svg.text(119, 75.6, 'net it', { font: 'mono5', size: 13, fill: P.ink, anchor: 'middle' })
  art.dots([[96, 73], [102, 73]], P.gold, 2)
  art.dots([[136, 73], [142, 73]], P.gold, 2)
  art.arrow(144, 73, P.gold)

  const pays: [string, string, string][] = [['BO', 'KEVIN', '$4'], ['ANA', 'YOU', '$2'], ['ANA', 'DEE', '$1']]
  pays.forEach(([a, b, amt], i) => {
    const y = 44 + i * 25
    art.box(152, y, 88, 20, { face: P.ink, edge: P.void, hi: P.dusk })
    person(art, 155, y + 3, CAST[a], 'sad', true)
    art.dots([[170, y + 10], [196, y + 10]], P.gold, 2)
    art.arrow(198, y + 10, P.gold)
    person(art, 201, y + 3, CAST[b], 'money', true)
    svg.text(185, y + 8, amt, { font: 'mono5', size: 14, fill: P['gold-lt'], anchor: 'middle' })
    svg.text(185, y + 17, `${a.toLowerCase()} → ${b.toLowerCase()}`, { font: 'mono', size: 10.5, fill: MUTE, anchor: 'middle' })
    art.box(218, y + 6, 18, 8, { face: P.blue, edge: P.void, hi: P.cyan, shadow: false })
    svg.text(227, y + 11.8, 'venmo', { font: 'mono5', size: 10, fill: P.white, anchor: 'middle' })
  })
  svg.text(196, 122, 'net balances, then greedy match: at most n − 1', { font: 'mono5', size: 12, fill: MUTE, anchor: 'middle' })
  save('settle', art, svg, 'Settle up: nine debts between five players net down to three payments')
}

