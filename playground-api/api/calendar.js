// Our own CORS-open contribution-calendar endpoint (deployed on Vercel):
//   GET /api/calendar?u=<login>&since=<year>  ->  { login, contributions: [{date, count}] }
//
// Fetches github.com/users/<login>/contributions (the public HTML calendar,
// no token needed) for every year in parallel and parses the
// <td data-date> / <tool-tip> markup server-side. Responses are edge-cached
// (s-maxage) so popular names cost GitHub one fetch per year per 6 hours.
// The playground uses this as its primary calendar source; community mirrors
// and a CORS-passthrough walk remain as fallbacks in the page itself.
'use strict';

const TD_RE = /<td\b[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"[^>]*>/g;
const TIP_RE = /<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)</g;
const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}="([^"]*)"`)) ?? [])[1];

function parseYear(html) {
  const tips = new Map();
  for (const m of html.matchAll(TIP_RE)) tips.set(m[1], m[2].trim());
  const days = [];
  for (const m of html.matchAll(TD_RE)) {
    const tag = m[0];
    const tip = tips.get(attr(tag, 'id')) ?? '';
    const counted = tip.match(/^([\d,]+)\s+contribution/);
    const count = counted ? parseInt(counted[1].replace(/,/g, ''), 10)
      : /^no\s/i.test(tip) ? 0
      : parseInt(attr(tag, 'data-level') ?? '0', 10); // degraded fallback if markup shifts
    days.push([m[1], count]);
  }
  if (days.length === 0) throw new Error('calendar markup not recognized');
  return days;
}

async function fetchYear(login, year) {
  const url = `https://github.com/users/${encodeURIComponent(login)}/contributions?from=${year}-01-01&to=${year}-12-31`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'git-bonsai-playground (+https://github.com/egorthinks/git-bonsai)' },
  });
  if (res.status === 404) { const e = new Error('not found'); e.code = 404; throw e; }
  if (!res.ok) { const e = new Error(`GitHub answered HTTP ${res.status}`); e.code = 502; throw e; }
  return parseYear(await res.text());
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const login = String(req.query.u ?? '');
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(login)) {
    return res.status(400).json({ error: 'invalid GitHub login' });
  }
  const thisYear = new Date().getUTCFullYear();
  let since = parseInt(String(req.query.since ?? ''), 10);
  if (!Number.isFinite(since)) since = thisYear;
  since = Math.max(2005, Math.min(since, thisYear));

  try {
    const years = [];
    for (let y = since; y <= thisYear; y++) years.push(y);
    const perDay = new Map(); // calendars include edge days of adjacent years — dedupe
    for (const days of await Promise.all(years.map((y) => fetchYear(login, y)))) {
      for (const [date, count] of days) perDay.set(date, count);
    }
    const contributions = [...perDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, count]) => ({ date, count }));
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ login, contributions });
  } catch (err) {
    return res.status(err.code === 404 ? 404 : 502).json({ error: err.message });
  }
};

module.exports.parseYear = parseYear; // exposed for tests
