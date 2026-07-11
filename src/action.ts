import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { generate } from './index';
import { fetchMetrics } from './data';

function input(name: string): string {
  return (process.env['INPUT_' + name.replace(/ /g, '_').toUpperCase()] ?? '').trim();
}

function sh(cmd: string): string {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
}

async function run(): Promise<void> {
  const token = input('github-token') || process.env.GITHUB_TOKEN;
  if (!token) throw new Error('github-token input (or GITHUB_TOKEN) is required');
  const user = input('user') || process.env.GITHUB_REPOSITORY_OWNER;
  if (!user) throw new Error('could not determine the user; set the "user" input');
  const outDir = input('output-dir') || 'output';
  const doCommit = (input('commit') || 'true') !== 'false';
  const message = input('commit-message') || 'chore: tend the bonsai 🌳';

  console.log(`growing bonsai for @${user} ...`);
  const metrics = await fetchMetrics(user, token);
  const out = generate(metrics);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'bonsai.svg'), out.svg);
  fs.writeFileSync(path.join(outDir, 'bonsai.png'), out.png);
  fs.writeFileSync(path.join(outDir, 'bonsai.gif'), out.gif);
  fs.writeFileSync(path.join(outDir, 'bonsai-growth.gif'), out.growthGif);
  console.log(`rendered a ${out.dna.style} bonsai into ${outDir}/`);

  if (!doCommit) return;

  sh('git config user.name "git-bonsai[bot]"');
  sh('git config user.email "github-actions[bot]@users.noreply.github.com"');
  sh(`git add "${outDir}/bonsai.svg" "${outDir}/bonsai.png" "${outDir}/bonsai.gif" "${outDir}/bonsai-growth.gif"`);
  const staged = sh('git diff --cached --name-only');
  if (!staged) {
    console.log('bonsai unchanged — nothing to commit');
    return;
  }
  sh(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  for (let attempt = 0, delay = 2000; ; attempt++, delay *= 2) {
    try {
      sh('git push');
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
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
