import type { Scene } from '../../src/scene.ts'
import type { Vec3 } from '../../src/vec3.ts'
import type { Primitive } from '../../src/primitives.ts'
import { defaults } from '../../src/scene.ts'
import { camera } from '../../src/camera.ts'
import { CACHE_OUT, color } from '../../src/palette.ts'
import { mul, v3 } from '../../src/vec3.ts'

export const c = (name: string) => color(CACHE_OUT, name)

export type StudioOpts = {
  objects: Primitive[]

  target?: Vec3

  yaw?: number

  pitch?: number

  distance?: number
  fovDeg?: number
  aspect?: number
  celBands?: number
}

export function studio(opts: StudioOpts): Scene {
  const {
    objects,
    target = v3(0, 0, 0),
    yaw = 0.6,
    pitch = 0.75,

    distance = 9,
    fovDeg = 17,
    aspect = 1,
    celBands = 4,
  } = opts

  const from = v3(
    target.x + Math.sin(yaw) * distance * Math.cos(pitch),
    target.y + Math.sin(pitch) * distance,
    target.z + Math.cos(yaw) * distance * Math.cos(pitch),
  )

  return {
    camera: camera({ from, to: target, fovDeg, aspect }),
    objects,
    lights: [
      { pos: v3(-5, 6, 5), color: c('hot-pink'), intensity: 2.5, radius: 22 },

      { pos: v3(6, 1.5, 4), color: c('cyan'), intensity: 1.5, radius: 22 },

      { pos: v3(1.5, 4, -6), color: c('gold'), intensity: 2.0, radius: 18 },
    ],
    ambient: mul(c('velvet'), 1.35),

    background: () => mul(c('velvet'), 1.1),
    shadeMode: defaults.shadeMode,
    celBands,
    maxDepth: 4,
    seed: defaults.seed,
  }
}
