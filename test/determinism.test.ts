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

test('runs fast enough for a CI budget', () => {
  const started = Date.now();
  generate(veteran());
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 30_000, `generation took ${elapsed} ms`);
});
