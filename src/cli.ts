#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { generate } from './index';
import { fetchMetrics, loadFixture, synthMetrics } from './data';
import { Metrics, Season } from './types';

const HELP = `git-bonsai — grow a deterministic pixel-art bonsai from a GitHub profile

Usage:
  git-bonsai --user <login> [--token <t>] [--out <dir>] [--scale <n>]
  git-bonsai --fixture <metrics.json> [--out <dir>]
  git-bonsai --synth <name> [--out <dir>]        offline demo (fake metrics)

Options:
  --user     GitHub login to fetch (needs --token or GITHUB_TOKEN env)
  --fixture  Path to a normalized metrics JSON (offline, reproducible)
  --synth    Fabricate deterministic demo metrics from a name (offline)
  --out      Output directory (default: output)
  --scale    Integer upscale factor for SVG/PNG (default: 3)
  --season   spring | summer | autumn | winter | auto (default: auto,
             derived from the metrics date — deterministic per input)

Outputs: bonsai.svg, bonsai.png, bonsai.gif (wind), bonsai-growth.gif (timelapse)
`;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    process.stdout.write(HELP);
    return;
  }
  const user = arg('user');
  const fixture = arg('fixture');
  const synth = arg('synth');
  const outDir = arg('out') ?? 'output';
  const scale = Number(arg('scale') ?? 3);
  const season = arg('season') ?? 'auto';
  if (!['spring', 'summer', 'autumn', 'winter', 'auto'].includes(season)) {
    process.stderr.write(`error: unknown season "${season}"\n`);
    process.exit(1);
  }

  let metrics: Metrics;
  if (fixture) {
    metrics = loadFixture(fixture);
  } else if (synth) {
    metrics = synthMetrics(synth);
  } else if (user) {
    const token = arg('token') ?? process.env.GITHUB_TOKEN;
    if (!token) {
      process.stderr.write('error: --token or GITHUB_TOKEN is required with --user\n');
      process.exit(1);
    }
    metrics = await fetchMetrics(user, token);
  } else {
    process.stderr.write(HELP);
    process.exit(1);
  }

  const started = Date.now();
  const out = generate(metrics, { scale, season: season as Season | 'auto' });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'bonsai.svg'), out.svg);
  fs.writeFileSync(path.join(outDir, 'bonsai.png'), out.png);
  fs.writeFileSync(path.join(outDir, 'bonsai.gif'), out.gif);
  fs.writeFileSync(path.join(outDir, 'bonsai-growth.gif'), out.growthGif);

  const kb = (b: Buffer | string): string =>
    `${(Buffer.byteLength(b) / 1024).toFixed(1)} KB`;
  process.stdout.write(
    `grew a ${out.dna.style} bonsai for ${metrics.username} in ${Date.now() - started} ms\n` +
    `  ${outDir}/bonsai.svg         ${kb(out.svg)}\n` +
    `  ${outDir}/bonsai.png         ${kb(out.png)}\n` +
    `  ${outDir}/bonsai.gif         ${kb(out.gif)}\n` +
    `  ${outDir}/bonsai-growth.gif  ${kb(out.growthGif)}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
