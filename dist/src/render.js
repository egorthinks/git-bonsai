"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderFrame = renderFrame;
const seed_1 = require("./seed");
const noise_1 = require("./noise");
const skeleton_1 = require("./skeleton");
const raster_1 = require("./raster");
const shade_1 = require("./shade");
const palette_1 = require("./palette");
const foliage_1 = require("./foliage");
function ease(v) {
    const t = (0, seed_1.clamp)(v, 0, 1);
    return t * t * (3 - 2 * t);
}
/** Compose one 192x192 indexed frame: pot -> wood -> foliage -> keyline. */
function renderFrame(dna, skel, opts = {}) {
    const t = opts.growthT ?? 1;
    const phase = opts.windPhase ?? null;
    const frame = new raster_1.Frame(skeleton_1.W, skeleton_1.H);
    // fresh streams per frame so animation frames stay coherent (no per-frame jitter)
    const rng = (0, seed_1.makeRng)(dna.seedKey + '|frame');
    const noise = (0, noise_1.makeSimplex)((0, seed_1.makeRng)(dna.seedKey + '|noise'));
    const sway = phase === null
        ? (x) => x
        : (x, y) => {
            const hf = Math.max(0, skel.groundY - y) / skel.groundY;
            const amp = 1.5 * hf * hf + 0.25 * hf;
            const wave = Math.sin(phase + (skel.groundY - y) * 0.05 + x * 0.012);
            // noise sampled on a circle in noise-space so the loop is seamless
            const n = noise(x * 0.03 + Math.cos(phase) * 0.8, y * 0.03 + Math.sin(phase) * 0.8);
            return x + amp * (0.7 * wave + 0.55 * n);
        };
    drawPot(frame, dna, skel, noise);
    // rasterize wood into alive/dead masks, then shade with SDF volume + dithering
    const aliveMask = new Uint8Array(skeleton_1.W * skeleton_1.H);
    const deadMask = new Uint8Array(skeleton_1.W * skeleton_1.H);
    const maturity = 0.4 + 0.6 * t;
    for (const s of skel.segs) {
        if (s.birth > t)
            continue;
        const rEase = 0.3 + 0.7 * ease((t - s.birth) * 8);
        const r = s.twig ? s.radius : s.radius * rEase * maturity;
        (0, raster_1.fillCapsule)(s.dead ? deadMask : aliveMask, skeleton_1.W, skeleton_1.H, sway(s.ax, s.ay), s.ay, sway(s.bx, s.by), s.by, r, 1);
    }
    const shadeAlive = (0, shade_1.makeShader)(aliveMask, skeleton_1.W, skeleton_1.H, palette_1.TRUNK.length, {
        depthMix: 0.4, noise, noiseAmp: 0.12, noiseScaleX: 0.5, noiseScaleY: 0.12,
    });
    const shadeDead = (0, shade_1.makeShader)(deadMask, skeleton_1.W, skeleton_1.H, palette_1.DEAD.length, { depthMix: 0.35 });
    for (let y = 0; y < skeleton_1.H; y++) {
        for (let x = 0; x < skeleton_1.W; x++) {
            const a = shadeAlive(x, y);
            if (a >= 0)
                frame.set(x, y, palette_1.TRUNK[a], raster_1.CLS_WOOD);
            const d = shadeDead(x, y);
            if (d >= 0)
                frame.set(x, y, palette_1.DEAD[d], raster_1.CLS_DEAD);
        }
    }
    (0, foliage_1.drawFoliage)(frame, dna, skel, t, sway, rng, noise);
    (0, foliage_1.outlinePass)(frame, palette_1.OUTLINE);
    if (phase !== null)
        (0, foliage_1.drawPetals)(frame, dna, skel, phase);
    return frame;
}
/** Pot with the contribution mosaic of the current year as its soil. */
function drawPot(frame, dna, skel, noise) {
    const cx = skeleton_1.W / 2;
    const gy = skel.groundY;
    // rim
    for (let y = gy; y <= gy + 2; y++) {
        for (let x = cx - 44; x <= cx + 44; x++) {
            frame.set(x, y, y === gy ? palette_1.POT[2] : palette_1.POT[1], raster_1.CLS_POT);
        }
    }
    // body with simple lit-left banding + dithering
    for (let y = gy + 3; y <= gy + 15; y++) {
        const half = Math.round(40 - ((y - gy - 3) / 12) * 7);
        for (let x = cx - half; x <= cx + half; x++) {
            const u = (x - (cx - half)) / (half * 2);
            const v = 1 - u * 0.9 - (y - gy) * 0.02 + (0, shade_1.bayer)(x, y) * 0.4;
            const band = (0, seed_1.clamp)(Math.round(v * (palette_1.POT.length - 1)), 0, palette_1.POT.length - 1);
            frame.set(x, y, palette_1.POT[band], raster_1.CLS_POT);
        }
    }
    // feet
    for (let y = gy + 16; y <= gy + 18; y++) {
        for (let x = cx - 30; x <= cx - 24; x++)
            frame.set(x, y, palette_1.POT[0], raster_1.CLS_POT);
        for (let x = cx + 24; x <= cx + 30; x++)
            frame.set(x, y, palette_1.POT[0], raster_1.CLS_POT);
    }
    // soil mosaic: 52 weeks of contributions across the pot's mouth
    const soilHalf = 40;
    const soilW = soilHalf * 2;
    for (let i = 0; i < 52; i++) {
        const x0 = cx - soilHalf + Math.floor((i * soilW) / 52);
        const x1 = cx - soilHalf + Math.floor(((i + 1) * soilW) / 52) - 1;
        const level = (0, seed_1.clamp)(dna.potWeeks[i] ?? 0, 0, 4);
        for (let x = x0; x <= Math.max(x0, x1); x++) {
            frame.set(x, gy - 2, palette_1.SOIL[level], raster_1.CLS_SOIL);
            frame.set(x, gy - 1, level > 0 && noise(x * 0.8, 3.7) > 0.2 ? palette_1.SOIL[Math.max(0, level - 1)] : palette_1.SOIL[level], raster_1.CLS_SOIL);
        }
    }
}
