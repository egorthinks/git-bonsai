"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthMetrics = exports.loadFixture = exports.fetchMetrics = void 0;
exports.generate = generate;
const seed_1 = require("./seed");
const dna_1 = require("./dna");
const skeleton_1 = require("./skeleton");
const thickness_1 = require("./thickness");
const render_1 = require("./render");
const animate_1 = require("./animate");
const palette_1 = require("./palette");
const encode_1 = require("./encode");
var data_1 = require("./data");
Object.defineProperty(exports, "fetchMetrics", { enumerable: true, get: function () { return data_1.fetchMetrics; } });
Object.defineProperty(exports, "loadFixture", { enumerable: true, get: function () { return data_1.loadFixture; } });
Object.defineProperty(exports, "synthMetrics", { enumerable: true, get: function () { return data_1.synthMetrics; } });
/**
 * The full deterministic pipeline:
 * metrics -> seed -> dna -> skeleton -> thickness -> raster/shade/foliage -> animate -> encode.
 * Same metrics in, bit-identical bytes out.
 */
function generate(metrics, opts = {}) {
    const scale = opts.scale ?? 4;
    const seedKey = metrics.username.toLowerCase();
    const rng = (0, seed_1.makeRng)(seedKey);
    const dna = (0, dna_1.deriveDna)(metrics, rng);
    const skel = (0, skeleton_1.buildSkeleton)(dna, rng);
    (0, thickness_1.applyThickness)(skel, dna);
    const palette = (0, palette_1.buildPalette)(dna.primaryPalette, dna.secondaryPalette);
    const still = (0, render_1.renderFrame)(dna, skel, { growthT: 1, windPhase: null });
    const wind = (0, animate_1.windFrames)(dna, skel, opts.windFrameCount ?? 24);
    const growth = (0, animate_1.growthFrames)(dna, skel, opts.growthFrameCount ?? 44);
    return {
        svg: (0, encode_1.frameToSvg)(still, palette, scale),
        png: (0, encode_1.frameToPng)(still, palette, scale),
        gif: (0, encode_1.framesToGif)(wind, palette),
        growthGif: (0, encode_1.framesToGif)(growth, palette),
        dna,
    };
}
