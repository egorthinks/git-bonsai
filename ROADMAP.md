# git-bonsai — roadmap: toward a real bonsai taxonomy

The MVP ships three trunk styles, one crown type and one leaf shape per
language. Traditional bonsai offers a far richer vocabulary — and almost all
of it maps naturally onto signals we already have. This document is the design
sketch for the next generation of growth rules. Guiding principles stay the
same: 100% procedural, deterministic, every visual trait must be *earned* by a
real metric (nothing cosmetic-random), and the whole thing must stay readable
at 256×256.

## 1. Styles (trunk forms)

The classical styles describe the trunk's line. Current: chokkan (formal
upright), shakan (slanting), kengai (cascade), picked by weekend ratio alone.
Proposed full set and the signal that earns each:

| style | form | earned by |
|---|---|---|
| **Chokkan** — formal upright | straight tapered trunk, symmetric pads | very regular rhythm: low variance of weekly activity, low weekend share |
| **Moyogi** — informal upright | gentle S-curve, apex over base | the default for balanced profiles (most trees; already close to what we draw) |
| **Shakan** — slanting | whole trunk leans 60–80°, roots visibly bracing | moderate weekend/evening share |
| **Kengai** — cascade | trunk dives below the pot rim | night-owl / weekend-heavy profiles |
| **Han-kengai** — semi-cascade | pours sideways but not below pot base | between shakan and kengai |
| **Bunjingi** — literati | tall, bare, calligraphic trunk; sparse crown at the top only | old account + few but long-lived repos: the minimalist scholar |
| **Fukinagashi** — windswept | trunk *and* all branches streaming to one side | bursty history: long quiet spells broken by intense storms of commits (high burstiness index) |
| **Hokidachi** — broom | straight trunk splitting into a fine, even dome | metronome consistency: contributions almost every day, tiny variance, high streaks |
| **Sokan** — twin trunk | two trunks from one root, one dominant | strong co-authorship signal: a significant share of co-authored commits / pair work |
| **Kabudachi** — clump | 3–5 trunks from one base | one person, several long-lived flagship repos of similar weight |
| **Yose-ue** — forest | many small trees in one tray | organization accounts: each top repo becomes a tree, sized by its activity |
| **Sekijoju** — root over rock | roots gripping a stone | a single dominant repo that towers over everything else (the "one big rock" in the history) |

Implementation note: style selection becomes a scoring function over
(variance, burstiness, weekend share, co-author share, repo concentration,
age) with deterministic tie-breaks from the seed — so a profile can sit near a
boundary and still always get the same style.

## 2. Trunk mass (nebari & sumo trunks)

Real bonsai prize a massive, flaring base — *nebari* (visible root spread) and
"sumo" proportions (trunk width up to 1/3 of tree height). Currently base
radius caps at ~9 px. Proposed:

- **Sumo class** for extreme veterans: when age × activity crosses a
  threshold, unlock trunk base up to 20–24 px with visible root flare
  (2–4 root buttresses drawn as short capsules at the soil line) and a lower,
  wider silhouette. A 15-year daily committer should look *heavy*.
- **Nebari from repo breadth:** the number of distinct long-lived repos
  spreads the visible roots — a monorepo person gets one deep taproot, a
  many-projects person gets wide radial flare.
- Murray's law stays; only the base boundary condition and the height/width
  ratio change per class.

## 3. Species (crown + leaf + bark as one package)

Languages currently pick only a leaf palette. Real trees differ in *structure*.
Proposal: language **families** map to species archetypes, which bundle crown
shape, leaf stamp, branch habit and bark texture:

| species archetype | crown | leaf stamp | earned by |
|---|---|---|---|
| **Pine** (matsu) | flat layered pads with negative space, downswept branches | needle pairs (2×1 diagonal) | systems languages: C, C++, Rust, Zig, Go |
| **Maple** (momiji) | rounded overlapping clouds | 5-px star | app/scripting: Python, Ruby, PHP, Lua |
| **Cherry** (sakura) | billowing soft masses, blossoms amplified | round 2×2 | frontend: JS, TS, CSS, Astro, Vue |
| **Juniper** (shimpaku) | ragged, asymmetric foliage jets | single px scatter | data/infra: SQL, Terraform, Shell, Dockerfile |
| **Elm/Zelkova** | fine twiggy broom dome | 1×2 vertical | JVM/.NET: Java, Kotlin, C#, Scala |

Species is chosen by the *dominant family across the whole history*; the
per-era palette split stays within the species (e.g. a pine whose old needles
are C-blue and new needles Rust-orange). Bark: pines get rougher vertical
noise, maples smoother banding — one extra noise parameter per species.

## 4. Crown detail

- **Pad separation** at high density: the metaball threshold gets a gentle
  per-pad lift so even 100k-contribution crowns keep visible layers instead of
  fusing into one blob (the "founder tree" problem).
- **Three eras** instead of two: palette slots 28–31 are free; thirds of the
  account's life → three canopy bands. A Python → Go → Rust career reads
  bottom-to-top.
- **Season of the day** (optional, still deterministic per run-date): subtle
  ramp shift by month — fresh green spring, deep summer, amber autumn.
  Regenerated daily by the Action, the tree would breathe with the calendar.

## 5. Deadwood as craft (jin, shari, uro)

Gaps currently gray out whole pads. Bonsai deadwood is more expressive:

- **Jin** (bare bleached branch tip) — short gaps (60–120 d): keep as is.
- **Shari** (a strip of bare trunk) — one gap > 1 year: a pale streak down the
  trunk side, drawn as a lighter band in the trunk shading.
- **Uro** (hollow) — account resurrection (gap > 2 years then return): a small
  dark hollow with outline on the trunk. A badge of honor, not shame.

## 6. Size classes

Bonsai are classed by size (shohin < chuhin < dai). Map overall account
"mass" to canvas occupancy so a 1-year account is an honest *shohin* in a
small pot (smaller pot sprite, not just a smaller tree) and a 15-year daily
committer fills a *dai* tray. Pot size itself becomes a growth reward.

## Sequencing

1. Pad separation + three eras (small, pure-render wins)
2. Species archetypes (crown/leaf/bark bundles)
3. New styles: bunjingi, fukinagashi, hokidachi (single-trunk, cheap)
4. Sumo trunks + nebari
5. Multi-trunk styles (sokan, kabudachi, yose-ue for orgs)
6. Shari/uro deadwood, size classes, seasons

Every step keeps the acceptance criteria: bit-identical determinism, visible
age/activity scaling, and README-budget file sizes.
