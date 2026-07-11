/**
 * Fixed indexed palette (32 entries). Index 0 is transparent. Language-specific
 * leaf ramps are patched into slots LEAF_A / LEAF_B when the palette is built.
 */
export const TRANSPARENT = 0;
export const OUTLINE = 1;
export const TRUNK = [2, 3, 4, 5] as const; // dark -> light
export const DEAD = [6, 7, 8] as const;
export const POT = [9, 10, 11] as const;
export const SOIL = [12, 13, 14, 15, 16] as const; // activity level 0..4
export const LEAF_A = [17, 18, 19, 20] as const;
export const LEAF_B = [21, 22, 23, 24] as const;
export const FLOWER = [25, 26, 27] as const;
export const PALETTE_SIZE = 32;

/** Leaf-stamp shapes: 0 = 2x2 block, 1 = plus, 2 = diagonal pair. */
export interface LeafRamp {
  colors: [string, string, string, string];
  stamp: 0 | 1 | 2;
}

export const LANG_RAMPS: Record<string, LeafRamp> = {
  default: { colors: ['#1c4a26', '#2e6b34', '#47934a', '#6fc26e'], stamp: 0 },
  JavaScript: { colors: ['#4c4d16', '#71701f', '#9c9b2e', '#cdc84e'], stamp: 1 },
  TypeScript: { colors: ['#173f5f', '#23608c', '#3585b8', '#5cb4dd'], stamp: 0 },
  Python: { colors: ['#14524d', '#1e7a6f', '#2fa392', '#57ccb6'], stamp: 1 },
  Rust: { colors: ['#6b2d12', '#96461a', '#c26a24', '#e89a44'], stamp: 2 },
  Go: { colors: ['#0e5a66', '#17828f', '#2aabb8', '#58d5dd'], stamp: 0 },
  Java: { colors: ['#5c2f1a', '#874a24', '#b06a32', '#d99a52'], stamp: 2 },
  Kotlin: { colors: ['#4a2a5c', '#6d3f85', '#9058ad', '#b585d2'], stamp: 0 },
  Ruby: { colors: ['#5c1626', '#8c2438', '#bc3a50', '#e56d7f'], stamp: 1 },
  PHP: { colors: ['#33395c', '#4b548c', '#6a75b4', '#96a0d5'], stamp: 0 },
  C: { colors: ['#2f3d5c', '#46598c', '#6379b8', '#8fa3d9'], stamp: 2 },
  'C++': { colors: ['#2f3d5c', '#46598c', '#6379b8', '#8fa3d9'], stamp: 2 },
  'C#': { colors: ['#264a2e', '#3a7045', '#52985e', '#7cc384'], stamp: 0 },
  Swift: { colors: ['#6b3812', '#98511a', '#c47426', '#eba24c'], stamp: 1 },
  Shell: { colors: ['#2c4c22', '#417030', '#5c9744', '#87c46a'], stamp: 2 },
  HTML: { colors: ['#6b3012', '#964a1a', '#c26c24', '#e89a4c'], stamp: 0 },
  CSS: { colors: ['#3c2a5c', '#593f85', '#7a58ad', '#a385d2'], stamp: 0 },
};

export function rampFor(lang: string): LeafRamp {
  return LANG_RAMPS[lang] ?? LANG_RAMPS.default;
}

const BASE: Record<number, string> = {
  1: '#14100b',
  2: '#3d2b1a', 3: '#5c4026', 4: '#7d5a35', 5: '#9c7648',
  6: '#6e6a5e', 7: '#9c9787', 8: '#cfc9b4',
  9: '#4f2a1d', 10: '#77402a', 11: '#a05c3b',
  12: '#2b2016', 13: '#2a5a33', 14: '#3e7d43', 15: '#58a85b', 16: '#7fd487',
  25: '#c95e8e', 26: '#eb92b9', 27: '#fbd3e3',
};

function hex(rgb: Uint8Array, index: number, color: string): void {
  rgb[index * 3] = parseInt(color.slice(1, 3), 16);
  rgb[index * 3 + 1] = parseInt(color.slice(3, 5), 16);
  rgb[index * 3 + 2] = parseInt(color.slice(5, 7), 16);
}

/** Build the 32-entry RGB palette with leaf ramps for the given languages. */
export function buildPalette(primaryLang: string, secondaryLang: string | null): Uint8Array {
  const rgb = new Uint8Array(PALETTE_SIZE * 3);
  for (const [idx, color] of Object.entries(BASE)) hex(rgb, Number(idx), color);
  const a = rampFor(primaryLang);
  const b = secondaryLang ? rampFor(secondaryLang) : a;
  for (let i = 0; i < 4; i++) {
    hex(rgb, LEAF_A[i], a.colors[i]);
    hex(rgb, LEAF_B[i], b.colors[i]);
  }
  return rgb;
}
