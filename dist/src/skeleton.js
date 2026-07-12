"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROUND_Y = exports.H = exports.W = void 0;
exports.buildSkeleton = buildSkeleton;
const seed_1 = require("./seed");
const poisson_1 = require("./poisson");
exports.W = 256;
exports.H = 256;
exports.GROUND_Y = 200;
/**
 * Build the branch graph: a stochastic parametric L-system grows the trunk and
 * primary branches, then space colonization (Runions) grows fine twigs at each
 * foliage pad. Every segment carries a birth time for the growth timelapse.
 */
function buildSkeleton(dna, rng) {
    const segs = [];
    const padSites = [];
    const baseX = exports.W / 2 - Math.sign(dna.lean) * (dna.style === 'cascade' ? 24 : 11);
    const sPhase = rng() * Math.PI * 2; // phase of the trunk's S-curve
    let clock = 0;
    const shapedAngle = (dir, order, traveled, totalLen) => {
        // steer toward the style's target direction; angles: -PI/2 is straight up
        let target = -Math.PI / 2 + dna.lean;
        let strength = order === 0 ? 0.14 : 0.2;
        if (dna.style === 'cascade' && order <= 1) {
            const t = (0, seed_1.clamp)(traveled / Math.max(1, totalLen), 0, 1);
            // rise first, then pour over the pot rim and dive
            target = t < 0.35 ? -Math.PI / 2 + dna.lean * 1.6 : Math.sign(dna.lean) > 0 ? 0.9 : Math.PI - 0.9;
            strength = t < 0.35 ? 0.25 : 0.16;
        }
        else if (dna.style === 'slanted' && order === 0) {
            target = -Math.PI / 2 + dna.lean * 1.6;
        }
        let out = dir + angleDiff(target, dir) * strength;
        // trunk movement: an S-curve along the traveled distance
        if (order === 0)
            out += Math.sin(traveled * 0.11 + sPhase) * 0.24;
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
        let sideSign = rng() < 0.5 ? -1 : 1;
        for (let s = 0; s < steps; s++) {
            pdir = shapedAngle(pdir, order, traveled, dna.trunkLen * 2.2);
            pdir += (0, seed_1.range)(rng, -0.22, 0.22) * (order === 0 ? 1.2 : 1); // trunk gets S-curves
            // keep the tree inside the canvas
            const margin = 19;
            if (px < margin)
                pdir += (Math.abs(angleDiff(0, pdir)) < 1.8 ? 0 : 0.3);
            if (px < margin && Math.cos(pdir) < 0)
                pdir = mixAngle(pdir, 0, 0.5);
            if (px > exports.W - margin && Math.cos(pdir) > 0)
                pdir = mixAngle(pdir, Math.PI, 0.5);
            if (py < 24 && Math.sin(pdir) < 0)
                pdir = mixAngle(pdir, 0.2 * sideSign, 0.4);
            if (py > exports.H - 10 && Math.sin(pdir) > 0)
                pdir = mixAngle(pdir, -Math.PI / 2, 0.5);
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
            // side branches bend toward the horizontal (with a slight aged droop)
            if (order < dna.iterations && s >= 1 && rng() < dna.branchChance) {
                const spread = (0, seed_1.range)(rng, 0.7, 1.2) * sideSign;
                sideSign = -sideSign;
                let side = pdir + spread;
                const droop = Math.cos(side) >= 0 ? 0.12 : Math.PI - 0.12;
                side = mixAngle(side, droop, order === 0 ? 0.5 : 0.3);
                grow(nx, ny, side, len * (0, seed_1.range)(rng, 0.55, 0.72), order + 1, last, 0);
            }
            px = nx;
            py = ny;
        }
        // apical continuation
        grow(px, py, pdir + (0, seed_1.range)(rng, -0.15, 0.15), len * (0, seed_1.range)(rng, 0.66, 0.74), order + 1, last, traveled);
    };
    grow(baseX, exports.GROUND_Y, -Math.PI / 2 + dna.lean * 0.5, dna.trunkLen, 0, -1, 0);
    // normalize births of the woody skeleton to 0..0.75 (twigs+foliage take the rest)
    const maxClock = Math.max(1, clock - 1);
    for (const s of segs)
        s.birth = (s.birth / maxClock) * 0.75;
    // mark epochs by birth order: older wood is the lower/earlier part of the tree
    for (const s of segs)
        s.epoch = s.birth / 0.75 <= dna.epochSplit ? 0 : 1;
    // cap foliage pads: dense trees would otherwise explode twig counts
    const maxPads = 45 + Math.round(dna.foliage * 35);
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
        const epoch = parentSeg ? parentSeg.epoch : 1;
        const padR = (8 + dna.foliage * 10.5) * (0, seed_1.range)(rng, 0.8, 1.2);
        const tips = growTwigs(segs, site, dead, birth, padR, dna, rng);
        pads.push({ x: site.x, y: site.y, r: padR, birth: Math.min(birth, 0.95), dead, epoch, tips });
    });
    return { segs, pads, baseX, groundY: exports.GROUND_Y };
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
                twig: true, dead, epoch: segs[site.segIdx]?.epoch ?? 1, radius: 0.55,
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
