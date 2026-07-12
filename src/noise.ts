import { Rng } from './seed';

const GRAD: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export type Noise2 = (x: number, y: number) => number;

export type BarkFn = (x: number, y: number, sx: number, sy: number) => number;

/**
 * Bark texture: domain-warped ridged noise — the classic recipe for wood.
 * A low-frequency warp bends the ridge lines organically; ridging
 * (1 - |n|)^2 turns smooth noise into sharp bark plates and fissures.
 * Returns 0..1 (high = ridge crest).
 */
export function makeBark(noise: Noise2): BarkFn {
  return (x, y, sx, sy) => {
    const wx = noise(x * sx * 0.45 + 11.3, y * sy * 0.45 - 7.1);
    const wy = noise(x * sx * 0.45 - 3.7, y * sy * 0.45 + 9.2);
    const n = noise(x * sx + wx * 2.2, y * sy + wy * 2.2);
    const ridge = 1 - Math.abs(n);
    return ridge * ridge;
  };
}

/** 2D simplex noise (Gustavson) with a permutation table shuffled by the seeded PRNG. Output in [-1, 1]. */
export function makeSimplex(rng: Rng): Noise2 {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return (xin: number, yin: number): number => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      const g = GRAD[perm[ii + perm[jj]] % 12];
      n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      const g = GRAD[perm[ii + i1 + perm[jj + j1]] % 12];
      n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      const g = GRAD[perm[ii + 1 + perm[jj + 1]] % 12];
      n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * n;
  };
}
