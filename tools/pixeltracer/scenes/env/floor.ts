import type { Scene } from '../../src/scene.ts'
import type { Vec3 } from '../../src/vec3.ts'
import type { Primitive } from '../../src/primitives.ts'
import { defaults } from '../../src/scene.ts'
import { camera } from '../../src/camera.ts'
import { Box, Cylinder, Plane, Sphere, Transformed } from '../../src/primitives.ts'
import { checker, chipFace, emissive, lambert } from '../../src/materials.ts'
import { CACHE_OUT, color } from '../../src/palette.ts'
import { add, clamp01, lerp, mul, v3 } from '../../src/vec3.ts'

export const CONCEPT =
  'A neon-soaked casino aisle at standing height: green felt and chip stacks across the foreground, slot cabinets and glowing rails receding into violet haze under white light globes.'

const c = (name: string) => color(CACHE_OUT, name)
const glow = (name: string) => emissive(c(name))

const ROOM_TOP = 4.6
const WALL_X = 7.6
const WALL_Z = -20

const RAMPS: Record<string, string[]> = {
  gold: ['gold-lt', 'gold', 'bronze', 'bronze-dk'],
  cyan: ['ice', 'cyan', 'blue', 'navy'],
  pink: ['pink-lt', 'hot-pink', 'magenta-dk', 'magenta-dk'],
  violet: ['lilac', 'amethyst', 'violet', 'violet'],
  green: ['mint', 'felt-lit', 'felt', 'felt-deep'],
  red: ['chip-red-lt', 'chip-red', 'chip-red-dk', 'blood'],
  bulb: ['white', 'chrome', 'chrome-dim', 'mauve'],
}

const CAB_Z = [2.2, -0.5, -3.2, -5.9, -8.6, -11.3, -14.0]
const CAB_X = 4.6
const CAB_H = 2.3

const CAB_FACE = CAB_X - 0.68

const rank = (i: number, n: number): number => Math.min(3, Math.floor((i * 4) / n))
const graded = (ramp: string, i: number, n = CAB_Z.length): string => RAMPS[ramp][rank(i, n)]

const SCREENS_L = ['gold', 'pink', 'cyan', 'green', 'gold', 'pink', 'cyan']
const SCREENS_R = ['cyan', 'gold', 'violet', 'red', 'cyan', 'green', 'pink']
const TOPPERS_L = ['red', 'gold', 'violet', 'red', 'gold', 'pink', 'gold']
const TOPPERS_R = ['gold', 'violet', 'red', 'gold', 'pink', 'gold', 'cyan']

function slotRow(side: number, screens: string[], toppers: string[]): Primitive[] {
  const out: Primitive[] = []
  for (let i = 0; i < CAB_Z.length; i++) {
    const z = CAB_Z[i]

    out.push(
      new Box(
        v3(side * CAB_X, CAB_H / 2, z),
        v3(1.36, CAB_H, 1.8),
        lambert(i % 2 === 0 ? c('dusk') : c('velvet'), { specular: 0.1, shininess: 26 }),
      ),
    )

    out.push(
      new Box(v3(side * CAB_FACE, 1.52, z), v3(0.12, 1.06, 1.34), glow(graded(screens[i], i))),
    )

    out.push(
      new Box(
        v3(side * (CAB_X - 0.1), CAB_H + 0.2, z),
        v3(1.1, 0.34, 1.5),
        glow(graded(toppers[i], i)),
      ),
    )
  }
  return out
}

function neonRail(side: number): Primitive[] {
  const hues = side < 0 ? ['pink', 'violet', 'cyan'] : ['cyan', 'violet', 'pink']
  return [0.4, -5.4, -11.2].map(
    (z, i) =>
      new Box(
        v3(side * (CAB_X - 0.5), 3.18, z),
        v3(0.2, 0.4, 5.2),
        glow(RAMPS[hues[i]][i === 0 ? 1 : i === 1 ? 2 : 3]),
      ),
  )
}

const TABLE_TOP = 1.0
const TABLE_Z = 5.78

const feltTex = (_u: number, _v: number, p: Vec3): Vec3 => {
  const dz = p.z - 3.3
  const r = Math.sqrt(p.x * p.x + dz * dz)
  return Math.abs(r - 2.5) < 0.06 ? c('mint') : c('felt')
}

function chipStack(x: number, z: number, count: number, hot: boolean): Primitive[] {
  const out: Primitive[] = []
  for (let i = 0; i < count; i++) {
    const face = hot === (i % 2 === 0) ? c('chip-red') : c('white')
    const accent = hot === (i % 2 === 0) ? c('white') : c('chip-red-dk')
    out.push(
      new Transformed(
        new Cylinder(
          v3(0, 0, 0),
          0.17,
          0.064,
          lambert(face, { specular: 0.28, shininess: 40 }),
          lambert(chipFace(face, accent), { specular: 0.34, shininess: 56 }),
        ),
        { rotate: v3(0, i * 0.4, 0), translate: v3(x, TABLE_TOP + 0.032 + i * 0.066, z) },
      ),
    )
  }
  return out
}

