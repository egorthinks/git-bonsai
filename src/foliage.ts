import { BonsaiDNA } from './types';
import { Rng } from './seed';
import { Noise2 } from './noise';
import { Skeleton } from './skeleton';
import { poissonDisk } from './poisson';
import { Frame, CLS_CANOPY, CLS_FLOWER, CLS_WOOD, CLS_DEAD, CLS_EMPTY } from './raster';
import { makeShader } from './shade';
import { LEAF_A, LEAF_B, FLOWER, rampFor } from './palette';

export type Sway = (x: number, y: number) => number;

function ease(v: number): number {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
}

/**
 * Canopy: metaballs around twig tips + simplex-perturbed silhouette, shaded in
 * 3-4 posterized bands with dithering, textured with Poisson-disk leaf stamps.
 * Blossoms appear on streak milestones. Painter's order: canopy pads sit on
 * top of the wood already in the frame.
 */
export function drawFoliage(
  frame: Frame,
  dna: BonsaiDNA,
  skel: Skeleton,
  t: number,
  sway: Sway,
  rng: Rng,
  noise: Noise2,
): void {
  const { w, h } = frame;

  interface Ball { x: number; y: number; r: number; epoch: 0 | 1; }
  const balls: Ball[] = [];
  for (const pad of skel.pads) {
    if (pad.dead || pad.birth > t) continue;
    const grow = ease((t - pad.birth) / 0.15);
    balls.push({ x: sway(pad.x, pad.y - 1), y: pad.y - 1, r: pad.r * 0.58 * grow, epoch: pad.epoch });
    for (const tip of pad.tips) {
      if (tip.birth > t) continue;
      const tr = (3.1 + dna.foliage * 1.6) * ease((t - tip.birth) / 0.1);
      balls.push({ x: sway(tip.x, tip.y), y: tip.y, r: tr, epoch: pad.epoch });
    }
  }
  if (balls.length === 0) return;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (const b of balls) {
    minX = Math.min(minX, b.x - b.r - 3);
    maxX = Math.max(maxX, b.x + b.r + 3);
    minY = Math.min(minY, b.y - b.r - 3);
    maxY = Math.max(maxY, b.y + b.r + 3);
  }
  minX = Math.max(0, Math.floor(minX));
  minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(w - 1, Math.ceil(maxX));
  maxY = Math.min(h - 1, Math.ceil(maxY));

  // accumulate the metaball field per-ball over its own bbox (fast) and track
  // the epoch-1 share to decide each pixel's leaf palette
  const field = new Float32Array(w * h);
  const field1 = new Float32Array(w * h);
  for (const b of balls) {
    if (b.r <= 0.4) continue;
    const bx0 = Math.max(minX, Math.floor(b.x - b.r));
    const bx1 = Math.min(maxX, Math.ceil(b.x + b.r));
    const by0 = Math.max(minY, Math.floor(b.y - b.r));
    const by1 = Math.min(maxY, Math.ceil(b.y + b.r));
    const inv = 1 / (b.r * b.r);
    for (let y = by0; y <= by1; y++) {
      const dy = (y - b.y) * 1.25; // slightly flattened pads
      for (let x = bx0; x <= bx1; x++) {
        const dx = x - b.x;
        const q = 1 - (dx * dx + dy * dy) * inv;
        if (q <= 0) continue;
        const contrib = q * q;
        const i = y * w + x;
        field[i] += contrib;
        if (b.epoch === 1) field1[i] += contrib;
      }
    }
  }

  const mask = new Uint8Array(w * h);
  const epochBuf = new Uint8Array(w * h);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = y * w + x;
      if (field[i] <= 0.05) continue;
      if (field[i] + noise(x * 0.09, y * 0.09) * 0.3 > 0.42) {
        mask[i] = 1;
        epochBuf[i] = field1[i] > field[i] * 0.5 ? 1 : 0;
      }
    }
  }

  const shade = makeShader(mask, w, h, 4, {
    depthMix: 0.5,
    noise,
    noiseAmp: 0.22,
    noiseScaleX: 0.22,
    noiseScaleY: 0.22,
  });
  const ramps = [dna.secondaryPalette ? LEAF_B : LEAF_A, LEAF_A];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const band = shade(x, y);
      if (band < 0) continue;
      frame.set(x, y, ramps[epochBuf[y * w + x]][band], CLS_CANOPY);
    }
  }

  // leaf-stamp texture (stamp shape depends on the section's language)
  const stampA = rampFor(dna.primaryPalette).stamp;
  const stampB = dna.secondaryPalette ? rampFor(dna.secondaryPalette).stamp : stampA;
  const pts = poissonDisk(rng, maxX - minX + 1, maxY - minY + 1, 3.2);
  for (const p of pts) {
    const x = Math.floor(minX + p.x);
    const y = Math.floor(minY + p.y);
    const i = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h || !mask[i]) continue;
    const epoch = epochBuf[i];
    const ramp = ramps[epoch];
    const stamp = epoch === 1 ? stampA : stampB;
    const cells = stamp === 0
      ? [[0, 0], [1, 0], [0, 1], [1, 1]]
      : stamp === 1
        ? [[0, 0], [-1, 0], [1, 0], [0, -1]]
        : [[0, 0], [1, -1]];
    for (const [ox, oy] of cells) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || !mask[yy * w + xx]) continue;
      const cur = frame.color[yy * w + xx];
      const pos = (ramp as readonly number[]).indexOf(cur);
      if (pos >= 0) {
        const lit = ox + oy <= 0 ? 1 : -1;
        frame.set(xx, yy, ramp[Math.max(0, Math.min(3, pos + lit))], CLS_CANOPY);
      }
    }
  }

  drawFlowers(frame, dna, skel, t, sway, mask);
}

