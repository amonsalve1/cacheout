import { test } from 'node:test'
import assert from 'node:assert/strict'
import { v3, len, dot, norm, reflect, refract, schlick, cross } from '../src/vec3.ts'
import {
  Sphere,
  Plane,
  Box,
  Cylinder,
  Transformed,
  rotationXYZ,
  mat3Mul,
  mat3T,
} from '../src/primitives.ts'
import { lambert } from '../src/materials.ts'
import { band } from '../src/trace.ts'

const MAT = lambert(v3(1, 1, 1))
const shoot = (o: ReturnType<typeof v3>, d: ReturnType<typeof v3>) => ({ origin: o, dir: d })
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

test('ray-sphere intersection matches the analytic solution', () => {
  const s = new Sphere(v3(0, 0, -5), 1, MAT)

  const h = s.hit(shoot(v3(0, 0, 0), v3(0, 0, -1)), 1e-4, Infinity)
  assert.ok(h)
  assert.ok(near(h.t, 4))
  assert.ok(near(h.n.z, 1))
  assert.equal(h.front, true)
})

test('ray-sphere returns the far root when the origin is inside', () => {
  const s = new Sphere(v3(0, 0, 0), 2, MAT)
  const h = s.hit(shoot(v3(0, 0, 0), v3(0, 0, -1)), 1e-4, Infinity)
  assert.ok(h)
  assert.ok(near(h.t, 2))

  assert.equal(h.front, false)
  assert.ok(near(h.n.z, 1))
})

test('ray-sphere grazes tangentially and misses cleanly', () => {
  const s = new Sphere(v3(0, 0, -5), 1, MAT)
  assert.ok(near(s.hit(shoot(v3(1, 0, 0), v3(0, 0, -1)), 1e-4, Infinity)!.t, 5))
  assert.equal(s.hit(shoot(v3(1.001, 0, 0), v3(0, 0, -1)), 1e-4, Infinity), null)
})

test('ray-plane intersection and parallel miss', () => {
  const p = new Plane(v3(0, 0, 0), v3(0, 1, 0), MAT)
  assert.ok(near(p.hit(shoot(v3(0, 3, 0), v3(0, -1, 0)), 1e-4, Infinity)!.t, 3))
  assert.equal(p.hit(shoot(v3(0, 3, 0), v3(1, 0, 0)), 1e-4, Infinity), null)
})

test('box slab intersection reports the correct face normal', () => {
  const b = new Box(v3(0, 0, 0), v3(2, 2, 2), MAT)
  const h = b.hit(shoot(v3(0, 0, 5), v3(0, 0, -1)), 1e-4, Infinity)
  assert.ok(h)
  assert.ok(near(h.t, 4))
  assert.ok(near(h.n.z, 1))
})

test('cylinder hits side and cap, and misses above the cap', () => {
  const c = new Cylinder(v3(0, 0, 0), 1, 2, MAT)
  assert.ok(near(c.hit(shoot(v3(0, 0, 5), v3(0, 0, -1)), 1e-4, Infinity)!.t, 4))
  const cap = c.hit(shoot(v3(0, 5, 0), v3(0, -1, 0)), 1e-4, Infinity)!
  assert.ok(near(cap.t, 4))
  assert.ok(near(cap.n.y, 1))

  assert.ok(near(cap.u, 0.5) && near(cap.v, 0.5))
  assert.equal(c.hit(shoot(v3(0, 3, 5), v3(0, 0, -1)), 1e-4, Infinity), null)
})

test('cylinder uses the cap material only on the ends', () => {
  const side = lambert(v3(1, 0, 0))
  const cap = lambert(v3(0, 1, 0))
  const c = new Cylinder(v3(0, 0, 0), 1, 2, side, cap)
  assert.equal(c.hit(shoot(v3(0, 0, 5), v3(0, 0, -1)), 1e-4, Infinity)!.mat, side)
  assert.equal(c.hit(shoot(v3(0, 5, 0), v3(0, -1, 0)), 1e-4, Infinity)!.mat, cap)
})

test('rotation matrices are orthonormal and transpose-invertible', () => {
  const R = rotationXYZ(0.3, -0.7, 1.1)
  const v = v3(1, 2, 3)
  const r = mat3Mul(R, v)
  assert.ok(near(len(r), len(v), 1e-12))
  const back = mat3Mul(mat3T(R), r)
  assert.ok(near(back.x, 1, 1e-12) && near(back.y, 2, 1e-12) && near(back.z, 3, 1e-12))
})

test('a rotated+translated sphere matches an untransformed one in place', () => {
  const plain = new Sphere(v3(0, 0, -5), 1, MAT)
  const moved = new Transformed(new Sphere(v3(0, 0, 0), 1, MAT), {
    rotate: v3(0.4, 0.9, 0.2),
    translate: v3(0, 0, -5),
  })
  const a = plain.hit(shoot(v3(0, 0, 0), v3(0, 0, -1)), 1e-4, Infinity)!
  const b = moved.hit(shoot(v3(0, 0, 0), v3(0, 0, -1)), 1e-4, Infinity)!
  assert.ok(near(a.t, b.t, 1e-9))
  assert.ok(near(a.n.z, b.n.z, 1e-9))
})

test('reflect mirrors about the normal and preserves length', () => {
  const d = norm(v3(1, -1, 0))
  const r = reflect(d, v3(0, 1, 0))
  assert.ok(near(r.y, -d.y, 1e-12))
  assert.ok(near(len(r), 1, 1e-12))
})

test('refract returns null under total internal reflection', () => {
  const shallow = norm(v3(1, -0.05, 0))
  assert.equal(refract(shallow, v3(0, 1, 0), 1.5), null)

  assert.notEqual(refract(v3(0, -1, 0), v3(0, 1, 0), 1 / 1.5), null)
})

test('schlick is bounded and rises toward grazing angles', () => {
  const headon = schlick(1, 1.5)
  const grazing = schlick(0, 1.5)
  assert.ok(headon >= 0 && headon < 0.1)
  assert.ok(near(grazing, 1, 1e-9))
})

test('cross product is perpendicular to both inputs', () => {
  const a = v3(1, 2, 3)
  const b = v3(-2, 0.5, 4)
  const c = cross(a, b)
  assert.ok(near(dot(c, a), 0, 1e-12) && near(dot(c, b), 0, 1e-12))
})

test('band quantises into exactly N levels spanning 0..1', () => {
  const levels = new Set(Array.from({ length: 101 }, (_, i) => band(i / 100, 4)))
  assert.equal(levels.size, 4)
  assert.ok(levels.has(0) && levels.has(1))

  assert.equal(band(0.37, 0), 0.37)
})
