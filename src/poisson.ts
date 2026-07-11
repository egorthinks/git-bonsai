import { Rng } from './seed';

export interface Pt {
  x: number;
  y: number;
}

/**
 * Bridson's Poisson-disk sampling inside a w×h rectangle with minimum
 * distance r between samples. Deterministic given the PRNG.
 */
export function poissonDisk(rng: Rng, w: number, h: number, r: number, k = 20): Pt[] {
  const cell = r / Math.SQRT2;
  const gw = Math.max(1, Math.ceil(w / cell));
  const gh = Math.max(1, Math.ceil(h / cell));
  const grid = new Int32Array(gw * gh).fill(-1);
  const pts: Pt[] = [];
  const active: number[] = [];

  const insert = (p: Pt): void => {
    const gx = Math.min(gw - 1, Math.floor(p.x / cell));
    const gy = Math.min(gh - 1, Math.floor(p.y / cell));
    grid[gy * gw + gx] = pts.length;
    pts.push(p);
    active.push(pts.length - 1);
  };

  const farEnough = (x: number, y: number): boolean => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    for (let oy = -2; oy <= 2; oy++) {
      for (let ox = -2; ox <= 2; ox++) {
        const nx = gx + ox;
        const ny = gy + oy;
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const idx = grid[ny * gw + nx];
        if (idx < 0) continue;
        const dx = pts[idx].x - x;
        const dy = pts[idx].y - y;
        if (dx * dx + dy * dy < r * r) return false;
      }
    }
    return true;
  };

  insert({ x: rng() * w, y: rng() * h });

  while (active.length > 0) {
    const ai = Math.floor(rng() * active.length);
    const base = pts[active[ai]];
    let placed = false;
    for (let tries = 0; tries < k; tries++) {
      const ang = rng() * Math.PI * 2;
      const rad = r * (1 + rng());
      const x = base.x + Math.cos(ang) * rad;
      const y = base.y + Math.sin(ang) * rad;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (!farEnough(x, y)) continue;
      insert({ x, y });
      placed = true;
      break;
    }
    if (!placed) {
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }
  return pts;
}
