"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPECIES = exports.LANG_RAMPS = exports.PALETTE_SIZE = exports.LEAF_E = exports.FLOWER = exports.SOIL = exports.POT = exports.DEAD = exports.TRUNK = exports.OUTLINE = exports.TRANSPARENT = void 0;
exports.rampFor = rampFor;
exports.seasonize = seasonize;
exports.seasonFromDate = seasonFromDate;
exports.speciesFor = speciesFor;
exports.buildPalette = buildPalette;
/**
 * Fixed indexed palette (32 entries). Index 0 is transparent. Language-specific
 * leaf ramps for the three account epochs are patched into LEAF_E slots when
 * the palette is built.
 */
exports.TRANSPARENT = 0;
exports.OUTLINE = 1;
exports.TRUNK = [2, 3, 4, 5]; // dark -> light
exports.DEAD = [6, 7, 8];
exports.POT = [9, 10, 11];
exports.SOIL = [12, 13, 14, 15, 16]; // activity level 0..4
exports.FLOWER = [25, 26, 27];
/** Leaf ramps per epoch: 0 = oldest third of the account, 2 = newest. */
exports.LEAF_E = [
    [17, 18, 19, 20],
    [21, 22, 23, 24],
    [28, 29, 30, 31],
];
exports.PALETTE_SIZE = 32;
exports.LANG_RAMPS = {
    default: ['#1c4a26', '#2e6b34', '#47934a', '#6fc26e'],
    JavaScript: ['#4c4d16', '#71701f', '#9c9b2e', '#cdc84e'],
    TypeScript: ['#173f5f', '#23608c', '#3585b8', '#5cb4dd'],
    Python: ['#14524d', '#1e7a6f', '#2fa392', '#57ccb6'],
    Rust: ['#6b2d12', '#96461a', '#c26a24', '#e89a44'],
    Go: ['#0e5a66', '#17828f', '#2aabb8', '#58d5dd'],
    Java: ['#5c2f1a', '#874a24', '#b06a32', '#d99a52'],
    Kotlin: ['#4a2a5c', '#6d3f85', '#9058ad', '#b585d2'],
    Ruby: ['#5c1626', '#8c2438', '#bc3a50', '#e56d7f'],
    PHP: ['#33395c', '#4b548c', '#6a75b4', '#96a0d5'],
    C: ['#2f3d5c', '#46598c', '#6379b8', '#8fa3d9'],
    'C++': ['#2f3d5c', '#46598c', '#6379b8', '#8fa3d9'],
    'C#': ['#264a2e', '#3a7045', '#52985e', '#7cc384'],
    Swift: ['#6b3812', '#98511a', '#c47426', '#eba24c'],
    Shell: ['#2c4c22', '#417030', '#5c9744', '#87c46a'],
    HTML: ['#6b3012', '#964a1a', '#c26c24', '#e89a4c'],
    CSS: ['#3c2a5c', '#593f85', '#7a58ad', '#a385d2'],
    Astro: ['#7a2e10', '#ab4a16', '#d8701f', '#f7a03f'],
    'Jupyter Notebook': ['#14524d', '#1e7a6f', '#2fa392', '#57ccb6'],
};
/**
 * Long-tail languages get their ramp derived from one anchor color (the hue
 * GitHub linguist uses for the language), on the same lightness ladder as the
 * hand-tuned ramps above.
 */
const LANG_ANCHORS = {
    Vue: '#41b883',
    Svelte: '#ff3e00',
    Dart: '#00b4ab',
    Scala: '#c22d40',
    Elixir: '#7e5a9e',
    Erlang: '#b83998',
    Haskell: '#5e5086',
    OCaml: '#ef7a08',
    Clojure: '#db5855',
    Lua: '#3a3aa0',
    Perl: '#0298c3',
    R: '#198ce7',
    Julia: '#a270ba',
    Zig: '#ec915c',
    Assembly: '#8a5a1a',
    Dockerfile: '#4a6a78',
    Makefile: '#427819',
    Nix: '#7e7eff',
    HCL: '#844fba',
    PowerShell: '#2a5ac0',
    Solidity: '#aa6746',
    'F#': '#b845fc',
    Groovy: '#4298b8',
    'Objective-C': '#438eff',
    Elm: '#60b5cc',
    Nim: '#d0a500',
    'Vim Script': '#199f4b',
    TeX: '#3d6117',
    MATLAB: '#e16737',
};
for (const [name, anchor] of Object.entries(LANG_ANCHORS)) {
    exports.LANG_RAMPS[name] = rampFromAnchor(anchor);
}
function rampFor(lang) {
    return exports.LANG_RAMPS[lang] ?? exports.LANG_RAMPS.default;
}
// --- color math (pure, deterministic) ---
function hexToRgb(color) {
    return [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
    ];
}
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min)
        return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
        h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
