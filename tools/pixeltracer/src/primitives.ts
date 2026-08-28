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

export class Cylinder implements Primitive {
  center: Vec3
  radius: number
  height: number
  mat: Material

  capMat: Material

  constructor(center: Vec3, radius: number, height: number, mat: Material, capMat?: Material) {
    this.center = center
    this.radius = radius
    this.height = height
    this.mat = mat
    this.capMat = capMat ?? mat
  }

  hit(r: Ray, tMin: number, tMax: number): Hit | null {
    let best: Hit | null = null
    let closest = tMax
    const halfH = this.height / 2

    const ox = r.origin.x - this.center.x
    const oz = r.origin.z - this.center.z
    const a = r.dir.x * r.dir.x + r.dir.z * r.dir.z
    if (a > 1e-9) {
      const b = 2 * (ox * r.dir.x + oz * r.dir.z)
      const c = ox * ox + oz * oz - this.radius * this.radius
      const disc = b * b - 4 * a * c
      if (disc >= 0) {
        const sq = Math.sqrt(disc)
        for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
          if (t < tMin || t > closest) continue
          const p = at(r, t)
          const dy = p.y - this.center.y
          if (Math.abs(dy) > halfH) continue
          const outward = norm(v3(p.x - this.center.x, 0, p.z - this.center.z))
          const { n, front } = orient(r, outward)
          const u = (Math.atan2(p.z - this.center.z, p.x - this.center.x) + Math.PI) / (2 * Math.PI)
          best = { t, p, n, front, mat: this.mat, u, v: dy / this.height + 0.5 }
          closest = t
          break
        }
      }
    }

    if (Math.abs(r.dir.y) > 1e-9) {
      for (const sign of [-1, 1]) {
        const t = (this.center.y + sign * halfH - r.origin.y) / r.dir.y
        if (t < tMin || t > closest) continue
        const p = at(r, t)
        const dx = p.x - this.center.x
        const dz = p.z - this.center.z
        if (dx * dx + dz * dz > this.radius * this.radius) continue
        const { n, front } = orient(r, v3(0, sign, 0))
        best = {
          t,
          p,
          n,
          front,
          mat: this.capMat,
          u: dx / (2 * this.radius) + 0.5,
          v: dz / (2 * this.radius) + 0.5,
        }
        closest = t
      }
    }
    return best
  }
}

export type Mat3 = [number, number, number, number, number, number, number, number, number]

export function rotationXYZ(rx: number, ry: number, rz: number): Mat3 {
  const cx = Math.cos(rx),
    sx = Math.sin(rx)
  const cy = Math.cos(ry),
    sy = Math.sin(ry)
  const cz = Math.cos(rz),
    sz = Math.sin(rz)

  return [
    cz * cy,
    cz * sy * sx - sz * cx,
    cz * sy * cx + sz * sx,
    sz * cy,
    sz * sy * sx + cz * cx,
    sz * sy * cx - cz * sx,
    -sy,
    cy * sx,
    cy * cx,
  ]
}

export const mat3Mul = (m: Mat3, v: Vec3): Vec3 =>
  v3(
    m[0] * v.x + m[1] * v.y + m[2] * v.z,
    m[3] * v.x + m[4] * v.y + m[5] * v.z,
    m[6] * v.x + m[7] * v.y + m[8] * v.z,
  )

export const mat3T = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]

export class Transformed implements Primitive {
  private child: Primitive
  private rot: Mat3
  private inv: Mat3
  private translate: Vec3

  constructor(child: Primitive, opts: { rotate?: Vec3; translate?: Vec3 } = {}) {
    const rotate = opts.rotate ?? v3(0, 0, 0)
    this.child = child
    this.rot = rotationXYZ(rotate.x, rotate.y, rotate.z)
    this.inv = mat3T(this.rot)
    this.translate = opts.translate ?? v3(0, 0, 0)
  }

  hit(r: Ray, tMin: number, tMax: number): Hit | null {
    const localOrigin = mat3Mul(this.inv, sub(r.origin, this.translate))
    const localDir = mat3Mul(this.inv, r.dir)
    const h = this.child.hit({ origin: localOrigin, dir: localDir }, tMin, tMax)
    if (!h) return null
    return {
      ...h,
      p: add(mat3Mul(this.rot, h.p), this.translate),
      n: mat3Mul(this.rot, h.n),
    }
  }
}

export class Group implements Primitive {
  parts: Primitive[]

  constructor(parts: Primitive[]) {
    this.parts = parts
  }

  hit(r: Ray, tMin: number, tMax: number): Hit | null {
    let best: Hit | null = null
    let closest = tMax
    for (const p of this.parts) {
      const h = p.hit(r, tMin, closest)
      if (h) {
        closest = h.t
        best = h
      }
    }
    return best
  }
}
