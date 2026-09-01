export function upscaleNearest(
  rgba: Uint8Array,
  w: number,
  h: number,
  factor: number,
): { data: Uint8Array; width: number; height: number } {
  if (!Number.isInteger(factor) || factor < 1) {
    throw new Error(`upscale factor must be a positive integer, got ${factor}`)
  }
  const W = w * factor
  const H = h * factor
  const out = new Uint8Array(W * H * 4)

  for (let y = 0; y < H; y++) {
    const sy = (y / factor) | 0
    for (let x = 0; x < W; x++) {
      const sx = (x / factor) | 0
      const si = (sy * w + sx) * 4
      const di = (y * W + x) * 4
      out[di] = rgba[si]
      out[di + 1] = rgba[si + 1]
      out[di + 2] = rgba[si + 2]
      out[di + 3] = rgba[si + 3]
    }
  }
  return { data: out, width: W, height: H }
}