/** Signed shortest-path hue distance from `h` to `target`, degrees. */
function hueDelta(h, target) {
    return ((target - h + 540) % 360) - 180;
}
function rampFromAnchor(anchor) {
    const [h, s] = rgbToHsl(...hexToRgb(anchor));
    const sat = Math.max(0.3, Math.min(0.72, s));
    const ladder = [0.24, 0.35, 0.47, 0.61];
    return ladder.map((l) => {
        const [r, g, b] = hslToRgb(h, sat, l);
        const to2 = (v) => v.toString(16).padStart(2, '0');
        return `#${to2(r)}${to2(g)}${to2(b)}`;
    });
}
/**
 * Seasonal shift of a leaf color, identity-preserving: the language's hue is
 * only nudged, never replaced. Greens turn honestly amber in autumn (that's
 * what leaves do); far-from-green hues (a TypeScript blue, a Kotlin violet)
 * keep their hue and only pick up warmth and saturation — so the tree's
 * per-epoch identity survives every season.
 */
function seasonize(rgb, season) {
    if (season === 'summer')
        return rgb;
    let [h, s, l] = rgbToHsl(...rgb);
    if (season === 'spring') {
        // the fresh flush: clearly lighter, slightly yellow-green
        h += hueDelta(h, 90) * 0.1;
        s = Math.min(1, s * 1.12);
        l = Math.min(0.92, l + 0.08);
    }
    else if (season === 'autumn') {
        // only the true-green family turns amber (that is what leaves do); any
        // other hue — a TypeScript blue, a Python teal — keeps its hue and goes
        // deep and rich instead. Identity survives the fall.
        const greenness = Math.max(0, 1 - Math.abs(hueDelta(h, 110)) / 48);
        if (greenness > 0) {
            h += hueDelta(h, 38) * 0.85 * Math.pow(greenness, 0.7);
            s = Math.min(1, s * (1 + 0.2 * greenness));
        }
        else {
            h += hueDelta(h, 35) * 0.06;
            s = Math.min(1, s * 1.05);
            l *= 0.88;
        }
    }
    else {
        // winter: frost mutes everything, hue stays put (a whisper of cool)
        h += hueDelta(h, 210) * 0.06;
        s *= 0.5;
        l = Math.min(0.95, l * 0.94 + 0.08);
    }
    return hslToRgb(h, s, l);
}
/** Map an ISO date to the (northern-hemisphere) season, deterministically. */
function seasonFromDate(isoDate) {
    const month = Number(isoDate.slice(5, 7));
    return month >= 3 && month <= 5 ? 'spring'
        : month >= 6 && month <= 8 ? 'summer'
            : month >= 9 && month <= 11 ? 'autumn'
                : 'winter';
}
/** Language family -> species archetype. */
const FAMILY = {
    C: 'pine', 'C++': 'pine', Rust: 'pine', Go: 'pine', Zig: 'pine',
    Assembly: 'pine', Cuda: 'pine', Nim: 'pine', Solidity: 'pine',
    Python: 'maple', Ruby: 'maple', PHP: 'maple', Lua: 'maple', Perl: 'maple',
    R: 'maple', 'Jupyter Notebook': 'maple', Elixir: 'maple', Erlang: 'maple',
    Julia: 'maple', MATLAB: 'maple',
    JavaScript: 'cherry', TypeScript: 'cherry', CSS: 'cherry', HTML: 'cherry',
    Astro: 'cherry', Vue: 'cherry', Svelte: 'cherry', Elm: 'cherry',
    Shell: 'juniper', Dockerfile: 'juniper', HCL: 'juniper', Makefile: 'juniper',
    Nix: 'juniper', PowerShell: 'juniper', 'Vim Script': 'juniper', TeX: 'juniper',
    Java: 'elm', Kotlin: 'elm', 'C#': 'elm', Scala: 'elm', Swift: 'elm', Dart: 'elm',
    Haskell: 'elm', OCaml: 'elm', Clojure: 'elm', 'F#': 'elm', Groovy: 'elm',
    'Objective-C': 'elm',
};
function speciesFor(lang) {
    return (lang && FAMILY[lang]) || 'maple';
}
exports.SPECIES = {
    pine: { padFlatten: 1.6, padThreshold: 0.56, stamp: [[0, 0], [1, -1]], barkAmp: 0.3, droop: 0.2 },
    maple: { padFlatten: 1.15, padThreshold: 0.5, stamp: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]], barkAmp: 0.22, droop: 0.1 },
    cherry: { padFlatten: 1.05, padThreshold: 0.46, stamp: [[0, 0], [1, 0], [0, 1], [1, 1]], barkAmp: 0.16, droop: 0.14 },
    juniper: { padFlatten: 1.35, padThreshold: 0.6, stamp: [[0, 0]], barkAmp: 0.28, droop: 0.05 },
    elm: { padFlatten: 1.2, padThreshold: 0.52, stamp: [[0, 0], [0, 1]], barkAmp: 0.14, droop: 0.04 },
};
/** Bark color ramps (palette slots 2-5) per species, dark -> light. */
const BARK_RAMPS = {
    pine: ['#402318', '#5f3a24', '#7f5433', '#9f7146'], // red-brown plates
    maple: ['#3f3a35', '#5c564f', '#7b746b', '#9c948a'], // smooth silver-gray
    cherry: ['#3f201a', '#61352a', '#844d39', '#a86a4d'], // mahogany
    juniper: ['#38352f', '#555148', '#736e62', '#928d7f'], // fibrous gray
    elm: ['#4a443a', '#6b6455', '#8e8672', '#b1a890'], // pale tan-gray
};
const BASE = {
    1: '#14100b',
    2: '#3d2b1a', 3: '#5c4026', 4: '#7d5a35', 5: '#9c7648',
    6: '#6e6a5e', 7: '#9c9787', 8: '#cfc9b4',
    9: '#4f2a1d', 10: '#77402a', 11: '#a05c3b',
    12: '#2b2016', 13: '#2a5a33', 14: '#3e7d43', 15: '#58a85b', 16: '#7fd487',
    25: '#c95e8e', 26: '#eb92b9', 27: '#fbd3e3',
};
function hex(rgb, index, color) {
    rgb[index * 3] = parseInt(color.slice(1, 3), 16);
    rgb[index * 3 + 1] = parseInt(color.slice(3, 5), 16);
    rgb[index * 3 + 2] = parseInt(color.slice(5, 7), 16);
}
/**
 * Build the 32-entry RGB palette: species bark + one leaf ramp per epoch,
 * with the season's identity-preserving shift applied to the leaves only —
 * bark, pot and soil never change with the calendar.
 */
function buildPalette(epochLangs, species = 'maple', season = 'summer') {
    const rgb = new Uint8Array(exports.PALETTE_SIZE * 3);
    for (const [idx, color] of Object.entries(BASE))
        hex(rgb, Number(idx), color);
    BARK_RAMPS[species].forEach((color, i) => hex(rgb, exports.TRUNK[i], color));
    for (let e = 0; e < 3; e++) {
        const ramp = rampFor(epochLangs[e]);
        for (let i = 0; i < 4; i++) {
            const [r, g, b] = seasonize(hexToRgb(ramp[i]), season);
            const slot = exports.LEAF_E[e][i];
            rgb[slot * 3] = r;
            rgb[slot * 3 + 1] = g;
            rgb[slot * 3 + 2] = b;
        }
    }
    return rgb;
}
