import { Metrics, BonsaiDNA, Style } from './types';
import { Rng, clamp, range } from './seed';
import { speciesFor } from './palette';

const DAY_MS = 86_400_000;

function sat(v: number): number {
  return clamp(v, 0, 1);
}

/**
 * Map normalized metrics + the seeded PRNG onto tree parameters (§5 of the
 * spec + ROADMAP styles). All rng() draws happen unconditionally and in a
 * fixed order, so the same username keeps its "personality" as metrics evolve.
 */
export function deriveDna(metrics: Metrics, rng: Rng): BonsaiDNA {
  // draw every random value up front — style branches must not shift the stream
  const trunkJit = range(rng, -2, 2);
  const branchJit = range(rng, -0.03, 0.03);
  const foliageJit = range(rng, -0.05, 0.05);
  const styleJit = range(rng, -0.02, 0.02);
  const leanSign = rng() < 0.5 ? -1 : 1;
  const leanRoll = rng();
  const splitJitA = range(rng, -0.04, 0.04);
  const splitJitB = range(rng, -0.04, 0.04);

  const ageYears = Math.max(
    0,
    (Date.parse(metrics.fetchedAt) - Date.parse(metrics.createdAt)) / (DAY_MS * 365.25),
  );
  const activity = sat(Math.log10(metrics.totalContributions + 1) / 4.5); // ~30k commits -> 1.0
  const cv = metrics.weeklyCv ?? 1.0;
  const burstiness = metrics.burstiness ?? 0.3;
  const repoCount = metrics.repoCount ?? 6;

  // account age -> trunk height, growth iterations, base thickness
  const iterations = clamp(3 + Math.floor(ageYears / 3), 3, 6);
  let trunkLen = 27 + Math.min(ageYears, 12) * 2.5 + trunkJit;
  let baseRadius = clamp(3.3 + Math.min(ageYears, 12) * 0.35 + activity * 2.1, 3.3, 8.7);

  // total contributions -> branch density & foliage
  let branchChance = clamp(0.26 + 0.3 * activity + branchJit, 0.2, 0.6);
  let foliage = sat(0.35 + 0.6 * activity + foliageJit);

  // style: rhythm signals first, then the weekend bands (see ROADMAP §1)
  let style: Style;
  if (burstiness > 0.52) {
    style = 'windswept'; // storms of commits after long quiet spells
  } else if (cv < 0.55 && metrics.maxStreak >= 60) {
    style = 'broom'; // metronome consistency
  } else if (ageYears > 8 && repoCount <= 6 && activity < 0.8) {
    style = 'bunjin'; // the old minimalist scholar
  } else {
    const wr = metrics.weekendRatio + styleJit;
    style = wr < 0.2 ? 'formal' : wr < 0.3 ? 'slanted' : wr < 0.38 ? 'han-kengai' : 'cascade';
  }

  const leanBands: Record<Style, [number, number]> = {
    formal: [0.04, 0.1],
    broom: [0.02, 0.06],
    slanted: [0.22, 0.42],
    'han-kengai': [0.24, 0.4],
    cascade: [0.22, 0.42],
    bunjin: [0.15, 0.3],
    windswept: [0.3, 0.48],
  };
  const [lo, hi] = leanBands[style];
  const lean = leanSign * (lo + leanRoll * (hi - lo));

  // style-specific body plans
  if (style === 'bunjin') {
    trunkLen *= 1.35;
    baseRadius *= 0.78;
    branchChance *= 0.55;
    foliage = Math.min(foliage, 0.45);
  } else if (style === 'broom') {
    trunkLen *= 0.9;
    baseRadius *= 0.85;
    branchChance = Math.max(branchChance, 0.5);
  } else if (style === 'windswept') {
    branchChance *= 0.65; // fewer, well-separated streaming layers
    baseRadius *= 0.75;   // wiry survivor, not a heavyweight
  }

  // sumo class: extreme veterans earn a massive base and a lower silhouette
  const sumo = style !== 'bunjin' && ageYears >= 10 && activity >= 0.8;
  if (sumo) {
    baseRadius = 11 + activity * 4;
    trunkLen *= 0.82;
  }
  const rootFlare = clamp(Math.round(repoCount / 5) + 1, 1, 4);

  // streak milestones -> blossom clusters
  const milestones = [7, 30, 100, 365].filter((m) => metrics.maxStreak >= m).length;
  const flowers = milestones + (metrics.currentStreak >= 7 ? 1 : 0);

  // inactivity gaps -> deadwood
  const deadRatio = Math.min(
    0.35,
    metrics.gapsOver60d * 0.06 + (metrics.longestGapDays > 180 ? 0.1 : 0),
  );
  const shari = metrics.longestGapDays > 365;
  const uro = metrics.longestGapDays > 730;

  // language epochs (thirds of the account's life) -> leaf palettes + species
  const lang = (e: 0 | 1 | 2): string | undefined =>
    metrics.epochLanguages.find((x) => x.epoch === e)?.lang;
  const fallback = metrics.topLanguages[0]?.name ?? 'default';
  const e0 = lang(0) ?? fallback;
  const e1 = lang(1) ?? e0;
  const e2 = lang(2) ?? e1;
  const species = speciesFor(metrics.topLanguages[0]?.name ?? e2);
  const epochSplits: [number, number] = [
    clamp(0.33 + splitJitA, 0.2, 0.45),
    clamp(0.63 + splitJitB, 0.5, 0.78),
  ];

  const potWeeks = metrics.potWeeks.slice(0, 52);
  while (potWeeks.length < 52) potWeeks.unshift(0);

  return {
    seedKey: metrics.username.toLowerCase(),
    style,
    species,
    lean,
    iterations,
    trunkLen,
    baseRadius,
    branchChance,
    foliage,
    palettes: [e0, e1, e2],
    epochSplits,
    flowers,
    deadRatio,
    sumo,
    rootFlare,
    shari,
    uro,
    potWeeks,
    ageYears,
  };
}
