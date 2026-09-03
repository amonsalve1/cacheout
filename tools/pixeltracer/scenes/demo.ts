import type { Scene } from '../src/scene.ts'
import { defaults } from '../src/scene.ts'
import { camera } from '../src/camera.ts'
import { Box, Cylinder, Plane, Sphere, Transformed } from '../src/primitives.ts'
import { checker, emissive, glass, lambert, metal, rings } from '../src/materials.ts'
import { CACHE_OUT, color } from '../src/palette.ts'
import { add, clamp01, lerp, mul, v3 } from '../src/vec3.ts'

const c = (name: string) => color(CACHE_OUT, name)

export function build(aspect = 1): Scene {
  const ink = c('ink')
  const velvet = c('velvet')
  const hotPink = c('hot-pink')
  const cyan = c('cyan')

  const objects = [
    new Plane(
      v3(0, 0, 0),
      v3(0, 1, 0),
      lambert(checker(c('felt-deep'), c('felt'), 2.1), {
        specular: 0.14,
        shininess: 14,
        reflectivity: 0.1,
      }),
    ),

    ...[0, 1, 2, 3, 4].map((i) => {
      const face = i % 2 === 0 ? c('chip-red') : c('white')
      const accent = i % 2 === 0 ? c('white') : c('chip-red-dk')
      return new Transformed(
        new Cylinder(
          v3(0, 0, 0),
          0.58,
          0.14,

          lambert(face, { specular: 0.35, shininess: 48 }),

          lambert(rings(face, accent, 3), { specular: 0.45, shininess: 64, reflectivity: 0.14 }),
        ),
        {
          rotate: v3(0, i * 0.3, 0.025 * (i % 2 === 0 ? 1 : -1)),
          translate: v3(-1.5, 0.075 + i * 0.145, 0.5),
        },
      )
    }),

    new Transformed(
      new Box(
        v3(0, 0, 0),
        v3(1.05, 1.05, 1.05),
        metal(c('chrome'), { reflectivity: 0.42, roughness: 0.01, specular: 1.0, shininess: 160 }),
      ),
      { rotate: v3(0.4, 0.98, 0.16), translate: v3(0.2, 1.98, -0.6) },
    ),

    new Sphere(v3(1.28, 0.66, 1.35), 0.66, glass({ ior: 1.52 })),

    new Sphere(v3(-0.5, 0.32, 2.0), 0.32, metal(c('gold'), { reflectivity: 0.5, shininess: 96 })),

    new Sphere(v3(-2.9, 2.5, -2.2), 0.3, emissive(c('hot-pink'))),
  ]

  return {
    camera: camera({ from: v3(0.1, 1.58, 6.0), to: v3(0.05, 1.05, 0), fovDeg: 44, aspect }),
    objects,
    lights: [
      { pos: v3(-2.9, 2.5, -2.2), color: hotPink, intensity: 2.6, radius: 9 },
      { pos: v3(4.6, 3.4, 3.2), color: cyan, intensity: 2.4, radius: 16 },
      { pos: v3(0.0, 5.5, 2.0), color: c('gold'), intensity: 1.5, radius: 18 },
    ],
    ambient: mul(velvet, 1.05),
    background: (dir) => {
      const t = clamp01(dir.y * 0.5 + 0.5)
      const glow = Math.pow(1 - Math.abs(dir.y), 5)
      return add(lerp(mul(ink, 1.2), mul(velvet, 1.15), t), mul(hotPink, glow * 0.3))
    },
    shadeMode: defaults.shadeMode,
    celBands: defaults.celBands,
    maxDepth: defaults.maxDepth,

    fog: { color: mul(velvet, 1.1), density: 0.038 },
    seed: defaults.seed,
  }
}
