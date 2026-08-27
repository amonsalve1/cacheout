import type { Vec3 } from './vec3.ts'
import { v3 } from './vec3.ts'

export type Texture = Vec3 | ((u: number, v: number, p: Vec3) => Vec3)

export type Material = {
  albedo: Texture

  reflectivity?: number

  specular?: number

  shininess?: number

  ior?: number

  roughness?: number

  emissive?: Vec3

  celBands?: number
}

export function sampleTexture(t: Texture, u: number, v: number, p: Vec3): Vec3 {
  return typeof t === 'function' ? t(u, v, p) : t
}

export const lambert = (albedo: Texture, extra: Partial<Material> = {}): Material => ({
  albedo,
  specular: 0.15,
  shininess: 16,
  ...extra,
})

export const metal = (albedo: Texture, extra: Partial<Material> = {}): Material => ({
  albedo,
  reflectivity: 0.75,
  specular: 0.9,
  shininess: 128,
  roughness: 0,
  ...extra,
})

export const glass = (extra: Partial<Material> = {}): Material => ({
  albedo: v3(1, 1, 1),
  ior: 1.5,
  reflectivity: 1,
  specular: 1,
  shininess: 256,

  celBands: 0,
  ...extra,
})

export const emissive = (color: Vec3): Material => ({ albedo: color, emissive: color })

export function checker(a: Vec3, b: Vec3, scale = 1): Texture {
  return (_u: number, _v: number, p: Vec3): Vec3 => {
    const s = Math.floor(p.x * scale) + Math.floor(p.y * scale) + Math.floor(p.z * scale)
    return (s & 1) === 0 ? a : b
  }
}

export function stripes(a: Vec3, b: Vec3, count = 12): Texture {
  return (u: number, _v: number, _p: Vec3): Vec3 => ((Math.floor(u * count) & 1) === 0 ? a : b)
}

export function chipFace(face: Vec3, accent: Vec3, inner = 0.74, outer = 0.93): Texture {
  return (u: number, v: number, _p: Vec3): Vec3 => {
    const du = u - 0.5
    const dv = v - 0.5
    const r = Math.sqrt(du * du + dv * dv) / 0.5
    return r >= inner && r <= outer ? accent : face
  }
}

export function rings(a: Vec3, b: Vec3, scale = 8): Texture {
  return (u: number, v: number, _p: Vec3): Vec3 => {
    const du = u - 0.5
    const dv = v - 0.5
    const r = Math.sqrt(du * du + dv * dv)
    return (Math.floor(r * scale) & 1) === 0 ? a : b
  }
}
