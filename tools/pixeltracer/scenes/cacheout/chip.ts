import type { Scene } from '../../src/scene.ts'
import { Cylinder, Transformed } from '../../src/primitives.ts'
import { chipFace, lambert } from '../../src/materials.ts'
import { v3 } from '../../src/vec3.ts'
import { c, studio } from './_studio.ts'

export const DENOMINATIONS = {
  white: { face: 'white', accent: 'chip-red', value: 1 },
  red: { face: 'chip-red', accent: 'white', value: 5 },
  blue: { face: 'blue', accent: 'ice', value: 10 },

  black: { face: 'dusk', accent: 'gold', value: 100 },
} as const

export type Denomination = keyof typeof DENOMINATIONS

export function chip(denom: Denomination, spin = 0, aspect = 1): Scene {
  const { face, accent } = DENOMINATIONS[denom]
  const body = new Cylinder(
    v3(0, 0, 0),
    1,
    0.3,

    lambert(c(face), { specular: 0.4, shininess: 56 }),

    lambert(chipFace(c(face), c(accent)), { specular: 0.5, shininess: 72, reflectivity: 0.12 }),
  )
  return studio({
    objects: [new Transformed(body, { rotate: v3(0.34, spin, 0.1) })],
    distance: 9,
    fovDeg: 15,
    aspect,
  })
}

export const build = (aspect = 1): Scene => chip('red', 0, aspect)
