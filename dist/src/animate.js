"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.windFrames = windFrames;
exports.growthFrames = growthFrames;
const render_1 = require("./render");
/** Seamless wind loop: sine + phase-shifted simplex, petals if in bloom. */
function windFrames(dna, skel, count = 24) {
    const frames = [];
    const delays = [];
    for (let f = 0; f < count; f++) {
        frames.push((0, render_1.renderFrame)(dna, skel, { windPhase: (f / count) * Math.PI * 2 }));
        delays.push(8);
    }
    return { frames, delays };
}
/** Growth timelapse: seed to the current tree in ~4-6 seconds, then hold. */
function growthFrames(dna, skel, count = 44) {
    const frames = [];
    const delays = [];
    for (let f = 0; f < count; f++) {
        const lin = f / (count - 1);
        const t = 1 - Math.pow(1 - lin, 2.2); // fast youth, slow maturity
        frames.push((0, render_1.renderFrame)(dna, skel, { growthT: t, windPhase: null }));
        delays.push(f === count - 1 ? 300 : 10);
    }
    return { frames, delays };
}
