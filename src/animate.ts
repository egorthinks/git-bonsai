import { BonsaiDNA } from './types';
import { Skeleton } from './skeleton';
import { renderFrame } from './render';
import { Frame } from './raster';

export interface FrameSet {
  frames: Frame[];
  /** Centiseconds per frame. */
  delays: number[];
}

/** Seamless wind loop: sine + phase-shifted simplex, petals if in bloom. */
export function windFrames(dna: BonsaiDNA, skel: Skeleton, count = 24): FrameSet {
  const frames: Frame[] = [];
  const delays: number[] = [];
  for (let f = 0; f < count; f++) {
    frames.push(renderFrame(dna, skel, { windPhase: (f / count) * Math.PI * 2 }));
    delays.push(8);
  }
  return { frames, delays };
}

/** Growth timelapse: seed to the current tree in ~4-6 seconds, then hold. */
export function growthFrames(dna: BonsaiDNA, skel: Skeleton, count = 44): FrameSet {
  const frames: Frame[] = [];
  const delays: number[] = [];
  for (let f = 0; f < count; f++) {
    const lin = f / (count - 1);
    const t = 1 - Math.pow(1 - lin, 2.2); // fast youth, slow maturity
    frames.push(renderFrame(dna, skel, { growthT: t, windPhase: null }));
    delays.push(f === count - 1 ? 300 : 10);
  }
  return { frames, delays };
}
