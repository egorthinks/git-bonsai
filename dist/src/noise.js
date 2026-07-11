"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSimplex = makeSimplex;
const GRAD = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, 1], [1, -1], [-1, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
/** 2D simplex noise (Gustavson) with a permutation table shuffled by the seeded PRNG. Output in [-1, 1]. */
function makeSimplex(rng) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++)
        p[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = p[i];
        p[i] = p[j];
        p[j] = t;
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++)
        perm[i] = p[i & 255];
    return (xin, yin) => {
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
