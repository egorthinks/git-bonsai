"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bayer = bayer;
exports.insideDistance = insideDistance;
exports.makeShader = makeShader;
/** 4x4 Bayer matrix, normalized to -0.5..~0.5 for ordered dithering. */
const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
];
function bayer(x, y) {
    return BAYER4[y & 3][x & 3] / 16 - 0.5;
}
/**
 * Signed distance inside a mask via the 8SSEDT two-pass sweep (Danielsson):
 * for every solid pixel, distance to the nearest empty pixel. 0 outside.
 */
function insideDistance(mask, w, h) {
    const INF = 1e6;
    const dx = new Float32Array(w * h);
    const dy = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
        dx[i] = mask[i] ? INF : 0;
        dy[i] = mask[i] ? INF : 0;
    }
    const relax = (i, x, y, ox, oy) => {
        const nx = x + ox;
        const ny = y + oy;
        let cx;
        let cy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            // outside the canvas counts as empty
            cx = ox;
            cy = oy;
        }
        else {
            const j = ny * w + nx;
            cx = dx[j] + ox;
            cy = dy[j] + oy;
        }
        if (cx * cx + cy * cy < dx[i] * dx[i] + dy[i] * dy[i]) {
            dx[i] = cx;
            dy[i] = cy;
        }
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (!mask[i])
                continue;
            relax(i, x, y, -1, 0);
            relax(i, x, y, 0, -1);
            relax(i, x, y, -1, -1);
            relax(i, x, y, 1, -1);
        }
    }
    for (let y = h - 1; y >= 0; y--) {
        for (let x = w - 1; x >= 0; x--) {
            const i = y * w + x;
            if (!mask[i])
                continue;
            relax(i, x, y, 1, 0);
            relax(i, x, y, 0, 1);
            relax(i, x, y, 1, 1);
            relax(i, x, y, -1, 1);
        }
    }
    const dist = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++)
        dist[i] = mask[i] ? Math.hypot(dx[i], dy[i]) : 0;
    return dist;
}
/**
 * Fake volume: SDF gradient -> surface normal -> 2-4 posterized light bands,
 * blended with Bayer ordered dithering. Returns a ramp index 0..rampLen-1
 * for pixel (x, y), or -1 outside the mask.
 */
function makeShader(mask, w, h, rampLen, opts = {}) {
    const dist = insideDistance(mask, w, h);
    const lx = opts.lightX ?? -0.55;
    const ly = opts.lightY ?? -0.83;
    const depthMix = opts.depthMix ?? 0.45;
    const depthScale = opts.depthScale ?? 0.3;
    const nAmp = opts.noiseAmp ?? 0;
    return (x, y) => {
        const i = y * w + x;
        if (!mask[i])
            return -1;
        const dR = x + 1 < w ? dist[i + 1] : 0;
        const dL = x > 0 ? dist[i - 1] : 0;
        const dD = y + 1 < h ? dist[i + w] : 0;
        const dU = y > 0 ? dist[i - w] : 0;
        // dist grows inward, so -gradient points outward (the surface normal)
        let nx = dL - dR;
        let ny = dU - dD;
        const nl = Math.hypot(nx, ny);
        if (nl > 0.0001) {
            nx /= nl;
            ny /= nl;
        }
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
