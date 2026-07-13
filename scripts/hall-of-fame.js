#!/usr/bin/env node
// Builds HALL_OF_FAME.md: fetches public metrics for a roster of well-known
// accounts, caches them as fixtures (so renders stay reproducible), renders
// each tree and rewrites the markdown.
//
//   node scripts/hall-of-fame.js --token <PAT>     fetch missing + render all
//   node scripts/hall-of-fame.js --refresh --token <PAT>   re-fetch everyone
//   node scripts/hall-of-fame.js                   offline: render from fixtures
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { generate } = require(path.join(root, 'dist/src/index'));
const { fetchMetrics, loadFixture } = require(path.join(root, 'dist/src/data'));

const ROSTER = [
  { login: 'torvalds', caption: 'Linus Torvalds — Linux, git' },
  { login: 'gvanrossum', caption: 'Guido van Rossum — Python' },
  { login: 'antirez', caption: 'Salvatore Sanfilippo — Redis' },
  { login: 'gaearon', caption: 'Dan Abramov — React, Redux' },
  { login: 'yyx990803', caption: 'Evan You — Vue, Vite' },
  { login: 'sindresorhus', caption: 'Sindre Sorhus — 1000+ npm packages' },
  { login: 'mitchellh', caption: 'Mitchell Hashimoto — Terraform, Vagrant, Ghostty' },
  { login: 'karpathy', caption: 'Andrej Karpathy — deep learning' },
];

const STYLE_JP = {
  formal: 'chokkan (formal upright)',
  slanted: 'shakan (slanting)',
  'han-kengai': 'han-kengai (semi-cascade)',
  cascade: 'kengai (cascade)',
  bunjin: 'bunjingi (literati)',
  windswept: 'fukinagashi (windswept)',
  broom: 'hokidachi (broom)',
  sokan: 'sokan (twin trunk)',
  kabudachi: 'kabudachi (clump)',
  'yose-ue': 'yose-ue (forest)',
  sekijoju: 'sekijoju (root over rock)',
};
const SPECIES_NAME = {
  pine: 'pine (matsu)', maple: 'maple (momiji)', cherry: 'cherry (sakura)',
  juniper: 'juniper (shimpaku)', elm: 'elm (zelkova)',
};

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const token = arg('token') ?? process.env.GITHUB_TOKEN;
  const refresh = process.argv.includes('--refresh');
  const fixDir = path.join(root, 'fixtures', 'hall');
  const imgDir = path.join(root, 'assets', 'hall');
  fs.mkdirSync(fixDir, { recursive: true });
  fs.mkdirSync(imgDir, { recursive: true });

  const entries = [];
  for (const { login, caption } of ROSTER) {
    const fixture = path.join(fixDir, login + '.json');
    if ((refresh || !fs.existsSync(fixture)) && token) {
      process.stdout.write(`fetching ${login} ...\n`);
      try {
        const metrics = await fetchMetrics(login, token);
        fs.writeFileSync(fixture, JSON.stringify(metrics, null, 2));
      } catch (err) {
        process.stderr.write(`  skipping ${login}: ${err.message}\n`);
      }
    }
    if (!fs.existsSync(fixture)) {
      process.stderr.write(`no fixture for ${login} (need --token to fetch)\n`);
      continue;
    }
    const metrics = loadFixture(fixture);
    // summer pin: the hall is a stable exhibition, not a seasonal display
    const out = generate(metrics, { scale: 2, season: 'summer' });
    fs.writeFileSync(path.join(imgDir, login + '.png'), out.png);
    entries.push({ login, caption, dna: out.dna, metrics });
    process.stdout.write(`rendered ${login}: ${out.dna.style} ${out.dna.species}\n`);
  }

  const md = ['# 🏛 Bonsai Hall of Fame', '',
    'Trees grown from the **public** GitHub history of people whose work shaped',
    'how we all write software. Same rules as everyone: nothing here is drawn by',
    'hand — every trunk, scar and blossom is earned. Regenerate any time with',
    '`node scripts/hall-of-fame.js --token <PAT>` (metrics are cached under',
    '`fixtures/hall/`, so the gallery is reproducible bit-for-bit).', ''];
  for (const { login, caption, dna, metrics } of entries) {
    const years = dna.ageYears.toFixed(0);
    md.push(`## [@${login}](https://github.com/${login})`, '',
      `*${caption}*`, '',
      `<img src="assets/hall/${login}.png" width="384" alt="git-bonsai of ${login}" />`, '',
      `**${STYLE_JP[dna.style] ?? dna.style}** · ${SPECIES_NAME[dna.species] ?? dna.species} · ` +
      `${years} years · ${metrics.totalContributions.toLocaleString('en-US')} public contributions` +
      (dna.sumo ? ' · **sumo trunk**' : '') +
      (dna.shari ? ' · *shari*' : '') + (dna.uro ? ' · *uro*' : '') +
      (dna.flowers > 0 ? ` · ${dna.flowers} 🌸` : ''), '');
  }
  md.push('---', '',
    '*Grow your own: see the [README](README.md). Post it with **#gitbonsai** —',
    'maybe your tree belongs here too.*', '');
  fs.writeFileSync(path.join(root, 'HALL_OF_FAME.md'), md.join('\n'));
  process.stdout.write(`HALL_OF_FAME.md written with ${entries.length} trees\n`);
}

main().catch((err) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
