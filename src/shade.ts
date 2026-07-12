import { Noise2 } from './noise';

/** 4x4 Bayer matrix, normalized to -0.5..~0.5 for ordered dithering. */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export function bayer(x: number, y: number): number {
  return BAYER4[y & 3][x & 3] / 16 - 0.5;
}

/**
 * Signed distance inside a mask via the 8SSEDT two-pass sweep (Danielsson):
 * for every solid pixel, distance to the nearest empty pixel. 0 outside.
 */
export function insideDistance(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e6;
  const dx = new Float32Array(w * h);
  const dy = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    dx[i] = mask[i] ? INF : 0;
    dy[i] = mask[i] ? INF : 0;
  }
  const relax = (i: number, x: number, y: number, ox: number, oy: number): void => {
    const nx = x + ox;
    const ny = y + oy;
    let cx: number;
    let cy: number;
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
      // outside the canvas counts as empty
      cx = ox; cy = oy;
    } else {
      const j = ny * w + nx;
      cx = dx[j] + ox; cy = dy[j] + oy;
    }
    if (cx * cx + cy * cy < dx[i] * dx[i] + dy[i] * dy[i]) {
      dx[i] = cx; dy[i] = cy;
    }
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      relax(i, x, y, -1, 0);
      relax(i, x, y, 0, -1);
      relax(i, x, y, -1, -1);
      relax(i, x, y, 1, -1);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!mask[i]) continue;
      relax(i, x, y, 1, 0);
      relax(i, x, y, 0, 1);
      relax(i, x, y, 1, 1);
      relax(i, x, y, -1, 1);
    }
  }

  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = mask[i] ? Math.hypot(dx[i], dy[i]) : 0;
  return dist;
}

export interface ShadeOpts {
  /** Light direction (normalized-ish), defaults to upper-left. */
  lightX?: number;
  lightY?: number;
  /** How much SDF depth (vs lambert) drives the tone. */
  depthMix?: number;
  /** How fast depth saturates: lower = the gradient reaches deeper (wide trunks). */
  depthScale?: number;
  /** Extra per-pixel tone noise (bark/leaf texture). */
  noise?: Noise2;
  noiseAmp?: number;
  noiseScaleX?: number;
  noiseScaleY?: number;
}

/**
 * Fake volume: SDF gradient -> surface normal -> 2-4 posterized light bands,
 * blended with Bayer ordered dithering. Returns a ramp index 0..rampLen-1
 * for pixel (x, y), or -1 outside the mask.
 */
export function makeShader(
  mask: Uint8Array, w: number, h: number, rampLen: number, opts: ShadeOpts = {},
): (x: number, y: number) => number {
  const dist = insideDistance(mask, w, h);
  const lx = opts.lightX ?? -0.55;
  const ly = opts.lightY ?? -0.83;
  const depthMix = opts.depthMix ?? 0.45;
  const depthScale = opts.depthScale ?? 0.3;
  const nAmp = opts.noiseAmp ?? 0;

  return (x: number, y: number): number => {
    const i = y * w + x;
    if (!mask[i]) return -1;
    const dR = x + 1 < w ? dist[i + 1] : 0;
    const dL = x > 0 ? dist[i - 1] : 0;
    const dD = y + 1 < h ? dist[i + w] : 0;
    const dU = y > 0 ? dist[i - w] : 0;
    // dist grows inward, so -gradient points outward (the surface normal)
    let nx = dL - dR;
    let ny = dU - dD;
    const nl = Math.hypot(nx, ny);
    if (nl > 0.0001) { nx /= nl; ny /= nl; }
    const lambert = 0.5 + 0.5 * (nx * lx + ny * ly);
    const depth = Math.min(1, dist[i] * depthScale);
    let t = (1 - depthMix) * lambert + depthMix * depth;
    if (opts.noise && nAmp > 0) {
      t += opts.noise(x * (opts.noiseScaleX ?? 0.3), y * (opts.noiseScaleY ?? 0.3)) * nAmp;
    }
    const v = t * (rampLen - 1) + bayer(x, y) * 0.9;
    return Math.max(0, Math.min(rampLen - 1, Math.round(v)));
  };
}
