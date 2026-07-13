// Shared helpers for the asset scripts: render a tree to an indexed frame and
// compose RGB PNGs (the runtime encoder is indexed-only; collages need RGB).
const path = require('path');
const zlib = require('zlib');
const root = path.join(__dirname, '..');
const { deriveDna } = require(path.join(root, 'dist/src/dna'));
const { makeRng } = require(path.join(root, 'dist/src/seed'));
const { buildSkeleton } = require(path.join(root, 'dist/src/skeleton'));
const { applyThickness } = require(path.join(root, 'dist/src/thickness'));
const { renderFrame } = require(path.join(root, 'dist/src/render'));
const { buildPalette } = require(path.join(root, 'dist/src/palette'));

const SIZE = 256;
const BG = [244, 239, 229];

function tree(metrics, season = 'summer') {
  const rng = makeRng(metrics.username.toLowerCase());
  const dna = deriveDna(metrics, rng);
  const skel = buildSkeleton(dna, rng);
  applyThickness(skel, dna);
  const pal = buildPalette(dna.palettes, dna.species, season);
  const frame = renderFrame(dna, skel, { growthT: 1, windPhase: null });
  return { frame, pal, dna };
}

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function pngRGB(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Fill a canvas buffer with the parchment background. */
function canvas(w, h) {
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    rgb[i * 3] = BG[0];
    rgb[i * 3 + 1] = BG[1];
    rgb[i * 3 + 2] = BG[2];
  }
  return rgb;
}

/** Blit an indexed frame onto an RGB canvas at (gx, gy), integer-upscaled. */
function blit(rgb, W, frame, pal, gx, gy, scale) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const ci = frame.color[y * SIZE + x];
      if (ci === 0) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const o = ((gy + y * scale + sy) * W + gx + x * scale + sx) * 3;
          rgb[o] = pal[ci * 3];
          rgb[o + 1] = pal[ci * 3 + 1];
          rgb[o + 2] = pal[ci * 3 + 2];
        }
      }
    }
  }
}

module.exports = { SIZE, BG, tree, pngRGB, canvas, blit };