const card = (x: number, z: number, yaw: number): Primitive =>
  new Transformed(
    new Box(
      v3(0, 0, 0),
      v3(0.3, 0.024, 0.42),
      lambert(c('white'), { specular: 0.25, shininess: 40 }),
    ),
    { rotate: v3(0, yaw, 0), translate: v3(x, TABLE_TOP + 0.014, z) },
  )

function buildObjects(): Primitive[] {
  return [
    new Plane(
      v3(0, 0, 0),
      v3(0, 1, 0),
      lambert(checker(c('velvet'), c('dusk'), 0.42), {
        specular: 0.05,
        shininess: 18,
        reflectivity: 0.13,
      }),
    ),

    new Plane(v3(0, ROOM_TOP, 0), v3(0, -1, 0), lambert(c('ink'), { specular: 0 })),

    new Plane(v3(0, 0, WALL_Z), v3(0, 0, 1), lambert(c('ink'), { specular: 0 })),
    new Plane(v3(-WALL_X, 0, 0), v3(1, 0, 0), lambert(c('ink'), { specular: 0.04, shininess: 12 })),
    new Plane(v3(WALL_X, 0, 0), v3(-1, 0, 0), lambert(c('ink'), { specular: 0.04, shininess: 12 })),

    ...slotRow(-1, SCREENS_L, TOPPERS_L),
    ...slotRow(1, SCREENS_R, TOPPERS_R),
    ...neonRail(-1),
    ...neonRail(1),

    ...[1.0, -3.0, -7.0, -11.0].flatMap((z, i) => [
      new Sphere(v3(-3.0, 3.45, z), 0.26 - i * 0.015, glow(graded('bulb', i, 4))),
      new Sphere(v3(3.0, 3.45, z), 0.26 - i * 0.015, glow(graded('bulb', i, 4))),
    ]),

    new Box(v3(-3.8, 3.2, WALL_Z + 0.4), v3(2.2, 1.0, 0.2), glow('magenta-dk')),
    new Box(v3(3.8, 3.2, WALL_Z + 0.4), v3(2.2, 1.0, 0.2), glow('blue')),

    new Box(v3(0, 0.43, TABLE_Z), v3(6.6, 0.86, 1.7), lambert(c('ink'), { specular: 0.06 })),

    new Box(v3(0, 0.93, TABLE_Z), v3(7.2, 0.14, 2.0), lambert(feltTex, { specular: 0.04 })),

    new Box(
      v3(0, 1.02, TABLE_Z + 1.07),
      v3(7.3, 0.13, 0.26),
      lambert(c('blood'), { specular: 0.1, shininess: 56 }),
    ),

    ...chipStack(-1.85, 5.3, 4, true),
    ...chipStack(2.0, 5.42, 4, false),
    card(-2.35, 5.82, 0.22),
    card(-2.05, 5.98, -0.35),
    card(2.5, 5.88, 0.4),
  ]
}

let cached: Primitive[] | null = null
const objects = (): Primitive[] => (cached ??= buildObjects())

export function build(aspect = 16 / 9, t = 0): Scene {
  const a = 2 * Math.PI * t

  const from = v3(0.95 * Math.sin(a), 1.72 + 0.05 * Math.sin(2 * a), 8.15 + 0.45 * Math.cos(a))

  const to = v3(-1.55 * Math.sin(a), 1.5 + 0.04 * Math.sin(2 * a), -9.0)

  const up = v3(0.022 * Math.sin(a), 1, 0)

  return {
    camera: camera({ from, to, up, fovDeg: 52, aspect }),
    objects: objects(),
    lights: [
      { pos: v3(-2.3, 3.15, 5.5), color: c('gold'), intensity: 0.9, radius: 8 },
      { pos: v3(2.4, 3.15, 5.6), color: c('gold-lt'), intensity: 0.8, radius: 8 },

      { pos: v3(-3.9, 2.7, 0.2), color: c('hot-pink'), intensity: 1.9, radius: 20 },
      { pos: v3(3.9, 2.7, -1.4), color: c('cyan'), intensity: 1.9, radius: 20 },

      { pos: v3(0, 3.35, -3.2), color: c('gold-lt'), intensity: 1.6, radius: 22 },
      { pos: v3(0, 3.2, -11.0), color: c('amethyst'), intensity: 1.7, radius: 26 },

      { pos: v3(-2.9, 2.9, 9.9), color: c('lilac'), intensity: 0.5, radius: 11 },
      { pos: v3(2.9, 2.9, 9.9), color: c('lilac'), intensity: 0.5, radius: 11 },
    ],
    ambient: mul(c('velvet'), 0.55),
    background: (dir) => {
      const h = clamp01(dir.y * 0.5 + 0.5)
      const halo = Math.pow(1 - Math.abs(dir.y), 6)
      return add(
        lerp(mul(c('ink'), 1.2), mul(c('velvet'), 1.2), h),
        mul(c('hot-pink'), halo * 0.25),
      )
    },
    shadeMode: defaults.shadeMode,
    celBands: defaults.celBands,

    maxDepth: 3,

    fog: { color: mul(c('velvet'), 0.7), density: 0.032 },
    seed: defaults.seed,
  }
}
