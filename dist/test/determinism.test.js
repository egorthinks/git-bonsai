"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert"));
const path = __importStar(require("path"));
const index_1 = require("../src/index");
const data_1 = require("../src/data");
const FIXTURES = path.join(__dirname, '..', '..', 'fixtures');
const veteran = () => (0, data_1.loadFixture)(path.join(FIXTURES, 'veteran.json'));
const young = () => (0, data_1.loadFixture)(path.join(FIXTURES, 'young.json'));
(0, node_test_1.test)('same input produces bit-identical output', () => {
    const a = (0, index_1.generate)(veteran());
    const b = (0, index_1.generate)(veteran());
    assert.strictEqual(a.svg, b.svg);
    assert.ok(a.png.equals(b.png), 'png differs between runs');
    assert.ok(a.gif.equals(b.gif), 'wind gif differs between runs');
    assert.ok(a.growthGif.equals(b.growthGif), 'growth gif differs between runs');
});
(0, node_test_1.test)('different usernames produce visibly different trees', () => {
    const a = (0, index_1.generate)((0, data_1.synthMetrics)('alice'));
    const b = (0, index_1.generate)((0, data_1.synthMetrics)('bob'));
    assert.ok(!a.png.equals(b.png), 'different users grew identical trees');
    assert.ok(!a.gif.equals(b.gif));
});
(0, node_test_1.test)('older & more active accounts grow bigger, denser trees', () => {
    const old = (0, index_1.generate)(veteran());
    const fresh = (0, index_1.generate)(young());
    // compressed PNG size is a rough but monotonic proxy for visual mass/complexity
    const mass = (png) => png.length;
    assert.ok(old.dna.iterations > fresh.dna.iterations, 'veteran should have more growth iterations');
    assert.ok(old.dna.trunkLen > fresh.dna.trunkLen, 'veteran should have a taller trunk');
    assert.ok(old.dna.baseRadius > fresh.dna.baseRadius, 'veteran should have a thicker base');
    assert.ok(mass(old.png) > mass(fresh.png) * 1.05, 'veteran tree should be visually denser');
});
(0, node_test_1.test)('streak milestones bloom and gaps leave deadwood', () => {
    const dna = (0, index_1.generate)(veteran()).dna;
    assert.ok(dna.flowers >= 4, `expected blossoms for a 142-day max streak, got ${dna.flowers}`);
    assert.ok(dna.deadRatio > 0, 'expected deadwood for 60d+ gaps');
    const freshDna = (0, index_1.generate)(young()).dna;
    assert.strictEqual(freshDna.deadRatio, 0);
});
(0, node_test_1.test)('outputs fit README budgets', () => {
    const out = (0, index_1.generate)(veteran());
    assert.ok(out.gif.length < 2 * 1024 * 1024, `wind gif too big: ${out.gif.length}`);
    assert.ok(out.growthGif.length < 3 * 1024 * 1024, `growth gif too big: ${out.growthGif.length}`);
    assert.ok(out.svg.length < 1024 * 1024, `svg too big: ${out.svg.length}`);
    assert.ok(out.gif.subarray(0, 6).toString('ascii') === 'GIF89a');
    assert.ok(out.png.subarray(1, 4).toString('ascii') === 'PNG');
});
(0, node_test_1.test)('repo concentration earns the multi-trunk styles', () => {
    const style = (name) => (0, index_1.generate)((0, data_1.loadFixture)(path.join(FIXTURES, name + '.json'))).dna;
    assert.strictEqual(style('twin-keeper').style, 'sokan');
    assert.strictEqual(style('twin-keeper').trunks.length, 2);
    assert.strictEqual(style('clump-forge').style, 'kabudachi');
    assert.ok(style('clump-forge').trunks.length >= 3);
    assert.strictEqual(style('monolith-mike').style, 'sekijoju');
    assert.ok(style('monolith-mike').rock);
    assert.strictEqual(style('acme-org').style, 'yose-ue');
    assert.ok(style('acme-org').trunks.length >= 5);
    // size classes: a young account sits in a small pot
    assert.strictEqual(style('tiny-sprout').sizeClass, 'shohin');
    assert.strictEqual((0, index_1.generate)(veteran()).dna.sizeClass, 'dai');
});
(0, node_test_1.test)('seasons shift the leaves deterministically, keeping hue identity', () => {
    const summerA = (0, index_1.generate)(veteran(), { season: 'summer' });
    const summerB = (0, index_1.generate)(veteran(), { season: 'summer' });
    assert.ok(summerA.png.equals(summerB.png), 'same season must be bit-identical');
    for (const season of ['spring', 'autumn', 'winter']) {
        const other = (0, index_1.generate)(veteran(), { season });
        assert.ok(!other.png.equals(summerA.png), `${season} should differ from summer`);
    }
    // identity: the TypeScript-blue top ramp keeps blue dominant in autumn
    const { seasonize } = require('../src/palette');
    const [r, g, b] = seasonize([92, 180, 221], 'autumn');
    assert.ok(b > r, 'autumn must not turn a blue crown warm-brown');
});
(0, node_test_1.test)('runs fast enough for a CI budget', () => {
    const started = Date.now();
    (0, index_1.generate)(veteran());
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 30_000, `generation took ${elapsed} ms`);
});
