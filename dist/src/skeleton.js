"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROUND_Y = exports.H = exports.W = void 0;
exports.buildSkeleton = buildSkeleton;
const seed_1 = require("./seed");
const palette_1 = require("./palette");
const poisson_1 = require("./poisson");
exports.W = 256;
exports.H = 256;
exports.GROUND_Y = 200;
/**
 * Build the branch graph: a stochastic parametric L-system grows the trunk and
 * primary branches (shaped per bonsai style), then space colonization (Runions)
 * grows fine twigs at each foliage pad. Every segment carries a birth time for
 * the growth timelapse.
 */
function buildSkeleton(dna, rng) {
    const segs = [];
    const padSites = [];
    const st = dna.style;
    const windSign = Math.sign(dna.lean) || 1;
    const species = palette_1.SPECIES[dna.species];
    const baseX = exports.W / 2 - windSign *
        (st === 'cascade' ? 24 : st === 'han-kengai' ? 16 : st === 'yose-ue' ? 0 : 11);
    // sekijoju: the trunk starts on top of a rock; roots bridge down to the soil
    const rockH = dna.rock ? (0, seed_1.clamp)(12 + dna.baseRadius, 14, 24) : 0;
    const baseY = exports.GROUND_Y - rockH;
    // the first trunk's S-phase comes from the main stream (exactly as it always
    // did — existing trees must keep their shape); extra trunks get their own
    const auxRng = (0, seed_1.makeRng)(dna.seedKey + '|trunks');
    const sPhases = [rng() * Math.PI * 2, ...Array.from({ length: 6 }, () => auxRng() * Math.PI * 2)];
    let sPhase = sPhases[0];
    let curLean = dna.lean; // the currently growing trunk's own lean
    // bunjin keeps its sparse crown near the apex only
    const bunjinGateY = exports.GROUND_Y - dna.trunkLen * 1.45;
    let clock = 0;
    const shapedAngle = (dir, order, traveled, totalLen) => {
        // steer toward the style's target direction; -PI/2 is straight up
        let target = -Math.PI / 2 + curLean;
        let strength = order === 0 ? 0.14 : 0.2;
        let sAmp = 0.24;
        switch (st) {
            case 'formal':
                strength = order === 0 ? 0.3 : 0.22;
                sAmp = 0.08;
                break;
            case 'slanted':
            case 'sekijoju': // the rock-gripper leans like shakan, bracing on its roots
                if (order === 0)
                    target = -Math.PI / 2 + curLean * 1.6;
                break;
            case 'han-kengai':
            case 'cascade': {
                if (order <= 1) {
                    const t = (0, seed_1.clamp)(traveled / Math.max(1, totalLen), 0, 1);
                    const over = st === 'cascade' ? 0.9 : 0.35; // full dive vs sideways pour
                    target = t < 0.35
                        ? -Math.PI / 2 + curLean * 1.6
                        : windSign > 0 ? over : Math.PI - over;
                    strength = t < 0.35 ? 0.25 : 0.16;
                }
                break;
            }
            case 'bunjin':
                strength = order === 0 ? 0.09 : 0.2;
                sAmp = 0.38;
                break;
            case 'windswept': {
                // the trunk leans like shakan; branches stream downwind in layers —
                // mid branches at ~30 degrees, twig-bearing ends nearly horizontal
                const stream = order <= 1 ? 0.55 : 0.18;
                target = order === 0
                    ? -Math.PI / 2 + curLean * 1.3
                    : windSign > 0 ? -stream : Math.PI + stream;
                // primaries keep their wide exit angle; only the ends chase the wind
                strength = order === 0 ? 0.2 : order === 1 ? 0.1 : 0.3;
                sAmp = 0.12;
                break;
            }
            case 'broom':
                target = -Math.PI / 2;
                strength = order === 0 ? 0.5 : 0.28;
                sAmp = order === 0 ? 0 : 0.12;
                break;
            case 'yose-ue':
                // forest trees stay small and upright — gentle, readable trunks
                strength = order === 0 ? 0.32 : 0.22;
                sAmp = 0.1;
                break;
        }
        let out = dir + angleDiff(target, dir) * strength;
        // trunk movement: an S-curve fading with branching order
        const sFade = order === 0 ? 1 : order === 1 ? 0.6 : 0.3;
        out += Math.sin(traveled * 0.11 + sPhase) * sAmp * sFade;
        return out;
    };
    const grow = (x, y, dir, len, order, parent, traveled) => {
        if (len < 8.5 || order > dna.iterations) {
            if (order >= 2)
                padSites.push({ x, y, segIdx: parent, order });
            return;
        }
        const steps = (0, seed_1.clamp)(Math.round(len / 7), 2, 6);
        const stepLen = len / steps;
        let px = x;
        let py = y;
        let pdir = dir;
        let last = parent;
        // branches alternate sides; windswept ones all curve downwind via their target
        let sideSign = rng() < 0.5 ? -1 : 1;
        for (let s = 0; s < steps; s++) {
            pdir = shapedAngle(pdir, order, traveled, dna.trunkLen * 2.2);
            pdir += (0, seed_1.range)(rng, -0.22, 0.22) * (order === 0 ? 1.2 : 1);
            // keep the tree inside the canvas
            const margin = 19;
            if (px < margin && Math.cos(pdir) < 0)
                pdir = mixAngle(pdir, 0, 0.5);
            if (px > exports.W - margin && Math.cos(pdir) > 0)
                pdir = mixAngle(pdir, Math.PI, 0.5);
            if (py < 24 && Math.sin(pdir) < 0)
                pdir = mixAngle(pdir, 0.2 * sideSign, 0.4);
            if (py > exports.H - 10 && Math.sin(pdir) > 0)
                pdir = mixAngle(pdir, -Math.PI / 2, 0.5);
            // semi-cascade pours sideways but never below the pot's base
            if (st === 'han-kengai' && py > exports.GROUND_Y + 14 && Math.sin(pdir) > 0) {
                pdir = mixAngle(pdir, windSign > 0 ? -0.2 : Math.PI + 0.2, 0.5);
            }
            const sl = stepLen * (0, seed_1.range)(rng, 0.85, 1.15);
            const nx = px + Math.cos(pdir) * sl;
            const ny = py + Math.sin(pdir) * sl;
            segs.push({
                ax: px, ay: py, bx: nx, by: ny,
                parent: last, order, birth: clock++,
                twig: false, dead: false, epoch: 0, radius: 1,
            });
            last = segs.length - 1;
            traveled += sl;
            // side branches bend toward the horizontal (with a species-specific droop)
            const mayBranch = order < dna.iterations && s >= 1 &&
                (st !== 'broom' || order > 0) && // broom fans at the top instead
                (st !== 'bunjin' || ny < bunjinGateY); // literati: bare trunk below the crown
            if (mayBranch && rng() < dna.branchChance) {
                const spread = (0, seed_1.range)(rng, 0.7, 1.2) * sideSign;
                sideSign = -sideSign;
                let side = pdir + spread;
                const droopAmt = 0.12 + species.droop;
                const droop = st === 'windswept'
                    ? (windSign > 0 ? droopAmt : Math.PI - droopAmt)
                    : (Math.cos(side) >= 0 ? droopAmt : Math.PI - droopAmt);
                const droopMix = st === 'broom' ? 0.05 : st === 'windswept' ? 0.6 : order === 0 ? 0.5 : 0.3;
                side = mixAngle(side, droop, droopMix);
                // windswept branches run a touch longer with the wind
                const lenLo = st === 'windswept' ? 0.58 : 0.55;
                const lenHi = st === 'windswept' ? 0.75 : 0.72;
                grow(nx, ny, side, len * (0, seed_1.range)(rng, lenLo, lenHi), order + 1, last, 0);
            }
            px = nx;
            py = ny;
        }
        if (st === 'broom' && order === 0) {
            // hokidachi: the trunk splits into an even upward fan
            const fan = 5;
            for (let i = 0; i < fan; i++) {
                const a = -Math.PI / 2 + (i - (fan - 1) / 2) * 0.42 + (0, seed_1.range)(rng, -0.08, 0.08);
                grow(px, py, a, len * (0, seed_1.range)(rng, 0.52, 0.64), order + 1, last, 0);
            }
            return;
        }
        // apical continuation
        grow(px, py, pdir + (0, seed_1.range)(rng, -0.15, 0.15), len * (0, seed_1.range)(rng, 0.66, 0.74), order + 1, last, traveled);
    };
    // grow every trunk from the shared base (multi-trunk styles have several);
    // sequential growth keeps the timelapse story: the dominant trunk comes first
    const bases = [];
    dna.trunks.forEach((trunk, i) => {
        sPhase = sPhases[Math.min(i, sPhases.length - 1)];
        curLean = trunk.lean;
        const tx = baseX + trunk.dx;
        bases.push({ x: tx, y: baseY, r: dna.baseRadius * trunk.scale });
        grow(tx, baseY, -Math.PI / 2 + trunk.lean * 0.5, dna.trunkLen * trunk.scale, 0, -1, 0);
    });
    // normalize births of the woody skeleton to 0..0.75 (twigs+foliage take the rest)
    const maxClock = Math.max(1, clock - 1);
    for (const s of segs)
        s.birth = (s.birth / maxClock) * 0.75;
    // mark epochs by birth order: older wood is the earlier-grown part of the tree
    for (const s of segs) {
        const bt = s.birth / 0.75;
        s.epoch = bt <= dna.epochSplits[0] ? 0 : bt <= dna.epochSplits[1] ? 1 : 2;
    }
    // cap foliage pads: dense trees would otherwise explode twig counts
    // (multi-trunk trees get a modest bonus so every trunk keeps a crown)
    const maxPads = Math.round((45 + dna.foliage * 35) * (1 + 0.2 * (dna.trunks.length - 1)));
    let sites = padSites;
    if (sites.length > maxPads) {
        const step = sites.length / maxPads;
        sites = Array.from({ length: maxPads }, (_, i) => padSites[Math.floor(i * step)]);
    }
    // inactivity gaps turn some pads into deadwood (jin)
    const deadCount = Math.round(sites.length * dna.deadRatio);
    const deadSet = new Set();
    while (deadSet.size < deadCount && deadSet.size < sites.length) {
        deadSet.add(Math.floor(rng() * sites.length));
    }
    const pads = [];
    sites.forEach((site, i) => {
        const parentSeg = segs[site.segIdx];
        const birth = parentSeg ? parentSeg.birth + 0.05 : 0.5;
        const dead = deadSet.has(i);
        const epoch = parentSeg ? parentSeg.epoch : 2;
        const padScale = dna.style === 'bunjin' ? 0.8 : dna.style === 'yose-ue' ? 0.74 : 1;
        const padR = (7 + dna.foliage * 8.5) * (0, seed_1.range)(rng, 0.8, 1.2) * padScale;
        const tips = growTwigs(segs, site, dead, birth, padR, dna, rng);
        pads.push({ x: site.x, y: site.y, r: padR, birth: Math.min(birth, 0.95), dead, epoch, tips });
    });
    return { segs, pads, baseX, groundY: exports.GROUND_Y, bases, rockH };
}
/**
 * Space colonization (Runions): Poisson-disk attractors fill the pad's crown
 * ellipse, twig nodes grow toward them from the branch tip.
 */
