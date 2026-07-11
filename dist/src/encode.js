"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.frameToPng = frameToPng;
exports.frameToSvg = frameToSvg;
exports.framesToGif = framesToGif;
const png_1 = require("./png");
const gif_1 = require("./gif");
const palette_1 = require("./palette");
function frameToPng(frame, palette, scale = 4) {
    return (0, png_1.encodePng)(frame.color, frame.w, frame.h, palette, scale);
}
/** Static SVG snapshot: the pixel buffer embedded as a nearest-neighbor image. */
function frameToSvg(frame, palette, scale = 4) {
    const png = (0, png_1.encodePng)(frame.color, frame.w, frame.h, palette, 1);
    const w = frame.w * scale;
    const h = frame.h * scale;
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
        `<image width="${w}" height="${h}" style="image-rendering:pixelated" href="data:image/png;base64,${png.toString('base64')}"/>`,
        `</svg>`,
        ``,
    ].join('\n');
}
function framesToGif(set, palette) {
    return (0, gif_1.encodeGif)(set.frames.map((f) => f.color), set.frames[0].w, set.frames[0].h, palette, { delays: set.delays, transparentIndex: palette_1.TRANSPARENT, loops: 0 });
}
