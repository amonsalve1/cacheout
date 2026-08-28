import type { Vec3 } from './vec3.ts'
import type { Ray } from './ray.ts'
import type { Material } from './materials.ts'
import { add, cross, dot, mul, norm, sub, v3 } from './vec3.ts'
import { at } from './ray.ts'

export type Hit = {
  t: number

  p: Vec3

  n: Vec3

  front: boolean
  mat: Material
  u: number
  v: number
}

export type Primitive = {
  hit(r: Ray, tMin: number, tMax: number): Hit | null
}

function orient(r: Ray, outward: Vec3): { n: Vec3; front: boolean } {
  const front = dot(r.dir, outward) < 0
  return { n: front ? outward : mul(outward, -1), front }
}

export class Sphere implements Primitive {
  center: Vec3
  radius: number
  mat: Material

  constructor(center: Vec3, radius: number, mat: Material) {
    this.center = center
    this.radius = radius
    this.mat = mat
  }

  hit(r: Ray, tMin: number, tMax: number): Hit | null {
    const oc = sub(r.origin, this.center)
    const a = dot(r.dir, r.dir)
    const halfB = dot(oc, r.dir)
    const c = dot(oc, oc) - this.radius * this.radius
    const disc = halfB * halfB - a * c
    if (disc < 0) return null

    const sqrtD = Math.sqrt(disc)
    let t = (-halfB - sqrtD) / a
    if (t < tMin || t > tMax) {
      t = (-halfB + sqrtD) / a
      if (t < tMin || t > tMax) return null
    }

    const p = at(r, t)
    const outward = mul(sub(p, this.center), 1 / this.radius)
    const { n, front } = orient(r, outward)

    const theta = Math.acos(-Math.max(-1, Math.min(1, outward.y)))
    const phi = Math.atan2(-outward.z, outward.x) + Math.PI
    return { t, p, n, front, mat: this.mat, u: phi / (2 * Math.PI), v: theta / Math.PI }
  }
}

export class Plane implements Primitive {
  point: Vec3
  normal: Vec3
  mat: Material
  private tangent: Vec3
  private bitangent: Vec3

  constructor(point: Vec3, normal: Vec3, mat: Material) {
    this.point = point
    this.normal = norm(normal)
    this.mat = mat

    const helper = Math.abs(this.normal.y) > 0.99 ? v3(1, 0, 0) : v3(0, 1, 0)
    this.tangent = norm(cross(helper, this.normal))
    this.bitangent = cross(this.normal, this.tangent)
  }

  hit(r: Ray, tMin: number, tMax: number): Hit | null {
    const denom = dot(this.normal, r.dir)
    if (Math.abs(denom) < 1e-8) return null
    const t = dot(sub(this.point, r.origin), this.normal) / denom
    if (t < tMin || t > tMax) return null

    const p = at(r, t)
    const { n, front } = orient(r, this.normal)
    const local = sub(p, this.point)
    return {
      t,
      p,
      n,
      front,
      mat: this.mat,
      u: dot(local, this.tangent),
      v: dot(local, this.bitangent),
    }
  }
}

export class Box implements Primitive {
  min: Vec3
  max: Vec3
  mat: Material

  constructor(center: Vec3, size: Vec3, mat: Material) {
    const h = mul(size, 0.5)
    this.min = sub(center, h)
    this.max = add(center, h)
    this.mat = mat
  }

  hit(r: Ray, tMin: number, tMax: number): Hit | null {
    let t0 = tMin
    let t1 = tMax
    let axis = 0
    let sign = 1

    const lo = [this.min.x, this.min.y, this.min.z]
    const hi = [this.max.x, this.max.y, this.max.z]
    const o = [r.origin.x, r.origin.y, r.origin.z]
    const d = [r.dir.x, r.dir.y, r.dir.z]

    for (let i = 0; i < 3; i++) {
      const inv = 1 / d[i]
      let near = (lo[i] - o[i]) * inv
      let far = (hi[i] - o[i]) * inv
      let s = -1
      if (near > far) {
        const tmp = near
        near = far
        far = tmp
        s = 1
      }
      if (near > t0) {
        t0 = near
        axis = i
        sign = s
      }
      if (far < t1) t1 = far
      if (t0 > t1) return null
    }

    const p = at(r, t0)
    const outward = v3(axis === 0 ? sign : 0, axis === 1 ? sign : 0, axis === 2 ? sign : 0)
    const { n, front } = orient(r, outward)

    const uAxis = axis === 0 ? p.z : p.x
    const vAxis = axis === 1 ? p.z : p.y
    return { t: t0, p, n, front, mat: this.mat, u: uAxis, v: vAxis }
  }
}
