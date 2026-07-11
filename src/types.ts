/** Normalized GitHub metrics — the only input to the deterministic pipeline. */
export interface Metrics {
  username: string;
  /** ISO timestamp of account creation. */
  createdAt: string;
  /** ISO date (day granularity) the metrics were captured; used for age math. */
  fetchedAt: string;
  totalContributions: number;
  /** Overall top languages, sorted by ratio desc. */
  topLanguages: { name: string; ratio: number }[];
  /** Dominant language of the older (epoch 0) and newer (epoch 1) half of the account. */
  epochLanguages: { epoch: 0 | 1; lang: string }[];
  currentStreak: number;
  maxStreak: number;
  longestGapDays: number;
  /** Number of inactivity gaps longer than 60 days. */
  gapsOver60d: number;
  /** Share of contributions made on Sat/Sun (0..1). */
  weekendRatio: number;
  /** Last 52 weeks as activity levels 0..4 (oldest first) — becomes the pot's soil mosaic. */
  potWeeks: number[];
}

export type Style = 'formal' | 'slanted' | 'cascade';

/** The tree "genotype": every knob the renderer needs, derived from metrics + seeded PRNG. */
export interface BonsaiDNA {
  seedKey: string;
  style: Style;
  /** Trunk lean in radians; positive leans right. */
  lean: number;
  /** Max branching order (recursion depth), 3..6. */
  iterations: number;
  /** First trunk section length in pixels. */
  trunkLen: number;
  /** Trunk radius at the base in pixels. */
  baseRadius: number;
  /** Probability of spawning a side branch at a growth step (0..1). */
  branchChance: number;
  /** Twig/leaf richness (0..1). */
  foliage: number;
  primaryPalette: string;
  secondaryPalette: string | null;
  /** birth-time fraction that separates epoch-0 wood from epoch-1 wood. */
  epochSplit: number;
  /** Number of blossom clusters earned via streak milestones. */
  flowers: number;
  /** Fraction of foliage pads turned into deadwood (jin) by inactivity gaps. */
  deadRatio: number;
  potWeeks: number[];
  ageYears: number;
}
