import type { Vec3 } from './vec3.ts'
import type { Ray } from './ray.ts'
import type { Hit } from './primitives.ts'
import type { Scene } from './scene.ts'
import type { Rng } from './rng.ts'
import {
  add,
  clamp01,
  dot,
  len,
  mul,
  mulv,
  neg,
  norm,
  reflect,
  refract,
  schlick,
  sub,
  v3,
  ZERO,
} from './vec3.ts'
import { ray } from './ray.ts'
import { sampleTexture } from './materials.ts'

const EPS = 1e-4

export function band(x: number, bands: number): number {
  const c = clamp01(x)
  if (bands <= 0) return c
  if (bands === 1) return c > 0 ? 1 : 0
  return Math.round(c * (bands - 1)) / (bands - 1)
}

export function hitScene(scene: Scene, r: Ray, tMin: number, tMax: number): Hit | null {
  let best: Hit | null = null
  let closest = tMax
  for (const obj of scene.objects) {
    const h = obj.hit(r, tMin, closest)
    if (h) {
      closest = h.t
      best = h
    }
  }
  return best
}

function occluded(scene: Scene, origin: Vec3, dir: Vec3, dist: number): boolean {
  return hitScene(scene, ray(origin, dir), EPS, dist - EPS) !== null
}

function randomUnit(rng: Rng): Vec3 {
  for (;;) {
    const p = v3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1)
    const l2 = dot(p, p)
    if (l2 > 1e-6 && l2 <= 1) return mul(p, 1 / Math.sqrt(l2))
  }
}

function bandsFor(scene: Scene, hit: Hit): number {
  const override = hit.mat.celBands
  if (override !== undefined) return override
  return scene.shadeMode === 'dither' ? 0 : scene.celBands
}

function specularOnly(scene: Scene, hit: Hit, view: Vec3): Vec3 {
  const strength = hit.mat.specular ?? 0
  if (strength <= 0) return ZERO
  let out = ZERO
  for (const light of scene.lights) {
    const toLight = sub(light.pos, hit.p)
    const dist = len(toLight)
    const L = mul(toLight, 1 / dist)
    if (dot(hit.n, L) <= 0) continue
    if (occluded(scene, add(hit.p, mul(hit.n, EPS)), L, dist)) continue
    const falloff =
      light.radius && Number.isFinite(light.radius) ? 1 / (1 + (dist / light.radius) ** 2) : 1
    const H = norm(add(L, view))
    const spec = Math.pow(Math.max(0, dot(hit.n, H)), hit.mat.shininess ?? 32)
    out = add(out, mul(light.color, spec * strength * light.intensity * falloff))
  }
  return out
}

function directLight(scene: Scene, hit: Hit, view: Vec3, albedo: Vec3): Vec3 {
  const bands = bandsFor(scene, hit)

  const specBands = scene.shadeMode === 'cel' ? bands : 0

  let out = mulv(scene.ambient, albedo)

  for (const light of scene.lights) {
    const toLight = sub(light.pos, hit.p)
    const dist = len(toLight)
    const L = mul(toLight, 1 / dist)

    const ndl = dot(hit.n, L)
    if (ndl <= 0) continue

    const shadowOrigin = add(hit.p, mul(hit.n, EPS))
    if (occluded(scene, shadowOrigin, L, dist)) continue

    const falloff =
      light.radius && Number.isFinite(light.radius) ? 1 / (1 + (dist / light.radius) ** 2) : 1
    const energy = light.intensity * falloff

    const diffuse = band(ndl, bands) * energy
    out = add(out, mul(mulv(albedo, light.color), diffuse))

    const specStrength = hit.mat.specular ?? 0
    if (specStrength > 0) {
      const H = norm(add(L, view))
      const raw = Math.pow(Math.max(0, dot(hit.n, H)), hit.mat.shininess ?? 32)
      const spec = band(raw, specBands) * energy * specStrength
      out = add(out, mul(light.color, spec))
    }
  }
  return out
}

export function trace(scene: Scene, r: Ray, depth: number, rng: Rng): Vec3 {
  if (depth <= 0) return ZERO

  const hit = hitScene(scene, r, EPS, Infinity)
  if (!hit) return scene.background(r.dir)

  const mat = hit.mat
  if (mat.emissive) return mat.emissive

  const albedo = sampleTexture(mat.albedo, hit.u, hit.v, hit.p)
  const view = neg(r.dir)

  let color: Vec3

  if (mat.ior !== undefined) {
    const eta = hit.front ? 1 / mat.ior : mat.ior
    const cosine = Math.min(dot(view, hit.n), 1)
    const refracted = refract(r.dir, hit.n, eta)
    const goesMirror = refracted === null || schlick(cosine, mat.ior) > rng()
    const dir = goesMirror ? reflect(r.dir, hit.n) : refracted
    const origin = add(hit.p, mul(dir, EPS))
    color = add(
      mulv(albedo, trace(scene, ray(origin, dir), depth - 1, rng)),
      specularOnly(scene, hit, view),
    )
  } else {
    color = directLight(scene, hit, view, albedo)

    const refl = mat.reflectivity ?? 0
    if (refl > 0) {
      let dir = reflect(r.dir, hit.n)
      const rough = mat.roughness ?? 0
      if (rough > 0) dir = norm(add(dir, mul(randomUnit(rng), rough)))

      if (dot(dir, hit.n) > 0) {
        const origin = add(hit.p, mul(hit.n, EPS))
        const bounced = trace(scene, ray(origin, dir), depth - 1, rng)
        color = add(mul(color, 1 - refl), mul(mulv(bounced, albedo), refl))
      }
    }
  }

  if (scene.fog) {
    const f = 1 - Math.exp(-scene.fog.density * hit.t)
    color = add(mul(color, 1 - f), mul(scene.fog.color, f))
  }
  return color
}
