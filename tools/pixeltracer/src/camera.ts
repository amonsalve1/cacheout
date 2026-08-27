import type { Vec3 } from './vec3.ts'
import type { Ray } from './ray.ts'
import { add, cross, mul, norm, sub, v3 } from './vec3.ts'
import { ray } from './ray.ts'

export type Camera = {
  origin: Vec3
  lowerLeft: Vec3
  horizontal: Vec3
  vertical: Vec3
}

export type CameraOpts = {
  from: Vec3
  to: Vec3
  up?: Vec3
  fovDeg?: number
  aspect?: number
}

export function camera(opts: CameraOpts): Camera {
  const { from, to, up = v3(0, 1, 0), fovDeg = 40, aspect = 1 } = opts
  const h = Math.tan((fovDeg * Math.PI) / 180 / 2)
  const viewportH = 2 * h
  const viewportW = viewportH * aspect

  const w = norm(sub(from, to))
  const u = norm(cross(up, w))
  const v = cross(w, u)

  const horizontal = mul(u, viewportW)
  const vertical = mul(v, viewportH)
  const lowerLeft = sub(sub(sub(from, mul(horizontal, 0.5)), mul(vertical, 0.5)), w)
  return { origin: from, lowerLeft, horizontal, vertical }
}

export function rayThrough(cam: Camera, s: number, t: number): Ray {
  const target = add(cam.lowerLeft, add(mul(cam.horizontal, s), mul(cam.vertical, t)))
  return ray(cam.origin, norm(sub(target, cam.origin)))
}
