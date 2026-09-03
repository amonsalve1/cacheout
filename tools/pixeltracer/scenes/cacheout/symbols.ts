import type { Scene } from '../../src/scene.ts'
import { Box, Cylinder, Group, Sphere, Transformed } from '../../src/primitives.ts'
import { lambert, metal } from '../../src/materials.ts'
import { v3 } from '../../src/vec3.ts'
import { c, studio } from './_studio.ts'

export function seven(aspect = 1): Scene {
  const gold = metal(c('gold'), { reflectivity: 0.35, specular: 0.9, shininess: 120 })
  const parts = [
    new Box(v3(-0.06, 0.66, 0), v3(1.2, 0.3, 0.26), gold),
    new Transformed(new Box(v3(0, 0, 0), v3(0.27, 1.4, 0.26), gold), {
      rotate: v3(0, 0, -0.26),
      translate: v3(0.24, -0.26, 0),
    }),
  ]
  return studio({
    objects: [new Transformed(new Group(parts), { rotate: v3(0, 0.25, 0) })],
    pitch: 0.2,
    distance: 10,
    fovDeg: 16,
    aspect,
  })
}

export function cherry(aspect = 1): Scene {
  const skin = lambert(c('chip-red'), { specular: 0.65, shininess: 90, reflectivity: 0.12 })
  const stem = lambert(c('felt-lit'), { specular: 0.3, shininess: 30 })
  const parts = [
    new Sphere(v3(-0.42, -0.42, 0.1), 0.46, skin),
    new Sphere(v3(0.46, -0.56, -0.12), 0.38, skin),
    new Transformed(new Cylinder(v3(0, 0, 0), 0.055, 1.15, stem), {
      rotate: v3(0.1, 0, 0.42),
      translate: v3(-0.2, 0.3, 0.08),
    }),
    new Transformed(new Cylinder(v3(0, 0, 0), 0.055, 1.0, stem), {
      rotate: v3(0.1, 0, -0.3),
      translate: v3(0.3, 0.24, -0.08),
    }),
    new Transformed(new Box(v3(0, 0, 0), v3(0.42, 0.09, 0.2), stem), {
      rotate: v3(0, 0, 0.25),
      translate: v3(0.06, 0.86, 0),
    }),
  ]
  return studio({
    objects: [new Group(parts)],
    pitch: 0.22,
    distance: 10,
    fovDeg: 17,
    aspect,
  })
}

export function bar(aspect = 1): Scene {
  const plate = metal(c('gold'), { reflectivity: 0.3, specular: 0.9, shininess: 110 })
  const inset = lambert(c('bronze-dk'), { specular: 0.2, shininess: 24 })
  const parts = [
    new Box(v3(0, 0, 0), v3(1.7, 0.78, 0.28), plate),
    new Box(v3(0, 0.2, 0.15), v3(1.24, 0.13, 0.06), inset),
    new Box(v3(0, -0.2, 0.15), v3(1.24, 0.13, 0.06), inset),
  ]
  return studio({
    objects: [new Transformed(new Group(parts), { rotate: v3(0, 0.3, 0) })],
    pitch: 0.28,
    distance: 10,
    fovDeg: 16,
    aspect,
  })
}

export function trophy(aspect = 1): Scene {
  const gold = metal(c('gold'), { reflectivity: 0.42, specular: 1, shininess: 140 })
  const dark = lambert(c('bronze-dk'), { specular: 0.4, shininess: 50 })
  const parts = [
    new Cylinder(v3(0, -1.0, 0), 0.66, 0.2, dark),
    new Cylinder(v3(0, -0.8, 0), 0.42, 0.22, gold),
    new Cylinder(v3(0, -0.44, 0), 0.12, 0.55, gold),

    new Cylinder(v3(0, -0.1, 0), 0.34, 0.2, gold),
    new Cylinder(v3(0, 0.1, 0), 0.5, 0.22, gold),
    new Cylinder(v3(0, 0.34, 0), 0.62, 0.28, gold),
    new Sphere(v3(-0.74, 0.28, 0), 0.15, gold),
    new Sphere(v3(0.74, 0.28, 0), 0.15, gold),
  ]
  return studio({
    objects: [new Group(parts)],
    pitch: 0.3,
    distance: 10.5,
    fovDeg: 17,
    aspect,
  })
}
