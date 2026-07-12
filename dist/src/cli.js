#!/usr/bin/env node
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_1 = require("./index");
const data_1 = require("./data");
const HELP = `git-bonsai — grow a deterministic pixel-art bonsai from a GitHub profile

Usage:
  git-bonsai --user <login> [--token <t>] [--out <dir>] [--scale <n>]
  git-bonsai --fixture <metrics.json> [--out <dir>]
  git-bonsai --synth <name> [--out <dir>]        offline demo (fake metrics)

Options:
  --user     GitHub login to fetch (needs --token or GITHUB_TOKEN env)
  --fixture  Path to a normalized metrics JSON (offline, reproducible)
  --synth    Fabricate deterministic demo metrics from a name (offline)
  --out      Output directory (default: output)
  --scale    Integer upscale factor for SVG/PNG (default: 3)

Outputs: bonsai.svg, bonsai.png, bonsai.gif (wind), bonsai-growth.gif (timelapse)
`;
function arg(name) {
    const i = process.argv.indexOf('--' + name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}
async function main() {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        process.stdout.write(HELP);
        return;
    }
    const user = arg('user');
    const fixture = arg('fixture');
    const synth = arg('synth');
    const outDir = arg('out') ?? 'output';
    const scale = Number(arg('scale') ?? 3);
    let metrics;
    if (fixture) {
        metrics = (0, data_1.loadFixture)(fixture);
    }
    else if (synth) {
        metrics = (0, data_1.synthMetrics)(synth);
    }
    else if (user) {
        const token = arg('token') ?? process.env.GITHUB_TOKEN;
        if (!token) {
            process.stderr.write('error: --token or GITHUB_TOKEN is required with --user\n');
            process.exit(1);
        }
        metrics = await (0, data_1.fetchMetrics)(user, token);
    }
    else {
        process.stderr.write(HELP);
        process.exit(1);
    }
    const started = Date.now();
    const out = (0, index_1.generate)(metrics, { scale });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'bonsai.svg'), out.svg);
    fs.writeFileSync(path.join(outDir, 'bonsai.png'), out.png);
    fs.writeFileSync(path.join(outDir, 'bonsai.gif'), out.gif);
    fs.writeFileSync(path.join(outDir, 'bonsai-growth.gif'), out.growthGif);
    const kb = (b) => `${(Buffer.byteLength(b) / 1024).toFixed(1)} KB`;
    process.stdout.write(`grew a ${out.dna.style} bonsai for ${metrics.username} in ${Date.now() - started} ms\n` +
        `  ${outDir}/bonsai.svg         ${kb(out.svg)}\n` +
        `  ${outDir}/bonsai.png         ${kb(out.png)}\n` +
        `  ${outDir}/bonsai.gif         ${kb(out.gif)}\n` +
        `  ${outDir}/bonsai-growth.gif  ${kb(out.growthGif)}\n`);
}
main().catch((err) => {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});
