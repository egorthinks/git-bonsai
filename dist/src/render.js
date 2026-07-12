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
/** Compose one 256x256 indexed frame: wood -> pot -> foliage -> keyline. */
function renderFrame(dna, skel, opts = {}) {
    const t = opts.growthT ?? 1;
    const phase = opts.windPhase ?? null;
    const frame = new raster_1.Frame(skeleton_1.W, skeleton_1.H);
    const species = palette_1.SPECIES[dna.species];
    // fresh streams per frame so animation frames stay coherent (no per-frame jitter)
    const rng = (0, seed_1.makeRng)(dna.seedKey + '|frame');
    const noise = (0, noise_1.makeSimplex)((0, seed_1.makeRng)(dna.seedKey + '|noise'));
    const sway = phase === null
        ? (x) => x
        : (x, y) => {
            const hf = Math.max(0, skel.groundY - y) / skel.groundY;
            const amp = 2.0 * hf * hf + 0.33 * hf;
            const wave = Math.sin(phase + (skel.groundY - y) * 0.0375 + x * 0.009);
            // noise sampled on a circle in noise-space so the loop is seamless
            const n = noise(x * 0.0225 + Math.cos(phase) * 0.8, y * 0.0225 + Math.sin(phase) * 0.8);
            return x + amp * (0.7 * wave + 0.55 * n);
        };
    // rasterize wood into alive/dead masks, then shade with SDF volume + dithering
    const aliveMask = new Uint8Array(skeleton_1.W * skeleton_1.H);
    const deadMask = new Uint8Array(skeleton_1.W * skeleton_1.H);
    const maturity = 0.4 + 0.6 * t;
    const windSign = Math.sign(dna.lean) || 1;
    for (const s of skel.segs) {
        if (s.birth > t)
            continue;
        const rEase = 0.3 + 0.7 * ease((t - s.birth) * 8);
        const r = s.twig ? s.radius : s.radius * rEase * maturity;
        const mask = s.dead ? deadMask : aliveMask;
        const ax = sway(s.ax, s.ay);
        const bx = sway(s.bx, s.by);
        if (!s.twig && r > 3.5) {
            // fluted trunk: a union of offset lobes gives thick wood the grooves,
            // knobs and muscle of real bark instead of a smooth sausage
            const pxv = s.by - s.ay;
            const pyv = -(bx - ax);
            const L = Math.hypot(pxv, pyv) || 1;
            const wob = 0.32 + 0.22 * noise((s.ax + s.bx) * 0.11, (s.ay + s.by) * 0.11);
            const ox = (pxv / L) * r * wob;
            const oy = (pyv / L) * r * wob;
            (0, raster_1.fillCapsule)(mask, skeleton_1.W, skeleton_1.H, ax + ox, s.ay + oy, bx + ox, s.by + oy, r * 0.62, 1);
            (0, raster_1.fillCapsule)(mask, skeleton_1.W, skeleton_1.H, ax - ox, s.ay - oy, bx - ox, s.by - oy, r * 0.62, 1);
            (0, raster_1.fillCapsule)(mask, skeleton_1.W, skeleton_1.H, ax, s.ay, bx, s.by, r * 0.85, 1);
        }
        else {
            (0, raster_1.fillCapsule)(mask, skeleton_1.W, skeleton_1.H, ax, s.ay, bx, s.by, r, 1);
        }
        // shari: a pale strip of deadwood along the lower trunk's shaded side
        if (dna.shari && !s.twig && s.order <= 1 && s.birth < 0.3 && r > 2.5) {
            const pxv = s.by - s.ay;
            const pyv = -(s.bx - s.ax);
            const L = Math.hypot(pxv, pyv) || 1;
            const off = (r * 0.55) * -windSign;
            (0, raster_1.fillCapsule)(deadMask, skeleton_1.W, skeleton_1.H, sway(s.ax, s.ay) + (pxv / L) * off, s.ay + (pyv / L) * off, sway(s.bx, s.by) + (pxv / L) * off, s.by + (pyv / L) * off, r * 0.3, 1);
        }
    }
    // nebari: root buttresses flaring at the soil line, one pair per flare step;
    // every trunk of a multi-trunk tree gets its own (smaller) flare
    // roots must land inside the pot's mouth, never over its rim
    const soilHalf = Math.round(skeleton_1.W * 0.23 * (dna.style === 'yose-ue' ? 1.56 : dna.potScale) * 0.9) - 6;
    skel.bases.forEach((base, k) => {
        const flare = k === 0 ? dna.rootFlare : Math.max(1, dna.rootFlare - 1);
        for (let i = 0; i < flare * 2; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const spread = base.r * (1.15 + 0.4 * Math.floor(i / 2)) * t;
            if (skel.rockH > 0) {
                // sekijoju: long roots grip the rock, running down its flanks into the soil
                const endX = (0, seed_1.clamp)(base.x + side * (spread * 1.7 + 3), skeleton_1.W / 2 - soilHalf, skeleton_1.W / 2 + soilHalf);
                (0, raster_1.fillCapsule)(aliveMask, skeleton_1.W, skeleton_1.H, base.x, base.y + 2, endX, skel.groundY - 2, base.r * 0.3, 1);
            }
            else {
                const endX = (0, seed_1.clamp)(base.x + side * spread, skeleton_1.W / 2 - soilHalf, skeleton_1.W / 2 + soilHalf);
                (0, raster_1.fillCapsule)(aliveMask, skeleton_1.W, skeleton_1.H, base.x, base.y - 4, endX, base.y - 2, base.r * 0.36, 1);
            }
        }
    });
    // sekijoju's rock goes in before the wood is shaded, so roots read on top
    if (skel.rockH > 0)
        drawRock(frame, dna, skel, noise);
    const shadeAlive = (0, shade_1.makeShader)(aliveMask, skeleton_1.W, skeleton_1.H, palette_1.TRUNK.length, {
        depthMix: 0.38, depthScale: 0.13,
        bark: {
            fn: (0, noise_1.makeBark)(noise),
            amp: species.barkAmp * 2.4,
            scaleX: 0.2,
            scaleY: 0.07,
            crack: 0.93 - species.barkAmp * 0.4, // rough species crack more
        },
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
    // uro: a small hollow in the trunk — the mark of coming back after 2+ years
    if (dna.uro && t > 0.5) {
        const trunk = skel.segs.filter((s) => !s.twig && s.order <= 1);
        if (trunk.length > 4) {
            const seg = trunk[Math.floor(trunk.length * 0.25)];
            const ux = Math.round(sway((seg.ax + seg.bx) / 2, (seg.ay + seg.by) / 2));
            const uy = Math.round((seg.ay + seg.by) / 2);
            if (frame.clsAt(ux, uy) === raster_1.CLS_WOOD) {
                for (let oy = -2; oy <= 2; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        if (ox * ox + (oy * oy) / 2.5 > 1.6)
                            continue;
                        frame.set(ux + ox, uy + oy, oy === 2 ? palette_1.DEAD[2] : palette_1.OUTLINE, raster_1.CLS_WOOD);
                    }
                }
            }
        }
    }
    // painter's order: the pot is drawn over the wood so the trunk sinks into
    // the soil instead of spilling its rounded base over the pot body
    drawPot(frame, dna, skel, noise);
    (0, foliage_1.drawFoliage)(frame, dna, skel, t, sway, rng, noise);
    (0, foliage_1.outlinePass)(frame, palette_1.OUTLINE);
    if (phase !== null)
        (0, foliage_1.drawPetals)(frame, dna, skel, phase);
    return frame;
}
/**
 * Sekijoju's boulder: a noise-lumped ellipse sitting on the soil, shaded in
 * the bleached deadwood grays. Drawn before the wood so roots wrap over it.
 */
function drawRock(frame, dna, skel, noise) {
    const cx = skel.bases[0]?.x ?? skel.baseX;
    const cy = skel.groundY - skel.rockH / 2 + 2;
    const rx = dna.baseRadius * 1.9 + 11;
    const ry = skel.rockH / 2 + 4;
    const mask = new Uint8Array(skeleton_1.W * skeleton_1.H);
    for (let y = Math.max(0, Math.floor(cy - ry - 3)); y <= Math.min(skeleton_1.H - 1, Math.ceil(cy + ry + 3)); y++) {
        for (let x = Math.max(0, Math.floor(cx - rx - 3)); x <= Math.min(skeleton_1.W - 1, Math.ceil(cx + rx + 3)); x++) {
            const ex = (x - cx) / rx;
            const ey = (y - cy) / ry;
            const lump = noise(x * 0.13 + 61, y * 0.13 - 29) * 0.24;
            if (ex * ex + ey * ey <= 1 + lump && y <= skel.groundY)
                mask[y * skeleton_1.W + x] = 1;
        }
    }
    const shade = (0, shade_1.makeShader)(mask, skeleton_1.W, skeleton_1.H, palette_1.DEAD.length, {
        depthMix: 0.42,
        noise,
        noiseAmp: 0.3,
        noiseScaleX: 0.16,
        noiseScaleY: 0.16,
    });
    for (let y = 0; y < skeleton_1.H; y++) {
        for (let x = 0; x < skeleton_1.W; x++) {
            const band = shade(x, y);
            if (band >= 0)
                frame.set(x, y, palette_1.DEAD[band], raster_1.CLS_POT);
        }
    }
}
/** Pot with the contribution mosaic of the current year as its soil. */
function drawPot(frame, dna, skel, noise) {
    const cx = skeleton_1.W / 2;
    const gy = skel.groundY;
    // pot size is a growth reward (shohin -> dai); a forest sits in a wide flat tray
    const tray = dna.style === 'yose-ue';
    const rimHalf = Math.round(skeleton_1.W * (tray ? 0.36 : 0.23) * (tray ? 1 : dna.potScale));
    const bodyHalf = Math.round(rimHalf * 0.9);
    const bodyH = Math.round(skeleton_1.W * (tray ? 0.05 : 0.082) * (tray ? 1 : dna.potScale));
    // rim
    for (let y = gy; y <= gy + 3; y++) {
        for (let x = cx - rimHalf; x <= cx + rimHalf; x++) {
            frame.set(x, y, y === gy ? palette_1.POT[2] : palette_1.POT[1], raster_1.CLS_POT);
        }
    }
    // body with simple lit-left banding + dithering
    for (let y = gy + 4; y <= gy + 3 + bodyH; y++) {
        const half = Math.round(bodyHalf - ((y - gy - 4) / bodyH) * bodyHalf * 0.18);
        for (let x = cx - half; x <= cx + half; x++) {
            const u = (x - (cx - half)) / (half * 2);
            const v = 1 - u * 0.9 - (y - gy) * 0.015 + (0, shade_1.bayer)(x, y) * 0.4;
            const band = (0, seed_1.clamp)(Math.round(v * (palette_1.POT.length - 1)), 0, palette_1.POT.length - 1);
            frame.set(x, y, palette_1.POT[band], raster_1.CLS_POT);
        }
    }
    // feet
    const footIn = Math.round(bodyHalf * 0.6);
    for (let y = gy + 4 + bodyH; y <= gy + 7 + bodyH; y++) {
        for (let x = cx - footIn - 4; x <= cx - footIn + 4; x++)
            frame.set(x, y, palette_1.POT[0], raster_1.CLS_POT);
        for (let x = cx + footIn - 4; x <= cx + footIn + 4; x++)
            frame.set(x, y, palette_1.POT[0], raster_1.CLS_POT);
    }
    // soil mosaic: 52 weeks of contributions across the pot's mouth
    const soilHalf = bodyHalf;
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
