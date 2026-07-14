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
exports.fetchMetrics = fetchMetrics;
exports.normalize = normalize;
exports.loadFixture = loadFixture;
exports.synthMetrics = synthMetrics;
const fs = __importStar(require("fs"));
const seed_1 = require("./seed");
const GQL_URL = 'https://api.github.com/graphql';
const DAY_MS = 86_400_000;
async function gql(token, query, variables) {
    const res = await fetch(GQL_URL, {
        method: 'POST',
        headers: {
            Authorization: `bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'git-bonsai',
        },
        body: JSON.stringify({ query, variables }),
    });
    if (!res.ok)
        throw new Error(`GitHub GraphQL HTTP ${res.status}: ${await res.text()}`);
    const body = (await res.json());
    // tolerate partial responses: probing user+organization always NOT_FOUNDs one of them
    if (!body.data) {
        throw new Error(`GitHub GraphQL: ${body.errors?.[0]?.message ?? 'empty response'}`);
    }
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
const ORG_QUERY = `
query($login: String!) {
  organization(login: $login) {
    createdAt
    repositories(first: 100, isFork: false, orderBy: { field: STARGAZERS, direction: DESC }) {
      nodes {
        createdAt
        languages(first: 5, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 100) { totalCount nodes { committedDate } }
            }
          }
        }
      }
    }
  }
}`;
/** Pull raw metrics from the GitHub API and normalize them (full history, year by year). */
async function fetchMetrics(username, token) {
    const now = new Date();
    const probe = await gql(token, CALENDAR_QUERY, {
        login: username,
        from: new Date(now.getTime() - 300 * DAY_MS).toISOString(),
        to: now.toISOString(),
    });
    if (!probe.user)
        return fetchOrgMetrics(username, token, now);
    const createdAt = probe.user.createdAt;
    // contributionsCollection covers at most one year per query — walk the years
    const days = [];
    let from = new Date(createdAt);
    while (from < now) {
        const to = new Date(Math.min(from.getTime() + 364 * DAY_MS, now.getTime()));
        const data = await gql(token, CALENDAR_QUERY, { login: username, from: from.toISOString(), to: to.toISOString() });
        for (const week of data.user.contributionsCollection.contributionCalendar.weeks) {
            for (const d of week.contributionDays) {
                if (days.length === 0 || d.date > days[days.length - 1].date) {
                    days.push({ date: d.date, count: d.contributionCount });
                }
            }
        }
        from = new Date(to.getTime() + DAY_MS);
    }
    const repos = await gql(token, REPOS_QUERY, { login: username });
    return normalize(username, createdAt, now, days, repos.user.repositories.nodes);
}
/**
 * Organization accounts have no contribution calendar, so the daily series is
 * approximated from recent default-branch commits of the top repos. Repo
 * languages/ages work exactly like for users.
 */
async function fetchOrgMetrics(login, token, now) {
    const data = await gql(token, ORG_QUERY, { login });
    if (!data.organization)
        throw new Error(`GitHub user or organization not found: ${login}`);
    const { createdAt, repositories } = data.organization;
    // fold commit dates of all default branches into one synthetic daily series
    const perDay = new Map();
    let totalCommits = 0;
    for (const repo of repositories.nodes) {
        const hist = repo.defaultBranchRef?.target?.history;
        if (!hist)
            continue;
        totalCommits += hist.totalCount;
        for (const c of hist.nodes) {
            const day = c.committedDate.slice(0, 10);
            perDay.set(day, (perDay.get(day) ?? 0) + 1);
        }
    }
    const days = [];
    const start = Date.parse(createdAt);
    for (let t = start; t <= now.getTime(); t += DAY_MS) {
        const date = new Date(t).toISOString().slice(0, 10);
        days.push({ date, count: perDay.get(date) ?? 0 });
    }
    const metrics = normalize(login, createdAt, now, days, repositories.nodes, true);
    // history(first: 100) undercounts activity — trust the branch totals instead
    metrics.totalContributions = Math.max(metrics.totalContributions, totalCommits);
    return metrics;
}
/**
 * Turn a raw daily series + repo list into Metrics. Exported so alternative
 * data sources (the browser playground's public-API path) share the exact
 * same normalization as the GraphQL fetcher — same data in, same tree out.
 */
function normalize(username, createdAt, now, days, repos, isOrg = false) {
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
            if (gap > 60)
                gapsOver60d++;
            longestGapDays = Math.max(longestGapDays, gap);
            gap = 0;
        }
        else {
            run = 0;
            gap++;
        }
    }
    longestGapDays = Math.max(longestGapDays, gap);
    // current streak may end today or yesterday
    let i = days.length - 1;
    if (i >= 0 && days[i].count === 0)
        i--;
    while (i >= 0 && days[i].count > 0) {
        currentStreak++;
        i--;
    }
    // weekend share of contributions
    let weekend = 0;
    for (const d of days) {
        const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
        if (dow === 0 || dow === 6)
            weekend += d.count;
    }
    const weekendRatio = totalContributions > 0 ? weekend / totalContributions : 0.25;
    // last 52 weeks -> soil levels 0..4 (fixed thresholds keep this deterministic)
    const last364 = days.slice(-364);
    const potWeeks = [];
    for (let w = 0; w < 52; w++) {
        const start = Math.max(0, last364.length - (52 - w) * 7);
        const week = last364.slice(start, start + 7);
        const total = week.reduce((s, d) => s + d.count, 0);
        potWeeks.push(total >= 25 ? 4 : total >= 12 ? 3 : total >= 5 ? 2 : total >= 1 ? 1 : 0);
    }
    // rhythm signals for style selection: weekly variance and burstiness
    const firstActive = days.findIndex((d) => d.count > 0);
    const activeDays = firstActive >= 0 ? days.slice(firstActive) : days;
    const weeks = [];
    for (let w = 0; w + 7 <= activeDays.length; w += 7) {
        weeks.push(activeDays.slice(w, w + 7).reduce((s, d) => s + d.count, 0));
    }
    const weekMean = weeks.length > 0 ? weeks.reduce((s, v) => s + v, 0) / weeks.length : 0;
    const weekStd = weeks.length > 0
        ? Math.sqrt(weeks.reduce((s, v) => s + (v - weekMean) ** 2, 0) / weeks.length)
        : 0;
    const weeklyCv = weekMean > 0 ? weekStd / weekMean : 1;
    const sorted = [...weeks].sort((a, b) => b - a);
    const topN = Math.max(1, Math.floor(sorted.length * 0.1));
    const topSum = sorted.slice(0, topN).reduce((s, v) => s + v, 0);
    const burstiness = totalContributions > 0 ? topSum / totalContributions : 0;
    // language epochs: repos created in each third of the account's life
    const created = Date.parse(createdAt);
    const third = (now.getTime() - created) / 3;
    const buckets = [new Map(), new Map(), new Map()];
    const overall = new Map();
    const repoWeights = [];
    for (const repo of repos) {
        const idx = Math.min(2, Math.max(0, Math.floor((Date.parse(repo.createdAt) - created) / third)));
        let repoWeight = 0;
        for (const edge of repo.languages.edges) {
            // log-damped bytes: one huge repo shouldn't drown several small ones
            const weight = Math.log2(1 + edge.size / 1024);
            repoWeight += weight;
            buckets[idx].set(edge.node.name, (buckets[idx].get(edge.node.name) ?? 0) + weight);
            overall.set(edge.node.name, (overall.get(edge.node.name) ?? 0) + weight);
        }
        repoWeights.push({
            weight: repoWeight,
            ageDays: (now.getTime() - Date.parse(repo.createdAt)) / DAY_MS,
        });
    }
    // repo concentration: does one rock tower over the history, or do a few
    // flagships of similar weight split it?
    repoWeights.sort((a, b) => b.weight - a.weight);
    const weightSum = repoWeights.reduce((s, r) => s + r.weight, 0);
    const topWeight = repoWeights[0]?.weight ?? 0;
    const topRepoShare = weightSum > 0 ? topWeight / weightSum : 0;
    // flagships: long-lived repos within 75% of the leader that together
    // dominate the account — otherwise it's just one leader with satellites
    const flagships = repoWeights.filter((r) => r.ageDays > 365 && r.weight >= topWeight * 0.75);
    const flagshipSum = flagships.reduce((s, r) => s + r.weight, 0);
    const flagshipCount = flagships.length >= 2 && weightSum > 0 && flagshipSum / weightSum >= 0.55
        ? Math.min(5, flagships.length)
        : 1;
    const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    const totalSize = [...overall.values()].reduce((s, v) => s + v, 0) || 1;
    const topLanguages = [...overall.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([name, size]) => ({ name, ratio: size / totalSize }));
    const epochLanguages = [];
    let prev = null;
    [0, 1, 2].forEach((e) => {
        const langE = top(buckets[e]) ?? prev ?? top(overall);
        if (langE) {
            epochLanguages.push({ epoch: e, lang: langE });
            prev = langE;
        }
    });
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
        weeklyCv,
        burstiness,
        repoCount: repos.length,
        topRepoShare,
        flagshipCount,
        isOrg,
    };
}
function loadFixture(path) {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
}
/**
 * Offline preview: fabricate plausible metrics deterministically from the
 * username alone (no API, no token). Useful for demos and tests.
 */
function synthMetrics(username) {
    const rng = (0, seed_1.makeRng)('synth|' + username.toLowerCase());
    const ageYears = 1 + rng() * 11;
    const fetched = '2026-07-01';
    const createdAt = new Date(Date.parse(fetched) - ageYears * 365.25 * DAY_MS)
        .toISOString();
    const activity = rng();
    const langs = ['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Ruby', 'Java', 'C++'];
    const lang0 = (0, seed_1.pick)(rng, langs);
    const lang1 = rng() < 0.4 ? (0, seed_1.pick)(rng, langs) : lang0;
    const lang2 = rng() < 0.4 ? (0, seed_1.pick)(rng, langs) : lang1;
    const maxStreak = Math.floor(rng() * rng() * 400);
    return {
        username,
        createdAt,
        fetchedAt: fetched,
        totalContributions: Math.floor(50 + activity * activity * 30000 * (ageYears / 6)),
        topLanguages: [{ name: lang2, ratio: 0.6 }, { name: lang0, ratio: 0.3 }],
        epochLanguages: [
            { epoch: 0, lang: lang0 },
            { epoch: 1, lang: lang1 },
            { epoch: 2, lang: lang2 },
        ],
        currentStreak: Math.floor(rng() * 30),
        maxStreak,
        longestGapDays: Math.floor(rng() * 300),
        gapsOver60d: Math.floor(rng() * 4),
        weekendRatio: (0, seed_1.clamp)(rng() * 0.5, 0, 0.5),
        potWeeks: Array.from({ length: 52 }, () => Math.floor(rng() * 5)),
        weeklyCv: 0.4 + rng() * 1.4,
        burstiness: rng() * 0.7,
        repoCount: 1 + Math.floor(rng() * 20),
        topRepoShare: rng() * 0.85,
        flagshipCount: rng() < 0.7 ? 1 : 2 + Math.floor(rng() * 4),
        isOrg: false,
    };
}
