import { Frame } from './raster';
import { encodePng } from './png';
import { encodeGif } from './gif';
import { TRANSPARENT } from './palette';
import { FrameSet } from './animate';

export function frameToPng(frame: Frame, palette: Uint8Array, scale = 4): Buffer {
  return encodePng(frame.color, frame.w, frame.h, palette, scale);
}

/** Static SVG snapshot: the pixel buffer embedded as a nearest-neighbor image. */
export function frameToSvg(frame: Frame, palette: Uint8Array, scale = 4): string {
  const png = encodePng(frame.color, frame.w, frame.h, palette, 1);
  const w = frame.w * scale;
  const h = frame.h * scale;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<image width="${w}" height="${h}" style="image-rendering:pixelated" href="data:image/png;base64,${png.toString('base64')}"/>`,
    `</svg>`,
    ``,
  ].join('\n');
}

export function framesToGif(set: FrameSet, palette: Uint8Array): Buffer {
  return encodeGif(
    set.frames.map((f) => f.color),
    set.frames[0].w,
    set.frames[0].h,
    palette,
    { delays: set.delays, transparentIndex: TRANSPARENT, loops: 0 },
  );
}
