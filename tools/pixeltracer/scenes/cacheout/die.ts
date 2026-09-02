import type { Scene } from '../../src/scene.ts'
import type { Vec3 } from '../../src/vec3.ts'
import type { Primitive } from '../../src/primitives.ts'
import { Box, Group, Sphere, Transformed } from '../../src/primitives.ts'
import { lambert } from '../../src/materials.ts'
import { v3 } from '../../src/vec3.ts'
import { c, studio } from './_studio.ts'

const HALF = 0.5
const PIP_R = 0.1

const PIP_OUT = HALF - PIP_R * 0.7
const SPREAD = 0.26

const LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [-1, 1],
    [0, 0],
    [1, -1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
}

const FACES: { axis: 0 | 1 | 2; sign: 1 | -1; count: number }[] = [
  { axis: 2, sign: 1, count: 1 },
  { axis: 2, sign: -1, count: 6 },
  { axis: 0, sign: 1, count: 3 },
  { axis: 0, sign: -1, count: 4 },
  { axis: 1, sign: 1, count: 5 },
  { axis: 1, sign: -1, count: 2 },
]

function pipCenter(axis: 0 | 1 | 2, sign: number, a: number, b: number): Vec3 {
  const u = a * SPREAD
  const w = b * SPREAD
  if (axis === 0) return v3(sign * PIP_OUT, u, w)
  if (axis === 1) return v3(u, sign * PIP_OUT, w)
  return v3(u, w, sign * PIP_OUT)
}

export function die(rotate: Vec3 = v3(0.42, 0.7, 0.12), aspect = 1): Scene {
  const bodyMat = lambert(c('white'), { specular: 0.5, shininess: 64, reflectivity: 0.08 })
  const pipMat = lambert(c('chip-red'), { specular: 0.35, shininess: 40 })

  const parts: Primitive[] = [new Box(v3(0, 0, 0), v3(1, 1, 1), bodyMat)]
  for (const face of FACES) {
    for (const [a, b] of LAYOUTS[face.count]) {
      parts.push(new Sphere(pipCenter(face.axis, face.sign, a, b), PIP_R, pipMat))
    }
  }

  return studio({
    objects: [new Transformed(new Group(parts), { rotate })],
    pitch: 0.42,
    distance: 10,
    fovDeg: 15,
    aspect,
  })
}

export const build = (aspect = 1): Scene => die(undefined, aspect)
