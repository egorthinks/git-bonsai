import { BonsaiDNA } from './types';
import { makeRng, clamp } from './seed';
import { makeSimplex, Noise2 } from './noise';
import { Skeleton, W, H } from './skeleton';
import {
  Frame, fillCapsule,
  CLS_WOOD, CLS_DEAD, CLS_POT, CLS_SOIL,
} from './raster';
import { makeShader, bayer } from './shade';
import { TRUNK, DEAD, POT, SOIL, OUTLINE } from './palette';
import { drawFoliage, drawPetals, outlinePass, Sway } from './foliage';

export interface RenderOpts {
  /** Growth time 0..1; 1 = fully grown. */
  growthT?: number;
  /** Wind phase in radians, or null for a perfectly still frame. */
  windPhase?: number | null;
}

function ease(v: number): number {
  const t = clamp(v, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Compose one 192x192 indexed frame: pot -> wood -> foliage -> keyline. */
export function renderFrame(dna: BonsaiDNA, skel: Skeleton, opts: RenderOpts = {}): Frame {
  const t = opts.growthT ?? 1;
  const phase = opts.windPhase ?? null;
  const frame = new Frame(W, H);
  // fresh streams per frame so animation frames stay coherent (no per-frame jitter)
  const rng = makeRng(dna.seedKey + '|frame');
  const noise = makeSimplex(makeRng(dna.seedKey + '|noise'));

  const sway: Sway = phase === null
    ? (x) => x
    : (x, y) => {
      const hf = Math.max(0, skel.groundY - y) / skel.groundY;
      const amp = 1.5 * hf * hf + 0.25 * hf;
      const wave = Math.sin(phase + (skel.groundY - y) * 0.05 + x * 0.012);
      // noise sampled on a circle in noise-space so the loop is seamless
      const n = noise(x * 0.03 + Math.cos(phase) * 0.8, y * 0.03 + Math.sin(phase) * 0.8);
      return x + amp * (0.7 * wave + 0.55 * n);
    };

  // rasterize wood into alive/dead masks, then shade with SDF volume + dithering
  const aliveMask = new Uint8Array(W * H);
  const deadMask = new Uint8Array(W * H);
  const maturity = 0.4 + 0.6 * t;
  for (const s of skel.segs) {
    if (s.birth > t) continue;
    const rEase = 0.3 + 0.7 * ease((t - s.birth) * 8);
    const r = s.twig ? s.radius : s.radius * rEase * maturity;
    fillCapsule(
      s.dead ? deadMask : aliveMask, W, H,
      sway(s.ax, s.ay), s.ay, sway(s.bx, s.by), s.by, r, 1,
    );
  }
  const shadeAlive = makeShader(aliveMask, W, H, TRUNK.length, {
    depthMix: 0.4, noise, noiseAmp: 0.12, noiseScaleX: 0.5, noiseScaleY: 0.12,
  });
  const shadeDead = makeShader(deadMask, W, H, DEAD.length, { depthMix: 0.35 });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = shadeAlive(x, y);
      if (a >= 0) frame.set(x, y, TRUNK[a], CLS_WOOD);
      const d = shadeDead(x, y);
      if (d >= 0) frame.set(x, y, DEAD[d], CLS_DEAD);
    }
  }

  // painter's order: the pot is drawn over the wood so the trunk sinks into
  // the soil instead of spilling its rounded base over the pot body
  drawPot(frame, dna, skel, noise);

  drawFoliage(frame, dna, skel, t, sway, rng, noise);
  outlinePass(frame, OUTLINE);
  if (phase !== null) drawPetals(frame, dna, skel, phase);
  return frame;
}

/** Pot with the contribution mosaic of the current year as its soil. */
function drawPot(frame: Frame, dna: BonsaiDNA, skel: Skeleton, noise: Noise2): void {
  const cx = W / 2;
  const gy = skel.groundY;

  // rim
  for (let y = gy; y <= gy + 2; y++) {
    for (let x = cx - 44; x <= cx + 44; x++) {
      frame.set(x, y, y === gy ? POT[2] : POT[1], CLS_POT);
    }
  }
  // body with simple lit-left banding + dithering
  for (let y = gy + 3; y <= gy + 15; y++) {
    const half = Math.round(40 - ((y - gy - 3) / 12) * 7);
    for (let x = cx - half; x <= cx + half; x++) {
      const u = (x - (cx - half)) / (half * 2);
      const v = 1 - u * 0.9 - (y - gy) * 0.02 + bayer(x, y) * 0.4;
      const band = clamp(Math.round(v * (POT.length - 1)), 0, POT.length - 1);
      frame.set(x, y, POT[band], CLS_POT);
    }
  }
  // feet
  for (let y = gy + 16; y <= gy + 18; y++) {
    for (let x = cx - 30; x <= cx - 24; x++) frame.set(x, y, POT[0], CLS_POT);
    for (let x = cx + 24; x <= cx + 30; x++) frame.set(x, y, POT[0], CLS_POT);
  }

  // soil mosaic: 52 weeks of contributions across the pot's mouth
  const soilHalf = 40;
  const soilW = soilHalf * 2;
  for (let i = 0; i < 52; i++) {
    const x0 = cx - soilHalf + Math.floor((i * soilW) / 52);
    const x1 = cx - soilHalf + Math.floor(((i + 1) * soilW) / 52) - 1;
    const level = clamp(dna.potWeeks[i] ?? 0, 0, 4);
    for (let x = x0; x <= Math.max(x0, x1); x++) {
      frame.set(x, gy - 2, SOIL[level], CLS_SOIL);
      frame.set(x, gy - 1, level > 0 && noise(x * 0.8, 3.7) > 0.2 ? SOIL[Math.max(0, level - 1)] : SOIL[level], CLS_SOIL);
    }
  }
}
