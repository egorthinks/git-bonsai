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
  /** Dominant language of each third of the account's life (0 = oldest). */
  epochLanguages: { epoch: 0 | 1 | 2; lang: string }[];
  currentStreak: number;
  maxStreak: number;
  longestGapDays: number;
  /** Number of inactivity gaps longer than 60 days. */
  gapsOver60d: number;
  /** Share of contributions made on Sat/Sun (0..1). */
  weekendRatio: number;
  /** Last 52 weeks as activity levels 0..4 (oldest first) — becomes the pot's soil mosaic. */
  potWeeks: number[];
  /** Coefficient of variation of weekly activity (low = metronome, high = erratic). */
  weeklyCv?: number;
  /** Share of all contributions landing in the top 10% most active weeks (high = storms). */
  burstiness?: number;
  /** Number of owned, non-fork repositories. */
  repoCount?: number;
}

/**
 * Trunk styles, named after the bonsai tradition:
 * formal = chokkan, slanted = shakan, cascade = kengai,
 * han-kengai = semi-cascade, bunjin = literati, windswept = fukinagashi,
 * broom = hokidachi.
 */
export type Style =
  | 'formal'
  | 'slanted'
  | 'han-kengai'
  | 'cascade'
  | 'bunjin'
  | 'windswept'
  | 'broom';

/** Species archetypes: each bundles crown shape, leaf stamp and bark texture. */
export type SpeciesId = 'pine' | 'maple' | 'cherry' | 'juniper' | 'elm';

/** The tree "genotype": every knob the renderer needs, derived from metrics + seeded PRNG. */
export interface BonsaiDNA {
  seedKey: string;
  style: Style;
  species: SpeciesId;
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
  /** Leaf ramp language per epoch (0 = oldest third of the account's life). */
  palettes: [string, string, string];
  /** Birth-time fractions separating the three wood/canopy epochs. */
  epochSplits: [number, number];
  /** Number of blossom clusters earned via streak milestones. */
  flowers: number;
  /** Fraction of foliage pads turned into deadwood (jin) by inactivity gaps. */
  deadRatio: number;
  /** Massive-trunk class for extreme veterans. */
  sumo: boolean;
  /** Number of visible root buttresses (nebari), from repo breadth. */
  rootFlare: number;
  /** Pale deadwood strip along the trunk — one gap longer than a year. */
  shari: boolean;
  /** Hollow in the trunk — returned after 2+ years of silence. */
  uro: boolean;
  potWeeks: number[];
  ageYears: number;
}
