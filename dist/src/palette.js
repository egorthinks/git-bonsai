"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPECIES = exports.LANG_RAMPS = exports.PALETTE_SIZE = exports.LEAF_E = exports.FLOWER = exports.SOIL = exports.POT = exports.DEAD = exports.TRUNK = exports.OUTLINE = exports.TRANSPARENT = void 0;
exports.rampFor = rampFor;
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
function rampFor(lang) {
    return exports.LANG_RAMPS[lang] ?? exports.LANG_RAMPS.default;
}
/** Language family -> species archetype. */
const FAMILY = {
    C: 'pine', 'C++': 'pine', Rust: 'pine', Go: 'pine', Zig: 'pine',
    Assembly: 'pine', Cuda: 'pine',
    Python: 'maple', Ruby: 'maple', PHP: 'maple', Lua: 'maple', Perl: 'maple',
    R: 'maple', 'Jupyter Notebook': 'maple',
    JavaScript: 'cherry', TypeScript: 'cherry', CSS: 'cherry', HTML: 'cherry',
    Astro: 'cherry', Vue: 'cherry', Svelte: 'cherry',
    Shell: 'juniper', Dockerfile: 'juniper', HCL: 'juniper', Makefile: 'juniper',
    Nix: 'juniper', PowerShell: 'juniper',
    Java: 'elm', Kotlin: 'elm', 'C#': 'elm', Scala: 'elm', Swift: 'elm', Dart: 'elm',
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
/** Build the 32-entry RGB palette: species bark + one leaf ramp per epoch. */
function buildPalette(epochLangs, species = 'maple') {
    const rgb = new Uint8Array(exports.PALETTE_SIZE * 3);
    for (const [idx, color] of Object.entries(BASE))
        hex(rgb, Number(idx), color);
    BARK_RAMPS[species].forEach((color, i) => hex(rgb, exports.TRUNK[i], color));
    for (let e = 0; e < 3; e++) {
        const ramp = rampFor(epochLangs[e]);
        for (let i = 0; i < 4; i++)
            hex(rgb, exports.LEAF_E[e][i], ramp[i]);
    }
    return rgb;
}
