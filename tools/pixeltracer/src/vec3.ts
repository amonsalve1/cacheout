export type Vec3 = { x: number; y: number; z: number }

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z })
export const splat = (n: number): Vec3 => ({ x: n, y: n, z: n })
export const ZERO: Vec3 = v3(0, 0, 0)
export const ONE: Vec3 = v3(1, 1, 1)

export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z)
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z)
export const neg = (a: Vec3): Vec3 => v3(-a.x, -a.y, -a.z)

export const mul = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s)

export const mulv = (a: Vec3, b: Vec3): Vec3 => v3(a.x * b.x, a.y * b.y, a.z * b.z)

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)

export const len2 = (a: Vec3): number => dot(a, a)
export const len = (a: Vec3): number => Math.sqrt(dot(a, a))

export function norm(a: Vec3): Vec3 {
  const l = len(a)
  return l > 0 ? mul(a, 1 / l) : ZERO
}

export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(mul(a, 1 - t), mul(b, t))

export const reflect = (d: Vec3, n: Vec3): Vec3 => sub(d, mul(n, 2 * dot(d, n)))

export function refract(d: Vec3, n: Vec3, eta: number): Vec3 | null {
  const cosI = -Math.max(-1, Math.min(1, dot(d, n)))
  const sin2T = eta * eta * (1 - cosI * cosI)
  if (sin2T > 1) return null
  const cosT = Math.sqrt(1 - sin2T)
  return add(mul(d, eta), mul(n, eta * cosI - cosT))
}

export function schlick(cosine: number, refIdx: number): number {
  const r0 = ((1 - refIdx) / (1 + refIdx)) ** 2
  return r0 + (1 - r0) * (1 - cosine) ** 5
}

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
export const saturate = (a: Vec3): Vec3 => v3(clamp01(a.x), clamp01(a.y), clamp01(a.z))
