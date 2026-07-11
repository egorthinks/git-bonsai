"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodePng = encodePng;
const zlib = __importStar(require("zlib"));
const palette_1 = require("./palette");
const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++)
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[n] = c >>> 0;
    }
    return table;
})();
function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++)
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, 'ascii');
    Buffer.from(data).copy(out, 8);
    const crcBuf = Buffer.alloc(4 + data.length);
    crcBuf.write(type, 0, 'ascii');
    Buffer.from(data).copy(crcBuf, 4);
    out.writeUInt32BE(crc32(crcBuf), 8 + data.length);
    return out;
}
/**
 * Encode an indexed frame as a truecolor+alpha PNG with integer nearest-
 * neighbor upscaling. Deterministic: fixed zlib level, no timestamps.
 */
function encodePng(indices, w, h, palette, scale) {
    const ow = w * scale;
    const oh = h * scale;
    const raw = Buffer.alloc(oh * (1 + ow * 4));
    let p = 0;
    for (let y = 0; y < oh; y++) {
        raw[p++] = 0; // filter: none
        const sy = Math.floor(y / scale);
        for (let x = 0; x < ow; x++) {
            const idx = indices[sy * w + Math.floor(x / scale)];
            raw[p++] = palette[idx * 3];
            raw[p++] = palette[idx * 3 + 1];
            raw[p++] = palette[idx * 3 + 2];
            raw[p++] = idx === palette_1.TRANSPARENT ? 0 : 255;
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(ow, 0);
    ihdr.writeUInt32BE(oh, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    const idat = zlib.deflateSync(raw, { level: 9 });
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', new Uint8Array(0)),
    ]);
}
