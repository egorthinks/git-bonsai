import { Metrics, BonsaiDNA, Season } from './types';
import { makeRng } from './seed';
import { deriveDna } from './dna';
import { buildSkeleton, Skeleton } from './skeleton';
import { applyThickness } from './thickness';
import { renderFrame } from './render';
import { windFrames, growthFrames } from './animate';
import { buildPalette, seasonFromDate } from './palette';
import { frameToSvg, frameToPng, framesToGif } from './encode';

export { Metrics, BonsaiDNA, Season } from './types';
export { fetchMetrics, loadFixture, synthMetrics } from './data';
export { seasonFromDate } from './palette';

export interface BonsaiOutput {
  /** Static snapshot for fast README embeds. */
  svg: string;
  /** Static PNG preview (same frame as the SVG). */
  png: Buffer;
  /** Looping wind animation. */
  gif: Buffer;
  /** Growth timelapse: seed -> current tree. */
  growthGif: Buffer;
  dna: BonsaiDNA;
}

export interface GenerateOptions {
  scale?: number;
  windFrameCount?: number;
  growthFrameCount?: number;
  /**
   * Seasonal leaf-palette shift. 'auto' (the default) derives the season from
   * metrics.fetchedAt — still fully deterministic: same metrics, same bytes.
   */
  season?: Season | 'auto';
}

/**
 * The full deterministic pipeline:
 * metrics -> seed -> dna -> skeleton -> thickness -> raster/shade/foliage -> animate -> encode.
 * Same metrics in, bit-identical bytes out.
 */
export function generate(metrics: Metrics, opts: GenerateOptions = {}): BonsaiOutput {
  const scale = opts.scale ?? 3; // 256 native -> 768 display
  const seedKey = metrics.username.toLowerCase();
  const rng = makeRng(seedKey);
  const dna = deriveDna(metrics, rng);
  const skel: Skeleton = buildSkeleton(dna, rng);
  applyThickness(skel, dna);
  const season: Season =
    !opts.season || opts.season === 'auto' ? seasonFromDate(metrics.fetchedAt) : opts.season;
  const palette = buildPalette(dna.palettes, dna.species, season);

  const still = renderFrame(dna, skel, { growthT: 1, windPhase: null });
  const wind = windFrames(dna, skel, opts.windFrameCount ?? 24);
  const growth = growthFrames(dna, skel, opts.growthFrameCount ?? 44);

  return {
    svg: frameToSvg(still, palette, scale),
    png: frameToPng(still, palette, scale),
    gif: framesToGif(wind, palette),
    growthGif: framesToGif(growth, palette),
    dna,
  };
}
