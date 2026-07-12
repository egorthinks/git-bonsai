import * as fs from 'fs';
import { Metrics } from './types';
import { makeRng, pick, clamp } from './seed';

const GQL_URL = 'https://api.github.com/graphql';
const DAY_MS = 86_400_000;

interface Day {
  date: string;
  count: number;
}

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'git-bonsai',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(`GitHub GraphQL: ${body.errors[0].message}`);
  if (!body.data) throw new Error('GitHub GraphQL: empty response');
  return body.data;
}

const CALENDAR_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    createdAt
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const REPOS_QUERY = `
query($login: String!) {
  user(login: $login) {
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false,
                 orderBy: { field: STARGAZERS, direction: DESC }) {
      nodes {
        createdAt
        languages(first: 5, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
  }
}`;

/** Pull raw metrics from the GitHub API and normalize them (full history, year by year). */
export async function fetchMetrics(username: string, token: string): Promise<Metrics> {
  const now = new Date();
  const probe = await gql<{ user: { createdAt: string } | null }>(token, CALENDAR_QUERY, {
    login: username,
    from: new Date(now.getTime() - 300 * DAY_MS).toISOString(),
    to: now.toISOString(),
  });
  if (!probe.user) throw new Error(`GitHub user not found: ${username}`);
  const createdAt = probe.user.createdAt;

  // contributionsCollection covers at most one year per query — walk the years
  const days: Day[] = [];
  let from = new Date(createdAt);
  while (from < now) {
    const to = new Date(Math.min(from.getTime() + 364 * DAY_MS, now.getTime()));
    const data = await gql<{
      user: { contributionsCollection: { contributionCalendar: { weeks: { contributionDays: { date: string; contributionCount: number }[] }[] } } };
    }>(token, CALENDAR_QUERY, { login: username, from: from.toISOString(), to: to.toISOString() });
    for (const week of data.user.contributionsCollection.contributionCalendar.weeks) {
      for (const d of week.contributionDays) {
        if (days.length === 0 || d.date > days[days.length - 1].date) {
          days.push({ date: d.date, count: d.contributionCount });
        }
      }
    }
    from = new Date(to.getTime() + DAY_MS);
  }

  const repos = await gql<{
    user: { repositories: { nodes: { createdAt: string; languages: { edges: { size: number; node: { name: string } }[] } }[] } };
  }>(token, REPOS_QUERY, { login: username });

  return normalize(username, createdAt, now, days, repos.user.repositories.nodes);
}

function normalize(
  username: string,
  createdAt: string,
  now: Date,
  days: Day[],
  repos: { createdAt: string; languages: { edges: { size: number; node: { name: string } }[] } }[],
): Metrics {
  const totalContributions = days.reduce((s, d) => s + d.count, 0);

  // streaks and gaps from the daily series
  let currentStreak = 0;
  let maxStreak = 0;
  let run = 0;
  let gap = 0;
  let longestGapDays = 0;
  let gapsOver60d = 0;
  for (const d of days) {
    if (d.count > 0) {
      run++;
      maxStreak = Math.max(maxStreak, run);
      if (gap > 60) gapsOver60d++;
      longestGapDays = Math.max(longestGapDays, gap);
      gap = 0;
    } else {
      run = 0;
      gap++;
    }
  }
  longestGapDays = Math.max(longestGapDays, gap);
  // current streak may end today or yesterday
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  while (i >= 0 && days[i].count > 0) {
    currentStreak++;
    i--;
  }

  // weekend share of contributions
  let weekend = 0;
  for (const d of days) {
    const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) weekend += d.count;
  }
  const weekendRatio = totalContributions > 0 ? weekend / totalContributions : 0.25;

  // last 52 weeks -> soil levels 0..4 (fixed thresholds keep this deterministic)
  const last364 = days.slice(-364);
  const potWeeks: number[] = [];
  for (let w = 0; w < 52; w++) {
    const start = Math.max(0, last364.length - (52 - w) * 7);
    const week = last364.slice(start, start + 7);
    const total = week.reduce((s, d) => s + d.count, 0);
    potWeeks.push(total >= 25 ? 4 : total >= 12 ? 3 : total >= 5 ? 2 : total >= 1 ? 1 : 0);
  }

  // language epochs: repos created in the older vs newer half of the account
  const mid = (Date.parse(createdAt) + now.getTime()) / 2;
  const older = new Map<string, number>();
  const newer = new Map<string, number>();
  const overall = new Map<string, number>();
  for (const repo of repos) {
    const bucket = Date.parse(repo.createdAt) < mid ? older : newer;
    for (const edge of repo.languages.edges) {
      // log-damped bytes: one huge repo shouldn't drown several small ones
      const weight = Math.log2(1 + edge.size / 1024);
      bucket.set(edge.node.name, (bucket.get(edge.node.name) ?? 0) + weight);
      overall.set(edge.node.name, (overall.get(edge.node.name) ?? 0) + weight);
    }
  }
  const top = (m: Map<string, number>): string | null =>
    [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const totalSize = [...overall.values()].reduce((s, v) => s + v, 0) || 1;
  const topLanguages = [...overall.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name, size]) => ({ name, ratio: size / totalSize }));

  const epochLanguages: Metrics['epochLanguages'] = [];
  const lang0 = top(older);
  const lang1 = top(newer) ?? lang0;
  if (lang0) epochLanguages.push({ epoch: 0, lang: lang0 });
  if (lang1) epochLanguages.push({ epoch: 1, lang: lang1 });

  return {
    username,
    createdAt,
    fetchedAt: now.toISOString().slice(0, 10),
    totalContributions,
    topLanguages,
    epochLanguages,
    currentStreak,
    maxStreak,
    longestGapDays,
    gapsOver60d,
    weekendRatio,
    potWeeks,
  };
}

export function loadFixture(path: string): Metrics {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as Metrics;
}

/**
 * Offline preview: fabricate plausible metrics deterministically from the
 * username alone (no API, no token). Useful for demos and tests.
 */
export function synthMetrics(username: string): Metrics {
  const rng = makeRng('synth|' + username.toLowerCase());
  const ageYears = 1 + rng() * 11;
  const fetched = '2026-07-01';
  const createdAt = new Date(Date.parse(fetched) - ageYears * 365.25 * DAY_MS)
    .toISOString();
  const activity = rng();
  const langs = ['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Ruby', 'Java', 'C++'];
  const lang0 = pick(rng, langs);
  const lang1 = rng() < 0.4 ? pick(rng, langs) : lang0;
  const maxStreak = Math.floor(rng() * rng() * 400);
  return {
    username,
    createdAt,
    fetchedAt: fetched,
    totalContributions: Math.floor(50 + activity * activity * 30000 * (ageYears / 6)),
    topLanguages: [{ name: lang1, ratio: 0.6 }, { name: lang0, ratio: 0.3 }],
    epochLanguages: [{ epoch: 0, lang: lang0 }, { epoch: 1, lang: lang1 }],
    currentStreak: Math.floor(rng() * 30),
    maxStreak,
    longestGapDays: Math.floor(rng() * 300),
    gapsOver60d: Math.floor(rng() * 4),
    weekendRatio: clamp(rng() * 0.5, 0, 0.5),
    potWeeks: Array.from({ length: 52 }, () => Math.floor(rng() * 5)),
  };
}
