#!/usr/bin/env node
// Regenerates every image in assets/ from the fixtures — run after visual
// changes to the engine: `npm run build && node scripts/render-assets.js`.
// Grid PNGs are composed here (RGB), single renders come from generate().
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { generate } = require(path.join(root, 'dist/src/index'));
const { loadFixture } = require(path.join(root, 'dist/src/data'));
const { SIZE, tree, pngRGB, canvas, blit } = require('./pnglib');

const assets = path.join(root, 'assets');
const fx = (n) => path.join(root, 'fixtures', n + '.json');

/** cells: { fixture, season?, username? } — username overrides the seed. */
function grid(cells, cols, out, scale = 2) {
  const cw = SIZE * scale;
  const rows = Math.ceil(cells.length / cols);
  const W = cw * cols;
  const H = cw * rows;
  const rgb = canvas(W, H);
  cells.forEach((cell, idx) => {
    const metrics = loadFixture(fx(cell.fixture));
    if (cell.username) metrics.username = cell.username;
    const { frame, pal, dna } = tree(metrics, cell.season);
    console.log(`  ${metrics.username}${cell.season ? ' @' + cell.season : ''}: ${dna.style} ${dna.species} ${dna.sizeClass}`);
    blit(rgb, W, frame, pal, (idx % cols) * cw, Math.floor(idx / cols) * cw, scale);
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
