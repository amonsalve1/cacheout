import type { Scene } from '../../src/scene.ts'
import type { Texture } from '../../src/materials.ts'
import type { Primitive } from '../../src/primitives.ts'
import type { Vec3 } from '../../src/vec3.ts'
import { defaults } from '../../src/scene.ts'
import { camera } from '../../src/camera.ts'
import { Box, Cylinder, Plane, Sphere, Transformed } from '../../src/primitives.ts'
import { checker, chipFace, emissive, lambert, metal } from '../../src/materials.ts'
import { CACHE_OUT, color } from '../../src/palette.ts'
import { add, clamp01, lerp, mul, v3 } from '../../src/vec3.ts'

export const CONCEPT =
  'A close dealer-eye view down onto green blackjack felt — cards, chip stacks, a shoe and a cut card ringing a gold betting arc while off-frame neon drags pink, cyan and gold pools across the nap.'

const c = (n: string) => color(CACHE_OUT, n)
const TAU = Math.PI * 2

const TOP = 0.4
const FELT_R = 7.5
const RAIL_R = 8.35
const TRIM_R = 8.85
const FLOOR_Y = -3.6

export function eyePosition(t: number): Vec3 {
  const SWAY = 0.23
  const yaw = Math.sin(t * TAU) * SWAY
  const dist = 7.25 + 0.16 * Math.cos(t * TAU * 2)
  const height = TOP + 5.55 + 0.2 * Math.sin(t * TAU * 2)
  return v3(Math.sin(yaw) * dist, height, Math.cos(yaw) * dist)
}

export const EYE_TARGET = v3(0, TOP + 0.35, 0)
export const EYE_FOV = 52

const place = (a: number, lx: number, lz: number, y: number): Vec3 =>
  v3(Math.cos(a) * lx + Math.sin(a) * lz, y, -Math.sin(a) * lx + Math.cos(a) * lz)

function feltTop(): Texture {
  const felt = c('felt')
  const deep = c('felt-deep')
  const lit = c('felt-lit')
  const gold = c('gold')
  return (_u: number, _v: number, p: Vec3): Vec3 => {
    const r = Math.sqrt(p.x * p.x + p.z * p.z)
    if (r > 5.18 && r < 5.54) return gold
    if (r > 3.4 && r < 3.64) return lerp(felt, lit, 0.65)
    const nap = 0.5 + 0.5 * Math.sin(p.x * 0.58 + 1.1) * Math.cos(p.z * 0.51 - 0.6)
    const rim = clamp01((r - 1.5) / 5.8)
    return lerp(lerp(felt, deep, rim * 0.7), lit, nap * 0.17)
  }
}

function cardFace(hx: number, hz: number): Texture {
  const white = c('white')
  const red = c('chip-red')
  return (u: number, v: number): Vec3 => {
    const x = u / hx
    const z = v / hz
    if (x < -0.4 && z < -0.48) return red
    if (x > 0.4 && z > 0.48) return red
    return white
  }
}

function cardBack(hx: number, hz: number): Texture {
  const white = c('white')
  const red = c('chip-red')
  const dk = c('chip-red-dk')
  return (u: number, v: number): Vec3 => {
    const x = u / hx
    const z = v / hz
    if (Math.abs(x) > 0.7 || Math.abs(z) > 0.76) return white
    return (Math.floor(u * 2.1) + Math.floor(v * 2.1)) & 1 ? red : dk
  }
}

type Denom = { face: string; dark: string; accent: string }

const DENOM: Record<string, Denom> = {
  red: { face: 'chip-red', dark: 'chip-red-dk', accent: 'white' },
  ivory: { face: 'white', dark: 'chrome-dim', accent: 'chip-red' },
  cyan: { face: 'cyan', dark: 'blue', accent: 'ice' },
  gold: { face: 'gold', dark: 'bronze', accent: 'white' },
  violet: { face: 'amethyst', dark: 'violet', accent: 'lilac' },
}

function chipStack(pos: Vec3, count: number, denom: Denom, radius = 0.56, h = 0.17): Primitive[] {
  const face = c(denom.face)
  const dark = c(denom.dark)
  const accent = c(denom.accent)
  const cap = lambert(chipFace(face, accent, 0.54, 0.87), {
    specular: 0.45,
    shininess: 64,
    reflectivity: 0.1,
  })
  const out: Primitive[] = []
  for (let i = 0; i < count; i++) {
    const rim = lambert(i & 1 ? dark : face, { specular: 0.3, shininess: 40 })
    out.push(
      new Transformed(new Cylinder(v3(0, 0, 0), radius, h, rim, cap), {
        rotate: v3(0, i * 0.9, 0),
        translate: add(pos, v3(0, h * 0.5 + i * h, 0)),
      }),
    )
  }
  return out
}

function station(a: number, denomName: string, chips: number, faceDown: boolean): Primitive[] {
  const hx = 0.64
  const hz = 0.9
  const size = v3(hx * 2, 0.07, hz * 2)
  const y = TOP + 0.035
  const cardMat = (tex: Texture) => lambert(tex, { specular: 0.28, shininess: 40 })

  const out: Primitive[] = [
    new Transformed(new Box(v3(0, 0, 0), size, cardMat(cardFace(hx, hz))), {
      rotate: v3(0, a - 0.26, 0),
      translate: place(a, -0.55, 4.35, y),
    }),
    new Transformed(
      new Box(v3(0, 0, 0), size, cardMat(faceDown ? cardBack(hx, hz) : cardFace(hx, hz))),
      { rotate: v3(0, a + 0.31, 0), translate: place(a, 0.6, 4.72, y + 0.08) },
    ),
  ]
  out.push(...chipStack(place(a, 0.05, 5.36, TOP), chips, DENOM[denomName]))
  return out
}

export function build(aspect = 16 / 9, t = 0): Scene {
  const velvet = c('velvet')
  const ink = c('ink')
  const hotPink = c('hot-pink')
  const cyan = c('cyan')
  const gold = c('gold')
  const amethyst = c('amethyst')

  const objects: Primitive[] = [
    new Plane(
      v3(0, FLOOR_Y, 0),
      v3(0, 1, 0),
      lambert(checker(ink, mul(velvet, 0.8), 0.34), {
        specular: 0.1,
        shininess: 20,
        reflectivity: 0.1,
      }),
    ),

    new Cylinder(
      v3(0, -0.7, 0),
      TRIM_R,
      1.4,
      metal(c('chrome-dim'), { reflectivity: 0.32, roughness: 0.02, shininess: 140 }),
    ),

    new Cylinder(
      v3(0, -0.4, 0),
      RAIL_R,
      1.5,
      lambert(c('mauve'), { specular: 0.4, shininess: 52, reflectivity: 0.08 }),
    ),

    new Cylinder(
      v3(0, -0.6, 0),
      FELT_R,
      2.0,
      lambert(c('felt-deep')),
      lambert(feltTop(), { specular: 0.12, shininess: 22, reflectivity: 0.05 }),
    ),
    new Cylinder(v3(0, -4.4, 0), 3.2, 6.6, lambert(ink, { specular: 0.1 })),
  ]

  const seats: Array<[number, string, number, boolean]> = [
    [0.3, 'red', 5, false],
    [1.35, 'ivory', 3, true],
    [2.4, 'cyan', 6, false],
    [3.44, 'gold', 4, true],
    [4.49, 'violet', 5, false],
    [5.54, 'red', 3, true],
  ]
  for (const [a, denom, n, down] of seats) objects.push(...station(a, denom, n, down))

  const A0 = 4.95
}
