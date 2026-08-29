import type { Vec3 } from './vec3.ts'
import { add, mul } from './vec3.ts'

export type Ray = { origin: Vec3; dir: Vec3 }

export const ray = (origin: Vec3, dir: Vec3): Ray => ({ origin, dir })
export const at = (r: Ray, t: number): Vec3 => add(r.origin, mul(r.dir, t))
