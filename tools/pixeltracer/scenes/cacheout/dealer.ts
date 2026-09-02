import type { Scene } from '../../src/scene.ts'
import type { Primitive } from '../../src/primitives.ts'
import { Box, Cylinder, Group, Sphere, Transformed } from '../../src/primitives.ts'
import { emissive, lambert, metal } from '../../src/materials.ts'
import { v3 } from '../../src/vec3.ts'
import { c, studio } from './_studio.ts'

export type Mood = 'idle' | 'smug' | 'gloating'

const MOODS: Record<Mood, { eye: string; radius: number; tilt: number; visor: string }> = {
  idle: { eye: 'cyan', radius: 0.115, tilt: 0, visor: 'navy' },

  smug: { eye: 'gold', radius: 0.09, tilt: -0.17, visor: 'bronze-dk' },

  gloating: { eye: 'hot-pink', radius: 0.145, tilt: 0.2, visor: 'magenta-dk' },
}

export function dealer(mood: Mood = 'idle', aspect = 1): Scene {
  const m = MOODS[mood]
  const shell = metal(c('chrome'), { reflectivity: 0.3, specular: 0.9, shininess: 120 })
  const dark = lambert(c('ink'), { specular: 0.4, shininess: 60 })
  const eye = emissive(c(m.eye))

  const head: Primitive[] = [
    new Box(v3(0, 0.5, 0), v3(1.05, 0.92, 0.85), shell),

    new Box(
      v3(0, 0.56, 0.44),
      v3(0.92, 0.4, 0.06),
      lambert(c(m.visor), { specular: 0.5, shininess: 70 }),
    ),
    new Sphere(v3(-0.23, 0.56, 0.48), m.radius, eye),
    new Sphere(v3(0.23, 0.56, 0.48), m.radius, eye),

    new Cylinder(v3(0, 1.08, -0.1), 0.035, 0.32, shell),
    new Sphere(v3(0, 1.28, -0.1), 0.085, eye),
  ]

  const body: Primitive[] = [
    new Cylinder(v3(0, -0.05, 0), 0.2, 0.5, shell),
    new Cylinder(v3(0, -0.85, 0), 0.62, 1.2, shell),
    new Sphere(v3(-0.66, -0.42, 0), 0.26, shell),
    new Sphere(v3(0.66, -0.42, 0), 0.26, shell),

    new Transformed(
      new Box(
        v3(0, 0, 0),
        v3(0.22, 0.26, 0.14),
        lambert(c('chip-red'), { specular: 0.5, shininess: 60 }),
      ),
      {
        rotate: v3(0, 0, 0.42),
        translate: v3(-0.17, -0.36, 0.56),
      },
    ),
    new Transformed(
      new Box(
        v3(0, 0, 0),
        v3(0.22, 0.26, 0.14),
        lambert(c('chip-red'), { specular: 0.5, shininess: 60 }),
      ),
      {
        rotate: v3(0, 0, -0.42),
        translate: v3(0.17, -0.36, 0.56),
      },
    ),
    new Sphere(v3(0, -0.36, 0.62), 0.08, dark),
  ]

  return studio({
    objects: [
      new Transformed(new Group(head), { rotate: v3(0, m.tilt, m.tilt * 0.45) }),
      new Group(body),
    ],
    target: v3(0, 0.18, 0),

    pitch: 0.24,
    yaw: 0.32,
    distance: 9.5,
    fovDeg: 16,
    aspect,
  })
}

export const MOOD_NAMES: Mood[] = ['idle', 'smug', 'gloating']
export const build = (aspect = 1): Scene => dealer('idle', aspect)
