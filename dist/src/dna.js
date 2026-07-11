"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveDna = deriveDna;
const seed_1 = require("./seed");
const DAY_MS = 86_400_000;
function sat(v) {
    return (0, seed_1.clamp)(v, 0, 1);
}
/**
 * Map normalized metrics + the seeded PRNG onto tree parameters (§5 of the spec).
 * The number of rng() calls here is fixed, so the same username keeps the same
 * "personality" even as its metrics evolve.
 */
function deriveDna(metrics, rng) {
    const ageYears = Math.max(0, (Date.parse(metrics.fetchedAt) - Date.parse(metrics.createdAt)) / (DAY_MS * 365.25));
    const activity = sat(Math.log10(metrics.totalContributions + 1) / 4.5); // ~30k commits -> 1.0
    // account age -> trunk height, growth iterations, base thickness
    const iterations = (0, seed_1.clamp)(3 + Math.floor(ageYears / 3), 3, 6);
    const trunkLen = 20 + Math.min(ageYears, 12) * 1.9 + (0, seed_1.range)(rng, -1.5, 1.5);
    const baseRadius = (0, seed_1.clamp)(2.5 + Math.min(ageYears, 12) * 0.26 + activity * 1.6, 2.5, 6.5);
    // total contributions -> branch density & foliage
    const branchChance = 0.26 + 0.3 * activity + (0, seed_1.range)(rng, -0.03, 0.03);
    const foliage = sat(0.35 + 0.6 * activity + (0, seed_1.range)(rng, -0.05, 0.05));
    // commit-time distribution -> bonsai style (upright / slanted / cascade)
    const styleRoll = metrics.weekendRatio + (0, seed_1.range)(rng, -0.02, 0.02);
    const style = styleRoll < 0.2 ? 'formal' : styleRoll < 0.33 ? 'slanted' : 'cascade';
    const leanSign = rng() < 0.5 ? -1 : 1;
    const leanMag = style === 'formal' ? (0, seed_1.range)(rng, 0.04, 0.1) : (0, seed_1.range)(rng, 0.22, 0.42);
    const lean = leanSign * leanMag;
    // streak milestones -> blossom clusters
    const milestones = [7, 30, 100, 365].filter((m) => metrics.maxStreak >= m).length;
    const flowers = milestones + (metrics.currentStreak >= 7 ? 1 : 0);
    // inactivity gaps -> deadwood (jin/shari)
    const deadRatio = Math.min(0.35, metrics.gapsOver60d * 0.06 + (metrics.longestGapDays > 180 ? 0.1 : 0));
    // language epochs -> leaf palettes per tree section
    const epoch0 = metrics.epochLanguages.find((e) => e.epoch === 0)?.lang;
    const epoch1 = metrics.epochLanguages.find((e) => e.epoch === 1)?.lang;
    const primaryPalette = epoch1 ?? metrics.topLanguages[0]?.name ?? 'default';
    const secondaryPalette = epoch0 && epoch0 !== primaryPalette ? epoch0 : null;
    const epochSplit = (0, seed_1.range)(rng, 0.4, 0.55);
    const potWeeks = metrics.potWeeks.slice(0, 52);
    while (potWeeks.length < 52)
        potWeeks.unshift(0);
    return {
        seedKey: metrics.username.toLowerCase(),
        style,
        lean,
        iterations,
        trunkLen,
        baseRadius,
        branchChance: (0, seed_1.clamp)(branchChance, 0.2, 0.6),
        foliage,
        primaryPalette,
        secondaryPalette,
        epochSplit,
        flowers,
        deadRatio,
        potWeeks,
        ageYears,
    };
}
