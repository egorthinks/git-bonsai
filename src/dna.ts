import { Metrics, BonsaiDNA, Style, Trunk, SizeClass } from './types';
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
  // per-trunk jitters for multi-trunk styles (drawn even when unused)
  const trunkScaleJit = Array.from({ length: 7 }, () => range(rng, -0.06, 0.06));
  const trunkLeanJit = Array.from({ length: 7 }, () => range(rng, -0.08, 0.08));
  const trunkDxJit = Array.from({ length: 7 }, () => range(rng, -4, 4));

  const ageYears = Math.max(
    0,
    (Date.parse(metrics.fetchedAt) - Date.parse(metrics.createdAt)) / (DAY_MS * 365.25),
  );
  const activity = sat(Math.log10(metrics.totalContributions + 1) / 4.5); // ~30k commits -> 1.0
  const cv = metrics.weeklyCv ?? 1.0;
  const burstiness = metrics.burstiness ?? 0.3;
  const repoCount = metrics.repoCount ?? 6;
  const topRepoShare = metrics.topRepoShare ?? 0.3;
  const flagshipCount = metrics.flagshipCount ?? 1;

  // account age -> trunk height, growth iterations, base thickness
  const iterations = clamp(3 + Math.floor(ageYears / 3), 3, 6);
  let trunkLen = 27 + Math.min(ageYears, 12) * 2.5 + trunkJit;
  let baseRadius = clamp(3.3 + Math.min(ageYears, 12) * 0.35 + activity * 2.1, 3.3, 8.7);

  // total contributions -> branch density & foliage
  let branchChance = clamp(0.26 + 0.3 * activity + branchJit, 0.2, 0.6);
  let foliage = sat(0.35 + 0.6 * activity + foliageJit);

  // style: structure of the account first (org, repo concentration), then
  // rhythm signals, then the weekend bands (see ROADMAP §1)
  let style: Style;
  if (metrics.isOrg) {
    style = 'yose-ue'; // an organization is a forest: every repo a tree
  } else if (topRepoShare >= 0.72 && repoCount >= 5 && ageYears >= 2) {
    style = 'sekijoju'; // one repo towers over everything: roots over the rock
  } else if (flagshipCount >= 3) {
    style = 'kabudachi'; // several equal flagships: a clump of trunks
  } else if (flagshipCount === 2) {
    style = 'sokan'; // two flagships: twin trunks, one dominant
  } else if (burstiness > 0.52) {
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
    sokan: [0.08, 0.18],
    kabudachi: [0.05, 0.14],
    'yose-ue': [0.03, 0.1],
    sekijoju: [0.14, 0.28],
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
  } else if (style === 'sokan' || style === 'kabudachi') {
    baseRadius *= style === 'sokan' ? 0.9 : 0.78;
    branchChance *= 0.85; // each trunk carries a lighter crown
  } else if (style === 'yose-ue') {
    trunkLen *= 0.78; // many small trees in one tray
    baseRadius *= 0.55;
  }

  // sumo class: extreme veterans earn a massive base and a lower silhouette —
  // single-trunk styles only (multi-trunk bases would fuse into one blob)
  const sumo =
    style !== 'bunjin' && style !== 'yose-ue' && style !== 'sokan' && style !== 'kabudachi' &&
    ageYears >= 10 && activity >= 0.8;
  if (sumo) {
    baseRadius = 11 + activity * 4;
    trunkLen *= 0.82;
  }

  // multi-trunk body plans: every trunk shares the base, one dominates
  const trunks: Trunk[] = [];
  if (style === 'sokan') {
    // father and son: the daughter trunk clearly separates and leans away
    trunks.push(
      { dx: -baseRadius * 1.2 + trunkDxJit[0] * 0.3, scale: 1, lean },
      { dx: baseRadius * 2.6 + trunkDxJit[1] * 0.3, scale: 0.56 + trunkScaleJit[1], lean: -lean * 2.2 + trunkLeanJit[1] },
    );
  } else if (style === 'kabudachi') {
    const n = Math.min(5, flagshipCount);
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const rank = Math.floor((i + 1) / 2); // 0, 1, 1, 2, 2 — outward from center
      trunks.push({
        dx: side * rank * baseRadius * 2.1 + trunkDxJit[i] * 0.5,
        scale: (i === 0 ? 1 : 0.82 - rank * 0.12) + trunkScaleJit[i],
        lean: (i === 0 ? lean : side * (0.12 + rank * 0.1)) + trunkLeanJit[i],
      });
    }
  } else if (style === 'yose-ue') {
    // a forest: 5-7 trees spread across the tray, the eldest in front
    const n = clamp(repoCount, 5, 7);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1);
      trunks.push({
        dx: (u - 0.5) * 150 + trunkDxJit[i],
        scale: (i === 0 ? 1 : 0.62 + ((i * 7) % 5) * 0.08) + trunkScaleJit[i],
        lean: trunkLeanJit[i] * 2.5 + lean * 0.4,
      });
    }
  } else {
    trunks.push({ dx: 0, scale: 1, lean });
  }
  const rock = style === 'sekijoju';
  const rootFlare = clamp(Math.round(repoCount / 5) + 1, 1, 4) + (rock ? 1 : 0);

  // size class: account "mass" earns a bigger pot (shohin -> chuhin -> dai)
  const mass = clamp(ageYears / 10, 0, 1) * 0.6 + activity * 0.4;
  const sizeClass: SizeClass = mass < 0.32 ? 'shohin' : mass < 0.62 ? 'chuhin' : 'dai';
  const potScale = sizeClass === 'shohin' ? 0.72 : sizeClass === 'chuhin' ? 0.86 : 1;

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
    trunks,
    rock,
    sizeClass,
    potScale,
    potWeeks,
    ageYears,
  };
}
