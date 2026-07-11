"use strict";
/**
 * Minimal deterministic GIF89a encoder for indexed frames with a global
 * palette, transparency, and infinite looping. LZW implemented from scratch.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeGif = encodeGif;
class BitWriter {
    bytes = [];
    cur = 0;
    nbits = 0;
    write(code, width) {
        this.cur |= code << this.nbits;
        this.nbits += width;
        while (this.nbits >= 8) {
            this.bytes.push(this.cur & 0xff);
            this.cur >>>= 8;
            this.nbits -= 8;
        }
    }
    finish() {
        if (this.nbits > 0)
            this.bytes.push(this.cur & 0xff);
        return this.bytes;
    }
}
function lzwEncode(pixels, minCodeSize) {
    const clear = 1 << minCodeSize;
    const eoi = clear + 1;
    const bw = new BitWriter();
    let codeSize = minCodeSize + 1;
    let dict = new Map();
    let next = eoi + 1;
    bw.write(clear, codeSize);
    let prefix = pixels[0];
    for (let i = 1; i < pixels.length; i++) {
        const k = pixels[i];
        const key = (prefix << 8) | k;
        const found = dict.get(key);
        if (found !== undefined) {
            prefix = found;
            continue;
        }
        bw.write(prefix, codeSize);
        dict.set(key, next++);
        if (next === (1 << codeSize) + 1 && codeSize < 12)
            codeSize++;
        if (next >= 4096) {
            bw.write(clear, codeSize);
            dict = new Map();
            next = eoi + 1;
            codeSize = minCodeSize + 1;
        }
        prefix = k;
    }
    bw.write(prefix, codeSize);
    bw.write(eoi, codeSize);
    return bw.finish();
}
function encodeGif(frames, w, h, palette, opts) {
    const out = [];
    const push = (...b) => out.push(...b);
    const push16 = (v) => push(v & 0xff, (v >> 8) & 0xff);
    // header + logical screen descriptor (32-color global table)
    for (const c of 'GIF89a')
        push(c.charCodeAt(0));
    push16(w);
    push16(h);
    push(0xf4, 0, 0); // GCT present, 8-bit color res, 2^(4+1)=32 entries
    for (let i = 0; i < 32 * 3; i++)
        push(palette[i] ?? 0);
    // NETSCAPE loop extension
    push(0x21, 0xff, 0x0b);
    for (const c of 'NETSCAPE2.0')
        push(c.charCodeAt(0));
    push(0x03, 0x01);
    push16(opts.loops ?? 0);
    push(0x00);
    const minCodeSize = 5;
    frames.forEach((frame, fi) => {
        // graphic control: dispose-to-background + transparency
        push(0x21, 0xf9, 0x04, 0x09);
        push16(opts.delays[fi] ?? opts.delays[opts.delays.length - 1] ?? 8);
        push(opts.transparentIndex, 0x00);
        // image descriptor (full frame, no local table)
        push(0x2c);
        push16(0);
        push16(0);
        push16(w);
        push16(h);
        push(0x00);
        push(minCodeSize);
        const data = lzwEncode(frame, minCodeSize);
        for (let i = 0; i < data.length; i += 255) {
            const n = Math.min(255, data.length - i);
            push(n);
            for (let j = 0; j < n; j++)
                push(data[i + j]);
        }
        push(0x00);
    });
    push(0x3b);
    return Buffer.from(out);
}
