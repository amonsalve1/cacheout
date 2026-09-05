import type { Scene } from '../../src/scene.ts'
import type { Material } from '../../src/materials.ts'
import type { Primitive } from '../../src/primitives.ts'
import type { Vec3 } from '../../src/vec3.ts'
import { defaults } from '../../src/scene.ts'
import { camera } from '../../src/camera.ts'
import { Box, Cylinder, Group, Plane, Sphere, Transformed } from '../../src/primitives.ts'
import { emissive, lambert, metal } from '../../src/materials.ts'
import { CACHE_OUT, color } from '../../src/palette.ts'
import { add, clamp01, lerp, mul, v3 } from '../../src/vec3.ts'

export const CONCEPT =
  'A neon strip at midnight: marquee arches, floating gold 7s and columns of ' +
  'neon burning in a black void, doubled in a wet mirror floor.'

const c = (name: string) => color(CACHE_OUT, name)

const neon = (name: string) => emissive(c(name))

const TAU = Math.PI * 2

function seven(size: number, mat: Material): Primitive {
  const th = 0.46 * size
  const bar = new Box(v3(0, 1.55 * size, 0), v3(2.2 * size, th, 0.42 * size), mat)
  const leg = new Transformed(
    new Box(v3(0, 0, 0), v3(th, 3.0 * size, 0.42 * size), mat),

    { rotate: v3(0, 0, -0.3), translate: v3(0.41 * size, 0, 0) },
  )
  return new Group([bar, leg])
}

function bulbArch(
  radius: number,
  z: number,
  count: number,
  bulbR: number,
  palette: string[],
): Primitive {
  const parts: Primitive[] = []
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1)
    const ang = Math.PI * (0.045 + 0.91 * u)
    parts.push(
      new Sphere(
        v3(Math.cos(ang) * radius, Math.sin(ang) * radius + 0.4, z),
        bulbR,
        neon(palette[i % palette.length]),
      ),
    )
  }
  return new Group(parts)
}

function slotCabinet(): Primitive {
  const shell = metal(c('velvet'), { reflectivity: 0.55, specular: 0.9, shininess: 160 })
  const reelZ = 1.26
  return new Group([
    new Box(v3(0, 2.6, 0), v3(3.6, 5.2, 2.4), shell),

    new Box(v3(-1.05, 3.15, reelZ), v3(0.86, 1.6, 0.1), neon('chip-red')),
    new Box(v3(0, 3.15, reelZ), v3(0.86, 1.6, 0.1), neon('ice')),
    new Box(v3(1.05, 3.15, reelZ), v3(0.86, 1.6, 0.1), neon('gold-lt')),

    new Box(v3(0, 5.6, 0), v3(4.1, 0.66, 0.9), neon('hot-pink')),
    new Box(v3(0, 0.3, 0.4), v3(4.1, 0.6, 2.0), neon('violet')),
    new Cylinder(v3(-1.95, 2.7, reelZ - 0.1), 0.17, 4.6, neon('cyan')),
    new Cylinder(v3(1.95, 2.7, reelZ - 0.1), 0.17, 4.6, neon('cyan')),
  ])
}

function chandelier(at: Vec3, spread: number, globeR: number, tint: string): Primitive {
  const parts: Primitive[] = [
    new Cylinder(v3(at.x, at.y + 3.4, at.z), 0.09, 6.8, neon('gold')),
    new Sphere(v3(at.x, at.y - 1.15, at.z), globeR * 1.15, neon('white')),
  ]
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4
    parts.push(
      new Sphere(
        v3(at.x + Math.cos(a) * spread, at.y, at.z + Math.sin(a) * spread),
        globeR,
        neon(i % 2 === 0 ? tint : 'gold-lt'),
      ),
    )
  }
  return new Group(parts)
}

const tube = (x: number, z: number, h: number, tint: string): Primitive =>
  new Cylinder(v3(x, h / 2 + 0.25, z), 0.26, h, neon(tint))

const railZ = (x: number, z: number, len: number, tint: string): Primitive =>
  new Transformed(new Cylinder(v3(0, 0, 0), 0.22, len, neon(tint)), {
    rotate: v3(Math.PI / 2, 0, 0),
    translate: v3(x, 0.32, z),
  })

let cached: Primitive[] | null = null

function room(): Primitive[] {
  if (cached) return cached

  const monolith = metal(c('ink'), { reflectivity: 0.5, specular: 0.85, shininess: 150 })

  const objects: Primitive[] = [
    new Plane(
      v3(0, 0, 0),
      v3(0, 1, 0),
      lambert(c('chrome-dim'), { reflectivity: 0.9, specular: 0.4, shininess: 320 }),
    ),

    bulbArch(9.2, -13.5, 13, 0.44, ['white', 'gold-lt']),
    bulbArch(13.5, -27, 11, 0.6, ['ice', 'white', 'hot-pink']),

    new Transformed(slotCabinet(), { rotate: v3(0, 0.3, 0), translate: v3(-8.0, 0, -5.0) }),

    new Cylinder(v3(-12.8, 3.1, -7.5), 0.95, 5.4, neon('magenta-dk')),
    new Cylinder(v3(-12.8, 6.4, -7.5), 0.68, 1.4, neon('hot-pink')),
    new Cylinder(v3(-12.8, 7.6, -7.5), 0.36, 1.2, neon('gold-lt')),
    tube(-11.5, -1.0, 8.5, 'cyan'),
    tube(-12.4, -11, 9.5, 'hot-pink'),
    tube(-10.6, -19, 11, 'amethyst'),
    tube(-15.5, -24, 12, 'cyan'),
    tube(-12.2, -30, 10, 'gold'),
    railZ(-7.4, -12, 22, 'hot-pink'),
    chandelier(v3(-6.6, 7.2, -9.5), 1.15, 0.56, 'ice'),
    new Box(v3(-16.5, 5.0, -17), v3(4.5, 10, 4.5), monolith),

    new Transformed(seven(1.85, neon('gold-lt')), {
      rotate: v3(0, -0.3, 0),
      translate: v3(8.9, 5.6, -6.5),
    }),
    new Transformed(seven(1.35, neon('gold')), {
      rotate: v3(0, -0.5, 0),
      translate: v3(13.2, 7.4, -15),
    }),
    new Transformed(seven(1.05, neon('chip-red-lt')), {
      rotate: v3(0, -0.15, 0),
      translate: v3(7.4, 9.6, -21),
    }),
    tube(9.2, -3.5, 8.5, 'hot-pink'),
    tube(9.4, -10.5, 10, 'cyan'),
    tube(12.8, -17.5, 12, 'gold'),
    tube(8.2, -25, 9.5, 'hot-pink'),
    tube(15.8, -31, 13, 'amethyst'),
    railZ(7.4, -12, 22, 'cyan'),
    chandelier(v3(6.9, 6.4, -14.5), 1.05, 0.5, 'pink-lt'),
    new Box(v3(17.5, 6.0, -22), v3(5, 12, 5), monolith),

    new Transformed(new Cylinder(v3(0, 0, 0), 0.22, 34, neon('hot-pink')), {
      rotate: v3(0, 0, Math.PI / 2),
      translate: v3(0, 0.55, -34),
    }),
  ]

  for (let k = 0; k < 4; k++) {
    const x = 5.5 + k * 3.4
    const tint = k % 2 === 0 ? 'gold-lt' : 'chip-red-lt'
    objects.push(new Sphere(v3(-x, 1.5, -37), 0.45, neon(tint)))
    objects.push(new Sphere(v3(x, 1.5, -37), 0.45, neon(tint)))
  }

  cached = objects
  return objects
}
