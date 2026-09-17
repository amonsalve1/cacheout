import type { Difficulty } from './types.ts'

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  Easy: '#3ee88a',
  Medium: '#ffb020',
  Hard: '#ff2d95',
}

export function fakeProof(opts: {
  title: string
  difficulty: Difficulty
  runtimeMs: number
  beats: number
  language: string
  seed: number
}): string {
  const { title, difficulty, runtimeMs, beats, language, seed } = opts
  const shown = title.length > 34 ? `${title.slice(0, 33)}…` : title

  const bars = Array.from({ length: 9 }, (_, i) => {
    const w = 30 + ((seed * (i + 3)) % 60)
    const indent = i === 0 || i === 8 ? 0 : ((seed >> i) & 1) * 14
    return `<rect x='${18 + indent}' y='${150 + i * 15}' width='${w}%' height='6' rx='3' fill='%23${i % 3 === 0 ? '5b4478' : '3d2a52'}'/>`
  }).join('')

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='300' viewBox='0 0 420 300'>` +
    `<rect width='420' height='300' fill='%2311081c'/>` +
    `<rect x='0' y='0' width='420' height='34' fill='%23241734'/>` +
    `<circle cx='18' cy='17' r='5' fill='%23e01e3c'/><circle cx='36' cy='17' r='5' fill='%23ffb020'/><circle cx='54' cy='17' r='5' fill='%2312a05c'/>` +
    `<text x='210' y='22' font-family='monospace' font-size='12' fill='%238b7aa8' text-anchor='middle'>leetcode.com</text>` +
    `<text x='18' y='66' font-family='monospace' font-size='19' font-weight='bold' fill='%233ee88a'>✓ Accepted</text>` +
    `<text x='18' y='92' font-family='monospace' font-size='13' fill='%23c2b8d4'>${escapeXml(shown)}</text>` +
    `<text x='18' y='114' font-family='monospace' font-size='12' fill='${encodeURIComponent(DIFFICULTY_COLOR[difficulty])}'>${difficulty}</text>` +
    `<text x='120' y='114' font-family='monospace' font-size='12' fill='%238b7aa8'>${runtimeMs} ms · beats ${beats}% · ${language}</text>` +
    `<rect x='0' y='130' width='420' height='170' fill='%23180e26'/>` +
    bars +
    `</svg>`
  return `data:image/svg+xml,${svg}`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
}
