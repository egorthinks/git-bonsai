# 🌳 git-bonsai

**Grow a one-of-a-kind pixel-art bonsai from your GitHub history.**

<p align="center">
  <img src="assets/bonsai-growth.gif" width="384" alt="A procedurally generated pixel-art bonsai growing from a seed" />
</p>

Every account grows exactly one tree — deterministic, procedural, 16-bit style.
The older your account and the richer your history, the bigger and denser your bonsai.
It keeps growing as you keep committing.

| your GitHub | your tree |
|---|---|
| account age | trunk height, growth rings, base thickness |
| total contributions | branch density, foliage richness |
| top language per era | leaf palette & leaf shape per tree section |
| streak milestones (7/30/100/365) | sakura blossoms |
| long inactivity gaps | deadwood branches (jin) |
| commit-time habits | style: formal upright / slanted / cascade |
| current year of contributions | the soil mosaic in the pot |

Ten years of TypeScript over Python, with two long breaks, looks like this — while a one-year-old account is still a sprout:

<p align="center">
  <img src="assets/bonsai.gif" width="320" alt="Veteran bonsai swaying in the wind" />
  <img src="assets/bonsai-young.png" width="320" alt="A young, small bonsai" />
</p>

## Install (3 lines of YAML)

Add `.github/workflows/bonsai.yml` to your profile repo (the one named after your username):

```yaml
name: bonsai
on:
  schedule:
    - cron: '0 3 * * *'   # re-grow daily
  workflow_dispatch:
permissions:
  contents: write
jobs:
  grow:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: egorthinks/git-bonsai@main
```

Then embed the tree in your `README.md`:

```html
<img src="output/bonsai-growth.gif" width="384" alt="my git-bonsai" />
```

The action writes and commits four files: `bonsai.svg` (static), `bonsai.png`,
`bonsai.gif` (wind loop) and `bonsai-growth.gif` (seed-to-tree timelapse).

### Action inputs

| input | default | |
|---|---|---|
| `github-token` | `${{ github.token }}` | token for the GraphQL API & pushing |
| `user` | repo owner | account to grow the bonsai for |
| `output-dir` | `output` | where to write the images |
| `commit` | `true` | commit & push the result |
| `commit-message` | `chore: tend the bonsai 🌳` | |

## Local preview (no push, no token needed)

```bash
npx git-bonsai --user yourname --token $GITHUB_TOKEN   # real data
npx git-bonsai --synth yourname                        # offline demo
```

## How it works

100% procedural, zero pre-drawn trees, zero runtime dependencies. Data flows
through pure functions, one module per stage:

```
data      GitHub GraphQL → normalized metrics
seed      username → FNV-1a → sfc32 PRNG
dna       metrics + PRNG → tree genotype
skeleton  stochastic L-system (trunk & branches) + space colonization (twigs)
thickness pipe model / Murray's law
raster    Bresenham + scanline capsule fill → 192×192 indexed buffer
shade     8SSEDT SDF volume → posterized light → Bayer dithering → keyline
foliage   Poisson-disk (Bridson) leaves, simplex silhouette, blossoms
animate   wind (sine + simplex, seamless loop) & growth timelapse
encode    hand-rolled GIF89a (LZW) + PNG + SVG snapshot
```

**Determinism is a hard guarantee:** the same username with the same metrics
produces bit-identical bytes on every run. No `Math.random()` anywhere —
only the seeded PRNG. Real pixel art too: everything is rendered onto a small
integer buffer with a fixed 32-color palette, then upscaled nearest-neighbor.

## Develop

```bash
npm install
npm test          # determinism + acceptance criteria
npm run demo      # render fixtures/veteran.json into out/
```

`dist/` is committed intentionally — the GitHub Action runs straight from it
without an install step.

## License

MIT
