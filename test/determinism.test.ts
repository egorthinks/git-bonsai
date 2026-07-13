import { test } from 'node:test';
import * as assert from 'node:assert';
import * as path from 'path';
import { generate } from '../src/index';
import { loadFixture, synthMetrics } from '../src/data';

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures');
const veteran = () => loadFixture(path.join(FIXTURES, 'veteran.json'));
const young = () => loadFixture(path.join(FIXTURES, 'young.json'));

test('same input produces bit-identical output', () => {
  const a = generate(veteran());
  const b = generate(veteran());
  assert.strictEqual(a.svg, b.svg);
  assert.ok(a.png.equals(b.png), 'png differs between runs');
  assert.ok(a.gif.equals(b.gif), 'wind gif differs between runs');
  assert.ok(a.growthGif.equals(b.growthGif), 'growth gif differs between runs');
});

test('different usernames produce visibly different trees', () => {
  const a = generate(synthMetrics('alice'));
  const b = generate(synthMetrics('bob'));
  assert.ok(!a.png.equals(b.png), 'different users grew identical trees');
  assert.ok(!a.gif.equals(b.gif));
});

test('older & more active accounts grow bigger, denser trees', () => {
  const old = generate(veteran());
  const fresh = generate(young());
  // compressed PNG size is a rough but monotonic proxy for visual mass/complexity
  const mass = (png: Buffer): number => png.length;
  assert.ok(old.dna.iterations > fresh.dna.iterations, 'veteran should have more growth iterations');
  assert.ok(old.dna.trunkLen > fresh.dna.trunkLen, 'veteran should have a taller trunk');
  assert.ok(old.dna.baseRadius > fresh.dna.baseRadius, 'veteran should have a thicker base');
  assert.ok(mass(old.png) > mass(fresh.png) * 1.05, 'veteran tree should be visually denser');
});

test('streak milestones bloom and gaps leave deadwood', () => {
  const dna = generate(veteran()).dna;
  assert.ok(dna.flowers >= 4, `expected blossoms for a 142-day max streak, got ${dna.flowers}`);
  assert.ok(dna.deadRatio > 0, 'expected deadwood for 60d+ gaps');
  const freshDna = generate(young()).dna;
  assert.strictEqual(freshDna.deadRatio, 0);
});

test('outputs fit README budgets', () => {
  const out = generate(veteran());
  assert.ok(out.gif.length < 2 * 1024 * 1024, `wind gif too big: ${out.gif.length}`);
  assert.ok(out.growthGif.length < 3 * 1024 * 1024, `growth gif too big: ${out.growthGif.length}`);
  assert.ok(out.svg.length < 1024 * 1024, `svg too big: ${out.svg.length}`);
  assert.ok(out.gif.subarray(0, 6).toString('ascii') === 'GIF89a');
  assert.ok(out.png.subarray(1, 4).toString('ascii') === 'PNG');
});

test('repo concentration earns the multi-trunk styles', () => {
  const style = (name: string) =>
    generate(loadFixture(path.join(FIXTURES, name + '.json'))).dna;
  assert.strictEqual(style('twin-keeper').style, 'sokan');
  assert.strictEqual(style('twin-keeper').trunks.length, 2);
  assert.strictEqual(style('clump-forge').style, 'kabudachi');
  assert.ok(style('clump-forge').trunks.length >= 3);
  assert.strictEqual(style('monolith-mike').style, 'sekijoju');
  assert.ok(style('monolith-mike').rock);
  assert.strictEqual(style('acme-org').style, 'yose-ue');
  assert.ok(style('acme-org').trunks.length >= 5);
  // size classes: a young account sits in a small pot
  assert.strictEqual(style('tiny-sprout').sizeClass, 'shohin');
  assert.strictEqual(generate(veteran()).dna.sizeClass, 'dai');
});

test('seasons shift the leaves deterministically, keeping hue identity', () => {
  const summerA = generate(veteran(), { season: 'summer' });
  const summerB = generate(veteran(), { season: 'summer' });
  assert.ok(summerA.png.equals(summerB.png), 'same season must be bit-identical');
  for (const season of ['spring', 'autumn', 'winter'] as const) {
    const other = generate(veteran(), { season });
    assert.ok(!other.png.equals(summerA.png), `${season} should differ from summer`);
  }
  // identity: the TypeScript-blue top ramp keeps blue dominant in autumn
  const { seasonize } = require('../src/palette');
  const [r, g, b] = seasonize([92, 180, 221], 'autumn');
  assert.ok(b > r, 'autumn must not turn a blue crown warm-brown');
});

test('the image box adapts to the tree: small bonsai, small canvas', () => {
  const dims = (png: Buffer) => ({ w: png.readUInt32BE(16), h: png.readUInt32BE(20) });
  const big = dims(generate(veteran()).png);
  const small = dims(generate(young()).png);
  assert.ok(small.h < big.h, `young tree should ship in a shorter box (${small.h} vs ${big.h})`);
  assert.ok(small.w <= big.w, 'young tree should not be wider than the veteran');
  assert.ok(big.w <= 256 * 3 && big.h <= 256 * 3, 'crop must never exceed the native stage');
  // the wind gif shares the same crop box as the png (GIF header is little-endian)
  const gif = generate(young()).gif;
  assert.strictEqual(gif.readUInt16LE(6) * 3, small.w, 'gif and png must share one crop width');
});

test('runs fast enough for a CI budget', () => {
  const started = Date.now();
  generate(veteran());
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 30_000, `generation took ${elapsed} ms`);
});
