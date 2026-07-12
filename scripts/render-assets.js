#!/usr/bin/env node
// Regenerates every image in assets/ from the fixtures — run after visual
// changes to the engine: `npm run build && node scripts/render-assets.js`.
// Grid PNGs are composed here (RGB), single renders come from generate().
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const root = path.join(__dirname, '..');
const { generate } = require(path.join(root, 'dist/src/index'));
const { loadFixture } = require(path.join(root, 'dist/src/data'));
const { deriveDna } = require(path.join(root, 'dist/src/dna'));
const { makeRng } = require(path.join(root, 'dist/src/seed'));
const { buildSkeleton } = require(path.join(root, 'dist/src/skeleton'));
const { applyThickness } = require(path.join(root, 'dist/src/thickness'));
const { renderFrame } = require(path.join(root, 'dist/src/render'));
const { buildPalette } = require(path.join(root, 'dist/src/palette'));

const SIZE = 256;
const BG = [244, 239, 229];
const assets = path.join(root, 'assets');
const fx = (n) => path.join(root, 'fixtures', n + '.json');

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

/** cells: { fixture, season?, username? } — username overrides the seed. */
function grid(cells, cols, out, scale = 2) {
  const cw = SIZE * scale;
  const rows = Math.ceil(cells.length / cols);
  const W = cw * cols;
  const H = cw * rows;
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    rgb[i * 3] = BG[0];
    rgb[i * 3 + 1] = BG[1];
    rgb[i * 3 + 2] = BG[2];
  }
  cells.forEach((cell, idx) => {
    const metrics = loadFixture(fx(cell.fixture));
    if (cell.username) metrics.username = cell.username;
    const { frame, pal, dna } = tree(metrics, cell.season);
    console.log(`  ${metrics.username}${cell.season ? ' @' + cell.season : ''}: ${dna.style} ${dna.species} ${dna.sizeClass}`);
    const gx = (idx % cols) * cw;
    const gy = Math.floor(idx / cols) * cw;
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
  });
  fs.writeFileSync(path.join(assets, out), pngRGB(rgb, W, H));
  console.log('wrote assets/' + out);
}

// --- singles: the README hero images ---
const vet = generate(loadFixture(fx('veteran')), { season: 'summer' });
fs.writeFileSync(path.join(assets, 'bonsai.svg'), vet.svg);
fs.writeFileSync(path.join(assets, 'bonsai.png'), vet.png);
fs.writeFileSync(path.join(assets, 'bonsai.gif'), vet.gif);
fs.writeFileSync(path.join(assets, 'bonsai-growth.gif'), vet.growthGif);
console.log('wrote assets/bonsai.{svg,png,gif} + bonsai-growth.gif');

const young = generate(loadFixture(fx('young')), { season: 'summer' });
fs.writeFileSync(path.join(assets, 'bonsai-young.png'), young.png);
const hanami = generate(loadFixture(fx('hanami')), { season: 'summer' });
fs.writeFileSync(path.join(assets, 'bonsai-sakura.gif'), hanami.gif);
console.log('wrote assets/bonsai-young.png + bonsai-sakura.gif');

// --- gallery: same metrics, six different seeds ---
grid(
  ['hanae', 'kaze', 'momiji', 'yuki', 'ren', 'sora'].map((username) => ({ fixture: 'hanami', username })),
  3, 'gallery.png',
);

// --- styles: earned single-trunk styles & species ---
grid([
  { fixture: 'clockwork' },   // broom / elm
  { fixture: 'storm-rider' }, // windswept / pine
  { fixture: 'shibui' },      // bunjin / pine
  { fixture: 'iron-root' },   // sumo + shari + uro / maple
  { fixture: 'hanami' },      // three-era cherry
  { fixture: 'veteran' },     // slanted veteran
], 3, 'styles.png');

// --- multi-trunk styles & size classes ---
grid([
  { fixture: 'twin-keeper' },   // sokan
  { fixture: 'clump-forge' },   // kabudachi
  { fixture: 'monolith-mike' }, // sekijoju
  { fixture: 'acme-org' },      // yose-ue
  { fixture: 'tiny-sprout' },   // shohin pot
  { fixture: 'veteran' },       // dai pot
], 3, 'styles-multi.png');

// --- one tree through the four seasons ---
grid(
  ['spring', 'summer', 'autumn', 'winter'].map((season) => ({ fixture: 'veteran', season })),
  4, 'seasons.png',
);
