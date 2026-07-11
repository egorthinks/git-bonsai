import * as zlib from 'zlib';
import { TRANSPARENT } from './palette';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  const crcBuf = Buffer.alloc(4 + data.length);
  crcBuf.write(type, 0, 'ascii');
  Buffer.from(data).copy(crcBuf, 4);
  out.writeUInt32BE(crc32(crcBuf), 8 + data.length);
  return out;
}

/**
 * Encode an indexed frame as a truecolor+alpha PNG with integer nearest-
 * neighbor upscaling. Deterministic: fixed zlib level, no timestamps.
 */
export function encodePng(
  indices: Uint8Array, w: number, h: number,
  palette: Uint8Array, scale: number,
): Buffer {
  const ow = w * scale;
  const oh = h * scale;
  const raw = Buffer.alloc(oh * (1 + ow * 4));
  let p = 0;
  for (let y = 0; y < oh; y++) {
    raw[p++] = 0; // filter: none
    const sy = Math.floor(y / scale);
    for (let x = 0; x < ow; x++) {
      const idx = indices[sy * w + Math.floor(x / scale)];
      raw[p++] = palette[idx * 3];
      raw[p++] = palette[idx * 3 + 1];
      raw[p++] = palette[idx * 3 + 2];
      raw[p++] = idx === TRANSPARENT ? 0 : 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ow, 0);
  ihdr.writeUInt32BE(oh, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
