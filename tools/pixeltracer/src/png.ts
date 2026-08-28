import { deflateSync, inflateSync } from 'node:zlib'

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBytes, Buffer.from(data)])
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), body.length + 4)
  return out
}

export function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
  if (rgba.length !== width * height * 4) {
    throw new Error(`expected ${width * height * 4} bytes, got ${rgba.length}`)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc(height * (stride + 1))
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }

  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ])
}

export type DecodedPng = { width: number; height: number; data: Uint8Array }

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function decodePng(buf: Buffer): DecodedPng {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (buf[i] !== SIGNATURE[i]) throw new Error('not a PNG (bad signature)')
  }

  let pos = 8
  let width = 0
  let height = 0
  let channels = 4
  const idat: Buffer[] = []

  while (pos < buf.length) {
    const length = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + length)

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      const depth = data[8]
      const colorType = data[9]
      if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`)
      if (colorType !== 6 && colorType !== 2) {
        throw new Error(`unsupported colour type ${colorType}`)
      }
      channels = colorType === 6 ? 4 : 3
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported')
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
    pos += 12 + length
  }

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const recon = Buffer.alloc(height * stride)

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const dst = y * stride
    for (let x = 0; x < stride; x++) {
      const value = raw[src + x]
      const a = x >= channels ? recon[dst + x - channels] : 0
      const b = y > 0 ? recon[dst - stride + x] : 0
      const c = x >= channels && y > 0 ? recon[dst - stride + x - channels] : 0
      let out: number
      switch (filter) {
        case 0:
          out = value
          break
        case 1:
          out = value + a
          break
        case 2:
          out = value + b
          break
        case 3:
          out = value + ((a + b) >> 1)
          break
        case 4:
          out = value + paeth(a, b, c)
          break
        default:
          throw new Error(`unknown filter type ${filter} on row ${y}`)
      }
      recon[dst + x] = out & 0xff
    }
  }

  if (channels === 4) return { width, height, data: new Uint8Array(recon) }

  const rgba = new Uint8Array(width * height * 4)
  for (let i = 0, j = 0; i < width * height; i++, j += 3) {
    rgba[i * 4] = recon[j]
    rgba[i * 4 + 1] = recon[j + 1]
    rgba[i * 4 + 2] = recon[j + 2]
    rgba[i * 4 + 3] = 255
  }
  return { width, height, data: rgba }
}
