"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fnv1a = fnv1a;
exports.makeRng = makeRng;
exports.range = range;
exports.pick = pick;
exports.clamp = clamp;
/** FNV-1a 32-bit hash. */
function fnv1a(str, seed = 0x811c9dc5) {
    let h = seed >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
/** sfc32 PRNG seeded from four FNV-1a hashes of the key. Returns floats in [0, 1). */
function makeRng(key) {
    let a = fnv1a(key + '#0');
    let b = fnv1a(key + '#1');
    let c = fnv1a(key + '#2');
    let d = fnv1a(key + '#3');
    // warm up so weakly-differing keys diverge
    const rng = () => {
        a >>>= 0;
        b >>>= 0;
        c >>>= 0;
        d >>>= 0;
        let t = (a + b) | 0;
        a = b ^ (b >>> 9);
        b = (c + (c << 3)) | 0;
        c = (c << 21) | (c >>> 11);
        d = (d + 1) | 0;
        t = (t + d) | 0;
        c = (c + t) | 0;
        return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 12; i++)
        rng();
    return rng;
}
function range(rng, min, max) {
    return min + rng() * (max - min);
}
function pick(rng, arr) {
    return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];
}
function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}
