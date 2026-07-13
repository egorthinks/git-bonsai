"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Frame = exports.CLS_OUTLINE = exports.CLS_SOIL = exports.CLS_POT = exports.CLS_FLOWER = exports.CLS_CANOPY = exports.CLS_DEAD = exports.CLS_WOOD = exports.CLS_EMPTY = void 0;
exports.fitBox = fitBox;
exports.cropFrame = cropFrame;
exports.bresenham = bresenham;
exports.fillCapsule = fillCapsule;
/** Pixel-class layers used for shading and keyline decisions. */
exports.CLS_EMPTY = 0;
exports.CLS_WOOD = 1;
exports.CLS_DEAD = 2;
exports.CLS_CANOPY = 3;
exports.CLS_FLOWER = 4;
exports.CLS_POT = 5;
exports.CLS_SOIL = 6;
exports.CLS_OUTLINE = 7;
class Frame {
    w;
    h;
    /** Palette indices. */
    color;
    /** Pixel classes (CLS_*). */
    cls;
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.color = new Uint8Array(w * h);
        this.cls = new Uint8Array(w * h);
    }
    set(x, y, colorIdx, cls) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h)
            return;
        const i = y * this.w + x;
        this.color[i] = colorIdx;
        this.cls[i] = cls;
    }
    clsAt(x, y) {
        if (x < 0 || y < 0 || x >= this.w || y >= this.h)
            return exports.CLS_EMPTY;
        return this.cls[y * this.w + x];
    }
}
exports.Frame = Frame;
/**
 * Adaptive framing: the union bounding box of drawn pixels (palette index 0 is
 * the transparent background) across every frame, plus equal padding — so a
 * leaning crown gets the same breathing room as the pot. Purely a post-render
 * measurement — generation is untouched.
 */
function fitBox(frames, pad = 10) {
    const W = frames[0].w;
    const H = frames[0].h;
    let minX = W, maxX = -1, minY = H, maxY = -1;
    for (const f of frames) {
        for (let y = 0; y < H; y++) {
            const row = y * W;
            for (let x = 0; x < W; x++) {
                if (f.color[row + x] !== 0) {
                    if (x < minX)
                        minX = x;
                    if (x > maxX)
                        maxX = x;
                    if (y < minY)
                        minY = y;
                    if (y > maxY)
                        maxY = y;
                }
            }
        }
    }
    if (maxX < 0)
        return { x: 0, y: 0, w: W, h: H }; // nothing drawn: keep the full canvas
    const x0 = Math.max(0, minX - pad);
    const x1 = Math.min(W, maxX + 1 + pad);
    const y0 = Math.max(0, minY - pad);
    const y1 = Math.min(H, maxY + 1 + pad);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** Copy a sub-rectangle into a new Frame (returns the frame itself if the box is full-size). */
function cropFrame(f, box) {
    if (box.x === 0 && box.y === 0 && box.w === f.w && box.h === f.h)
        return f;
    const out = new Frame(box.w, box.h);
    for (let y = 0; y < box.h; y++) {
        const src = (y + box.y) * f.w + box.x;
        out.color.set(f.color.subarray(src, src + box.w), y * box.w);
        out.cls.set(f.cls.subarray(src, src + box.w), y * box.w);
    }
    return out;
}
/** Bresenham line — used for 1px twigs. */
function bresenham(x1, y1, x2, y2, plot) {
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
        if (x === ex && y === ey)
            break;
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            x += sx;
        }
        if (e2 <= dx) {
            err += dx;
            y += sy;
        }
    }
}
/**
 * Scanline-fill a capsule (thick line with round caps) into a mask.
 * Falls back to Bresenham for sub-pixel radii.
 */
function fillCapsule(mask, w, h, x1, y1, x2, y2, r, value) {
    if (r < 0.65) {
        bresenham(x1, y1, x2, y2, (x, y) => {
            if (x >= 0 && y >= 0 && x < w && y < h)
                mask[y * w + x] = value;
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
            if (dx * dx + dy * dy <= rr)
                mask[y * w + x] = value;
        }
    }
}
