import type { Vec3 } from './vec3.ts'
import type { Primitive } from './primitives.ts'
import type { Camera } from './camera.ts'

export type Light = {
  pos: Vec3
  color: Vec3
  intensity: number

  radius?: number
}

export type ShadeMode = 'cel' | 'dither' | 'hybrid'

export type Scene = {
  camera: Camera
  objects: Primitive[]
  lights: Light[]
  ambient: Vec3

  background: (dir: Vec3) => Vec3
  shadeMode: ShadeMode

  celBands: number
  maxDepth: number

  fog?: { color: Vec3; density: number }
  seed: number
}

export const defaults = {
  ambient: { x: 0.06, y: 0.06, z: 0.1 } as Vec3,
  shadeMode: 'hybrid' as ShadeMode,
  celBands: 4,
  maxDepth: 5,
  seed: 0x0ca5e0,
}
