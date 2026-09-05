import type { Scene } from '../../src/scene.ts'
import type { Primitive } from '../../src/primitives.ts'
import { Box, Cylinder, Group, Sphere, Transformed } from '../../src/primitives.ts'
import { camera } from '../../src/camera.ts'
import { chipFace, lambert, metal } from '../../src/materials.ts'
import { CACHE_OUT, color } from '../../src/palette.ts'
import { add, clamp01, lerp, mul, v3 } from '../../src/vec3.ts'
import { defaults } from '../../src/scene.ts'
import { EYE_FOV, EYE_TARGET, eyePosition } from './table.ts'

const c = (n: string) => color(CACHE_OUT, n)

const TOP = 0.4

function chipStack(x: number, z: number, count: number, face: string, accent: string): Primitive[] {
  return Array.from(
    { length: count },
    (_, i) =>
      new Transformed(
        new Cylinder(
          v3(0, 0, 0),
          0.42,
          0.11,
          lambert(c(face), { specular: 0.35, shininess: 48 }),
          lambert(chipFace(c(face), c(accent)), { specular: 0.45, shininess: 62 }),
        ),
        {
          rotate: v3(0, i * 0.22, 0.012 * (i % 2 === 0 ? 1 : -1)),
          translate: v3(x, TOP + 0.055 + i * 0.113, z),
        },
      ),
  )
}

function holeCard(x: number, z: number, spin: number): Primitive {
  const stock = lambert(c('mauve'), { specular: 0.26, shininess: 32 })
  const back = lambert(c('velvet'), { specular: 0.3, shininess: 40 })
  const motif = lambert(c('bronze-dk'), { specular: 0.35, shininess: 46 })
  return new Transformed(
    new Group([
      new Box(v3(0, 0, 0), v3(1.15, 0.04, 1.6), stock),
      new Box(v3(0, 0.026, 0), v3(0.9, 0.014, 1.34), back),
      new Box(v3(0, 0.036, 0), v3(0.44, 0.01, 0.86), motif),
    ]),
    { rotate: v3(0, spin, 0), translate: v3(x, TOP + 0.022, z) },
  )
}

export const CONCEPT =
  'Near-field plate: your two hole cards, your chip stacks and your drink, traced ' +
  'against transparency from the room camera so the interface passes behind them.'

export function build(aspect = 16 / 9, t = 0): Scene {
  const glassMat = metal(c('ice'), { reflectivity: 0.3, specular: 0.95, shininess: 150 })

  const objects: Primitive[] = [
    holeCard(-0.95, 4.05, 0.13),
    holeCard(0.35, 4.2, -0.19),

    ...chipStack(-2.55, 3.55, 5, 'felt', 'gold'),
    ...chipStack(-1.85, 3.95, 3, 'bronze-dk', 'gold-lt'),
    ...chipStack(2.35, 3.65, 4, 'dusk', 'bronze'),
    ...chipStack(3.0, 4.05, 2, 'felt-deep', 'gold'),

    new Cylinder(v3(3.95, TOP + 0.42, 3.15), 0.32, 0.84, glassMat, glassMat),
    new Cylinder(v3(3.95, TOP + 0.06, 3.15), 0.4, 0.12, glassMat, glassMat),
    new Sphere(
      v3(3.95, TOP + 0.78, 3.15),
      0.16,
      lambert(c('gold'), { specular: 0.6, shininess: 80 }),
    ),
  ]

  return {
    camera: camera({ from: eyePosition(t), to: EYE_TARGET, fovDeg: EYE_FOV, aspect }),
    objects,

    lights: [
      { pos: v3(6.6, 5.4, 3.4), color: c('bronze'), intensity: 1.35, radius: 13 },
      { pos: v3(-5.9, 5.0, 5.2), color: c('felt-lit'), intensity: 1.15, radius: 13 },
      { pos: v3(-3.6, 5.6, -6.8), color: c('gold'), intensity: 1.7, radius: 14 },
      { pos: v3(5.2, 4.8, -5.6), color: c('mauve'), intensity: 1.0, radius: 13 },
      { pos: v3(0, 11.0, 0), color: c('mint'), intensity: 0.5, radius: 24 },
    ],
    ambient: mul(c('velvet'), 0.85),
    background: (dir) => {
      const y = clamp01(dir.y * 0.5 + 0.5)
      return add(lerp(mul(c('ink'), 1.3), mul(c('velvet'), 1.2), y), mul(c('hot-pink'), 0.1))
    },
    shadeMode: defaults.shadeMode,
    celBands: defaults.celBands,
    maxDepth: 3,
    seed: defaults.seed,
  }
}
