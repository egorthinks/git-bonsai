#!/usr/bin/env node
// Composes assets/social-preview.png (1280x640, GitHub's social-card size)
// from the Hall of Fame trees. Upload it in Settings -> Social preview so the
// repo link unfurls into a forest on X/Slack/Discord.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { loadFixture } = require(path.join(root, 'dist/src/data'));
const { SIZE, tree, pngRGB, canvas, blit } = require('./pnglib');

const W = 1280;
const H = 640;
// two rows of five: the most recognizable histories first
const PICKS = [
  'torvalds', 'gvanrossum', 'gaearon', 'yyx990803', 'sindresorhus',
  'mitchellh', 'antirez', 'karpathy', 'tj', 'claude',
];

const hallDir = path.join(root, 'fixtures', 'hall');
const logins = PICKS.filter((l) => fs.existsSync(path.join(hallDir, l + '.json')));
// fall back to the showcase fixtures so the banner builds even pre-harvest
for (const extra of ['veteran', 'hanami', 'iron-root', 'storm-rider', 'clockwork',
  'twin-keeper', 'clump-forge', 'monolith-mike', 'acme-org', 'shibui']) {
  if (logins.length >= 10) break;
  if (fs.existsSync(path.join(root, 'fixtures', extra + '.json'))) logins.push(extra);
}

const rgb = canvas(W, H);
const cols = 5;
const cell = SIZE; // scale 1: 5 x 256 = 1280 exactly, two rows = 512 + margins
const marginY = Math.floor((H - cell * 2) / 3);
logins.slice(0, 10).forEach((login, i) => {
  const fixture = fs.existsSync(path.join(hallDir, login + '.json'))
    ? path.join(hallDir, login + '.json')
    : path.join(root, 'fixtures', login + '.json');
  const { frame, pal } = tree(loadFixture(fixture));
  const gx = (i % cols) * cell;
  const gy = marginY + Math.floor(i / cols) * (cell + marginY);
  blit(rgb, W, frame, pal, gx, gy, 1);
});

fs.writeFileSync(path.join(root, 'assets', 'social-preview.png'), pngRGB(rgb, W, H));
console.log(`wrote assets/social-preview.png (${W}x${H}) with ${Math.min(10, logins.length)} trees`);