function drawFlowers(
  frame: Frame,
  dna: BonsaiDNA,
  skel: Skeleton,
  t: number,
  sway: Sway,
  mask: Uint8Array,
): void {
  if (dna.flowers <= 0) return;
  const alive = skel.pads.filter((p) => !p.dead);
  if (alive.length === 0) return;
  const blossoms = dna.flowers * 2;
  for (let i = 0; i < blossoms; i++) {
    const pad = alive[(i * 7) % alive.length];
    if (t < pad.birth + 0.12) continue;
    const tip = pad.tips[(i * 3) % pad.tips.length];
    const bx = Math.round(sway(tip.x, tip.y - 2));
    const by = Math.round(tip.y - 2);
    if (frame.clsAt(bx, by) !== CLS_CANOPY && !nearMask(mask, frame.w, frame.h, bx, by)) continue;
    frame.set(bx, by, FLOWER[2], CLS_FLOWER);
    frame.set(bx - 1, by, FLOWER[1], CLS_FLOWER);
    frame.set(bx + 1, by, FLOWER[1], CLS_FLOWER);
    frame.set(bx, by - 1, FLOWER[1], CLS_FLOWER);
    frame.set(bx, by + 1, FLOWER[0], CLS_FLOWER);
  }
}

function nearMask(mask: Uint8Array, w: number, h: number, x: number, y: number): boolean {
  for (let oy = -2; oy <= 2; oy++) {
    for (let ox = -2; ox <= 2; ox++) {
      const xx = x + ox;
      const yy = y + oy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy * w + xx]) return true;
    }
  }
  return false;
}

/** Drifting sakura petals for the wind loop; phase-cyclic so the GIF loops. */
export function drawPetals(
  frame: Frame,
  dna: BonsaiDNA,
  skel: Skeleton,
  phase: number,
): void {
  if (dna.flowers <= 0) return;
  const alive = skel.pads.filter((p) => !p.dead);
  if (alive.length === 0) return;
  const src = alive.reduce((a, b) => (a.y < b.y ? a : b));
  const count = Math.min(4, dna.flowers + 1);
  for (let i = 0; i < count; i++) {
    const cycle = (phase / (Math.PI * 2) + i / count) % 1;
    if (cycle > 0.92) continue;
    const px = Math.round(src.x + 6 + cycle * 34 + Math.sin(cycle * Math.PI * 4 + i) * 5);
    const py = Math.round(src.y + cycle * 52);
    if (frame.clsAt(px, py) === CLS_EMPTY) frame.set(px, py, FLOWER[1], CLS_FLOWER);
  }
}

/** Keyline: dark outline around every solid silhouette + canopy edges over wood. */
export function outlinePass(frame: Frame, outlineIdx: number): void {
  const { w, h } = frame;
  const snap = frame.cls.slice();
  const solid = (c: number): boolean => c !== CLS_EMPTY;
  const leafy = (c: number): boolean => c === CLS_CANOPY || c === CLS_FLOWER;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = snap[i];
      const up = y > 0 ? snap[i - w] : CLS_EMPTY;
      const dn = y + 1 < h ? snap[i + w] : CLS_EMPTY;
      const lf = x > 0 ? snap[i - 1] : CLS_EMPTY;
      const rt = x + 1 < w ? snap[i + 1] : CLS_EMPTY;
      if (c === CLS_EMPTY) {
        if (solid(up) || solid(dn) || solid(lf) || solid(rt)) {
          frame.color[i] = outlineIdx;
          frame.cls[i] = 7;
        }
      } else if ((c === CLS_WOOD || c === CLS_DEAD) && (leafy(up) || leafy(dn) || leafy(lf) || leafy(rt))) {
        frame.color[i] = outlineIdx;
        frame.cls[i] = 7;
      }
    }
  }
}
