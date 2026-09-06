import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rgbToOklab, labDist2, srgbToLinear, linearToSrgb } from '../src/oklab.ts'
import { bayerMatrix, quantize, preparePalette, nearestTwo } from '../src/quantize.ts'
import { CACHE_OUT, PICO8, hexToRgb, rgbToHex, paletteBytes, color } from '../src/palette.ts'
import { upscaleNearest } from '../src/upscale.ts'
import { encodePng, decodePng } from '../src/png.ts'

test('palette entries are unique and well formed', () => {
  for (const p of [CACHE_OUT, PICO8]) {
    const names = p.entries.map((e) => e.name)
    const hexes = p.entries.map((e) => e.hex)
    assert.equal(new Set(names).size, names.length, `${p.name} has duplicate names`)
    assert.equal(new Set(hexes).size, hexes.length, `${p.name} has duplicate colours`)
    for (const h of hexes) assert.match(h, /^#[0-9a-f]{6}$/)
  }
  assert.equal(paletteBytes(CACHE_OUT).length, CACHE_OUT.entries.length * 3)
})

test('colour lookup throws on a typo rather than rendering black', () => {
  assert.doesNotThrow(() => color(CACHE_OUT, 'hot-pink'))
  assert.throws(() => color(CACHE_OUT, 'hot-pinkk'), /no colour/)
})

test('hex round-trips through rgb', () => {
  assert.equal(rgbToHex(...hexToRgb('#ff2d95')), '#ff2d95')
})

test('sRGB transfer function round-trips', () => {
  for (const v of [0, 0.02, 0.5, 0.9, 1]) {
    assert.ok(Math.abs(linearToSrgb(srgbToLinear(v)) - v) < 1e-12)
  }
})

test('OKLab anchors black at 0 and white at 1', () => {
  assert.ok(Math.abs(rgbToOklab(0, 0, 0).L) < 1e-9)
  assert.ok(Math.abs(rgbToOklab(1, 1, 1).L - 1) < 1e-4)
})

test('OKLab distance orders colours the way a person would', () => {
  const red = rgbToOklab(1, 0, 0)

  assert.ok(labDist2(red, rgbToOklab(1, 0.5, 0)) < labDist2(red, rgbToOklab(0, 1, 1)))

  assert.ok(labDist2(red, rgbToOklab(0.5, 0, 0)) < labDist2(red, rgbToOklab(1, 1, 1)))
})

test('bayer matrices are exact permutations of 0..n^2-1', () => {
  for (const size of [2, 4, 8]) {
    const flat = bayerMatrix(size)
      .flat()
      .sort((a, b) => a - b)
    assert.equal(flat.length, size * size)
    assert.deepEqual(
      flat,
      Array.from({ length: size * size }, (_, i) => i),
    )
  }
})

test('bayer4 matches the canonical matrix', () => {
  assert.deepEqual(bayerMatrix(4), [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ])
})

test('nearestTwo returns distinct indices and the closest distance', () => {
  const pal = preparePalette(CACHE_OUT)
  const exact = rgbToOklab(...(hexToRgb('#ff2d95').map((v) => v / 255) as [number, number, number]))
  const [i0, i1, d0] = nearestTwo(pal, exact)
  assert.equal(CACHE_OUT.entries[i0].hex, '#ff2d95')
  assert.notEqual(i0, i1)
  assert.ok(d0 < 1e-6, 'an exact palette colour must have ~zero distance to itself')
})

test('every quantised pixel is a palette member, dithered or not', () => {
  const W = 64
  const H = 16
  const buf = new Uint8Array(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      buf[i] = (x / (W - 1)) * 255
      buf[i + 1] = (y / (H - 1)) * 255
      buf[i + 2] = 128
      buf[i + 3] = 255
    }
  }
  const allowed = new Set(CACHE_OUT.entries.map((e) => hexToRgb(e.hex).join(',')))
  for (const dither of ['none', 'bayer2', 'bayer4', 'bayer8'] as const) {
    const q = quantize(buf, W, H, { palette: CACHE_OUT, dither, strength: 1, snapThreshold: 0 })
    for (let i = 0; i < q.length; i += 4) {
      assert.ok(
        allowed.has(`${q[i]},${q[i + 1]},${q[i + 2]}`),
        `stray colour with dither=${dither}`,
      )
    }
  }
})

test('quantise preserves alpha untouched', () => {
  const buf = Uint8Array.from([200, 30, 90, 17, 10, 200, 40, 250])
  const q = quantize(buf, 2, 1, { palette: CACHE_OUT, dither: 'bayer4', strength: 1 })
  assert.equal(q[3], 17)
  assert.equal(q[7], 250)
})

test('snapThreshold suppresses dithering near a palette colour', () => {
  const [r, g, b] = hexToRgb('#ff2d95')
  const W = 8
  const buf = new Uint8Array(W * W * 4)
  for (let i = 0; i < W * W; i++) {
    buf[i * 4] = r - 3
    buf[i * 4 + 1] = g + 3
    buf[i * 4 + 2] = b - 3
    buf[i * 4 + 3] = 255
  }
  const snapped = quantize(buf, W, W, {
    palette: CACHE_OUT,
    dither: 'bayer4',
    strength: 1,
    snapThreshold: 0.2,
  })
  const distinct = new Set<string>()
  for (let i = 0; i < snapped.length; i += 4)
    distinct.add(`${snapped[i]},${snapped[i + 1]},${snapped[i + 2]}`)
  assert.equal(distinct.size, 1, 'a near-exact palette colour must not dither')
  assert.equal([...distinct][0], `${r},${g},${b}`)
})

test('nearest-neighbour upscale produces exact blocks', () => {
  const src = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255])
  const up = upscaleNearest(src, 2, 2, 3)
  assert.equal(up.width, 6)
  assert.equal(up.height, 6)
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const s = (((y / 3) | 0) * 2 + ((x / 3) | 0)) * 4
      const d = (y * 6 + x) * 4
      assert.equal(up.data[d], src[s])
      assert.equal(up.data[d + 3], src[s + 3])
    }
  }
})

test('upscale rejects non-integer factors that would blur the grid', () => {
  const src = new Uint8Array(4)
  assert.throws(() => upscaleNearest(src, 1, 1, 1.5), /positive integer/)
  assert.throws(() => upscaleNearest(src, 1, 1, 0), /positive integer/)
})

test('PNG encode/decode round-trips byte for byte', () => {
  const W = 57
  const H = 31
  const src = new Uint8Array(W * H * 4)
  let s = 12345
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let i = 0; i < src.length; i++) src[i] = (rnd() * 256) | 0
  const dec = decodePng(encodePng(src, W, H))
  assert.equal(dec.width, W)
  assert.equal(dec.height, H)
  assert.deepEqual(dec.data, src)
})

test('PNG encoder rejects a mismatched buffer length', () => {
  assert.throws(() => encodePng(new Uint8Array(10), 4, 4), /expected 64 bytes/)
})

test('decoder rejects a file that is not a PNG', () => {
  assert.throws(() => decodePng(Buffer.from('definitely not a png')), /bad signature/)
})
