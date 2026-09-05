import type { Scene } from '../../src/scene.ts'
import type { Primitive } from '../../src/primitives.ts'
import { Box, Cylinder, Group, Plane, Sphere, Transformed } from '../../src/primitives.ts'
import { camera } from '../../src/camera.ts'
import { checker, emissive, lambert, metal } from '../../src/materials.ts'
import { CACHE_OUT, color } from '../../src/palette.ts'
import { add, clamp01, lerp, mul, v3 } from '../../src/vec3.ts'
import { defaults } from '../../src/scene.ts'

const c = (name: string) => color(CACHE_OUT, name)

function cabinet(x: number, z: number, hue: string): Primitive {
  const body = metal(c('dusk'), { reflectivity: 0.22, specular: 0.7, shininess: 90 })
  return new Group([
    new Box(v3(x, 1.1, z), v3(1.5, 2.2, 1.1), body),

    new Box(v3(x, 1.5, z + 0.58), v3(1.2, 1.0, 0.06), emissive(c(hue))),
    new Box(v3(x, 2.42, z), v3(1.6, 0.34, 1.2), metal(c('bronze'), { reflectivity: 0.4 })),
    new Sphere(v3(x, 2.75, z), 0.22, emissive(c('gold-lt'))),
  ])
}

function table(x: number, z: number, spin: number): Primitive {
  const felt = lambert(c('felt'), { specular: 0.12, shininess: 12 })
  const rail = metal(c('bronze-dk'), { reflectivity: 0.3, shininess: 70 })
  const chips = [0, 1, 2, 3].map(
    (i) =>
      new Cylinder(
        v3(x + 0.55, 0.94 + i * 0.075, z + 0.3),
        0.26,
        0.07,
        lambert(i % 2 === 0 ? c('chip-red') : c('white'), { specular: 0.4, shininess: 50 }),
      ),
  )
  return new Transformed(
    new Group([
      new Cylinder(v3(x, 0.86, z), 1.7, 0.14, felt, felt),
      new Cylinder(v3(x, 0.78, z), 1.78, 0.1, rail, rail),
      new Cylinder(v3(x, 0.4, z), 0.28, 0.9, rail),
      ...chips,
    ]),
    { rotate: v3(0, spin, 0) },
  )
}

export const CONCEPT =
  'A casino parlour orbited slowly: felt tables, neon slot cabinets down both walls, ' +
  'glowing arches overhead, all mirrored in a black polished floor.'

export function build(aspect = 16 / 9, t = 0): Scene {
  const objects: Primitive[] = [
    new Plane(
      v3(0, 0, 0),
      v3(0, 1, 0),
      lambert(checker(c('void'), c('ink'), 0.62), {
        specular: 0.18,
        shininess: 40,
        reflectivity: 0.12,
      }),
    ),

    new Plane(v3(0, 8.4, 0), v3(0, -1, 0), lambert(c('ink'), { specular: 0.05, shininess: 6 })),
  ]

  const hues = ['hot-pink', 'cyan', 'gold', 'amethyst', 'mint']
  for (let i = 0; i < 6; i++) {
    const z = -14 + i * 4.2
    objects.push(cabinet(-8.4, z, hues[i % hues.length]))
    objects.push(cabinet(8.4, z, hues[(i + 2) % hues.length]))
  }

  objects.push(table(-4.2, -6.0, 0.4), table(3.6, -8.5, 1.1), table(-3.9, -13, 2.2))

  for (let i = 0; i < 5; i++) {
    const z = -15 + i * 5
    const hue = i % 2 === 0 ? 'hot-pink' : 'cyan'
    for (let b = 0; b <= 14; b++) {
      const a = (b / 14) * Math.PI
      objects.push(
        new Sphere(v3(Math.cos(a) * 8.2, 3.2 + Math.sin(a) * 3.0, z), 0.26, emissive(c(hue))),
      )
    }
  }

  for (let i = 0; i < 6; i++) {
    objects.push(new Sphere(v3(0, 6.5, -20 + i * 4), 0.3, emissive(c('gold-lt'))))
  }

  const angle = t * Math.PI * 2
  const radius = 5.2
  const from = v3(
    Math.sin(angle) * radius,
    2.9 + Math.sin(angle * 2) * 0.18,
    -3.5 + Math.cos(angle) * radius,
  )
  const to = v3(Math.sin(angle + 1.5) * 1.6, 2.75, -9.5 + Math.cos(angle + 1.5) * 1.6)

  return {
    camera: camera({ from, to, fovDeg: 62, aspect }),
    objects,
    lights: [
      { pos: v3(-7, 4.5, -4), color: c('hot-pink'), intensity: 5.0, radius: 24 },
      { pos: v3(7, 4.5, -9), color: c('cyan'), intensity: 4.6, radius: 24 },
      { pos: v3(0, 6.2, -12), color: c('gold'), intensity: 4.0, radius: 28 },
      { pos: v3(0, 3.4, 3), color: c('violet'), intensity: 3.0, radius: 20 },
    ],
    ambient: mul(c('velvet'), 1.5),
    background: (dir) => {
      const y = clamp01(dir.y * 0.5 + 0.5)
      return add(lerp(mul(c('void'), 1.1), mul(c('velvet'), 0.9), y), mul(c('magenta-dk'), 0.18))
    },
    shadeMode: defaults.shadeMode,
    celBands: 4,
    maxDepth: 3,
    fog: { color: mul(c('velvet'), 1.5), density: 0.022 },
    seed: defaults.seed,
  }
}
