/** Pixel-class layers used for shading and keyline decisions. */
export const CLS_EMPTY = 0;
export const CLS_WOOD = 1;
export const CLS_DEAD = 2;
export const CLS_CANOPY = 3;
export const CLS_FLOWER = 4;
export const CLS_POT = 5;
export const CLS_SOIL = 6;
export const CLS_OUTLINE = 7;

export class Frame {
  readonly w: number;
  readonly h: number;
  /** Palette indices. */
  readonly color: Uint8Array;
  /** Pixel classes (CLS_*). */
  readonly cls: Uint8Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.color = new Uint8Array(w * h);
    this.cls = new Uint8Array(w * h);
  }

  set(x: number, y: number, colorIdx: number, cls: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.color[i] = colorIdx;
    this.cls[i] = cls;
  }

  clsAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return CLS_EMPTY;
    return this.cls[y * this.w + x];
  }
}

/** Bresenham line — used for 1px twigs. */
export function bresenham(
  x1: number, y1: number, x2: number, y2: number,
  plot: (x: number, y: number) => void,
): void {
  let x = Math.round(x1);
  let y = Math.round(y1);
  const ex = Math.round(x2);
  const ey = Math.round(y2);
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    plot(x, y);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/**
 * Scanline-fill a capsule (thick line with round caps) into a mask.
 * Falls back to Bresenham for sub-pixel radii.
 */
export function fillCapsule(
  mask: Uint8Array, w: number, h: number,
  x1: number, y1: number, x2: number, y2: number, r: number,
  value: number,
): void {
  if (r < 0.65) {
    bresenham(x1, y1, x2, y2, (x, y) => {
      if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = value;
    });
    return;
  }
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - r - 1));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x1, x2) + r + 1));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - r - 1));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y1, y2) + r + 1));
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  const rr = (r + 0.25) * (r + 0.25);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / len2)) : 0;
      const dx = x - (x1 + vx * t);
      const dy = y - (y1 + vy * t);
      if (dx * dx + dy * dy <= rr) mask[y * w + x] = value;
    }
  }
}