function growTwigs(segs, site, dead, birth, padR, dna, rng) {
    const rx = padR * 1.15;
    const ry = padR * 0.62;
    const raw = (0, poisson_1.poissonDisk)(rng, rx * 2, ry * 2, dead ? 5.5 : 3.4);
    const attractors = raw
        .map((p) => ({ x: site.x + p.x - rx, y: site.y - ry * 0.5 + p.y - ry }))
        .filter((p) => {
        const ex = (p.x - site.x) / rx;
        const ey = (p.y - (site.y - ry * 0.5)) / ry;
        return ex * ex + ey * ey <= 1 && p.x >= 2 && p.x < exports.W - 2 && p.y >= 2;
    });
    const nodes = [{ x: site.x, y: site.y, seg: site.segIdx }];
    const alive = attractors.map(() => true);
    const INFLUENCE = 16;
    const KILL = 2.6;
    const STEP = 2.3;
    const maxIter = dead ? 4 : 10;
    const tips = [];
    let tBirth = birth;
    for (let iter = 0; iter < maxIter; iter++) {
        const pull = new Map();
        for (let a = 0; a < attractors.length; a++) {
            if (!alive[a])
                continue;
            let best = -1;
            let bestD = INFLUENCE * INFLUENCE;
            for (let n = 0; n < nodes.length; n++) {
                const dx = attractors[a].x - nodes[n].x;
                const dy = attractors[a].y - nodes[n].y;
                const d = dx * dx + dy * dy;
                if (d < bestD) {
                    bestD = d;
                    best = n;
                }
            }
            if (best < 0)
                continue;
            const dx = attractors[a].x - nodes[best].x;
            const dy = attractors[a].y - nodes[best].y;
            const len = Math.hypot(dx, dy) || 1;
            const acc = pull.get(best) ?? { dx: 0, dy: 0, n: 0 };
            acc.dx += dx / len;
            acc.dy += dy / len;
            acc.n++;
            pull.set(best, acc);
        }
        if (pull.size === 0)
            break;
        const grown = [];
        for (const [ni, acc] of [...pull.entries()].sort((a, b) => a[0] - b[0])) {
            const len = Math.hypot(acc.dx, acc.dy) || 1;
            const nx = nodes[ni].x + (acc.dx / len) * STEP;
            const ny = nodes[ni].y + (acc.dy / len) * STEP;
            tBirth = Math.min(0.97, tBirth + 0.004);
            segs.push({
                ax: nodes[ni].x, ay: nodes[ni].y, bx: nx, by: ny,
                parent: nodes[ni].seg, order: site.order + 1, birth: tBirth,
                twig: true, dead, epoch: segs[site.segIdx]?.epoch ?? 2, radius: 0.55,
            });
            nodes.push({ x: nx, y: ny, seg: segs.length - 1 });
            grown.push(nodes.length - 1);
        }
        for (let a = 0; a < attractors.length; a++) {
            if (!alive[a])
                continue;
            for (const gi of grown) {
                const dx = attractors[a].x - nodes[gi].x;
                const dy = attractors[a].y - nodes[gi].y;
                if (dx * dx + dy * dy < KILL * KILL) {
                    alive[a] = false;
                    break;
                }
            }
        }
    }
    for (let n = 1; n < nodes.length; n++) {
        tips.push({ x: nodes[n].x, y: nodes[n].y, birth: segs[nodes[n].seg].birth });
    }
    if (tips.length === 0)
        tips.push({ x: site.x, y: site.y - 2, birth });
    return tips;
}
function angleDiff(target, from) {
    let d = target - from;
    while (d > Math.PI)
        d -= Math.PI * 2;
    while (d < -Math.PI)
        d += Math.PI * 2;
    return d;
}
function mixAngle(from, target, t) {
    return from + angleDiff(target, from) * t;
}
