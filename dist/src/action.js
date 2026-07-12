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
const child_process_1 = require("child_process");
const index_1 = require("./index");
const data_1 = require("./data");
function input(name) {
    return (process.env['INPUT_' + name.replace(/ /g, '_').toUpperCase()] ?? '').trim();
}
function sh(cmd) {
    return (0, child_process_1.execSync)(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
}
async function run() {
    const token = input('github-token') || process.env.GITHUB_TOKEN;
    if (!token)
        throw new Error('github-token input (or GITHUB_TOKEN) is required');
    const user = input('user') || process.env.GITHUB_REPOSITORY_OWNER;
    if (!user)
        throw new Error('could not determine the user; set the "user" input');
    const outDir = input('output-dir') || 'output';
    const doCommit = (input('commit') || 'true') !== 'false';
    const message = input('commit-message') || 'chore: tend the bonsai 🌳';
    const season = (input('season') || 'auto');
    console.log(`growing bonsai for @${user} ...`);
    const metrics = await (0, data_1.fetchMetrics)(user, token);
    const out = (0, index_1.generate)(metrics, { season });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'bonsai.svg'), out.svg);
    fs.writeFileSync(path.join(outDir, 'bonsai.png'), out.png);
    fs.writeFileSync(path.join(outDir, 'bonsai.gif'), out.gif);
    fs.writeFileSync(path.join(outDir, 'bonsai-growth.gif'), out.growthGif);
    console.log(`rendered a ${out.dna.style} bonsai into ${outDir}/`);
    if (!doCommit)
        return;
    sh('git config user.name "git-bonsai[bot]"');
    sh('git config user.email "github-actions[bot]@users.noreply.github.com"');
    sh(`git add "${outDir}/bonsai.svg" "${outDir}/bonsai.png" "${outDir}/bonsai.gif" "${outDir}/bonsai-growth.gif"`);
    const staged = sh('git diff --cached --name-only');
    if (!staged) {
        console.log('bonsai unchanged — nothing to commit');
        return;
    }
    sh(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    for (let attempt = 0, delay = 2000;; attempt++, delay *= 2) {
        try {
            sh('git push');
            break;
        }
        catch (err) {
            if (attempt >= 3)
                throw err;
            console.log(`push failed, retrying in ${delay / 1000}s ...`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    console.log('bonsai committed and pushed');
}
run().catch((err) => {
    console.error(`::error::${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
});
