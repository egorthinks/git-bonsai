// Full-metrics endpoint (deployed on Vercel):
//   GET /api/metrics?u=<login>  ->  the exact Metrics object the Action feeds
//                                   the generator (same fetchMetrics, GraphQL)
//
// Runs the engine's own dist/src/data.fetchMetrics() with a server-side token
// (env GITHUB_TOKEN), so the playground grows the *identical* tree to the
// Action: real contribution calendar + real per-language byte sizes, no
// anonymous api.github.com rate limit (5000/h with a token vs 60/h per IP),
// no HTML scraping. Public data only — a token with NO scopes is enough.
// The token stays on the server; the browser never sees it.
'use strict';

const { fetchMetrics } = require('../dist/src/data');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const login = String(req.query.u ?? '');
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(login)) {
    return res.status(400).json({ error: 'invalid GitHub login' });
  }
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    // let the browser fall back to its public path instead of erroring hard
    return res.status(503).json({ error: 'server token not configured' });
  }
  try {
    const metrics = await fetchMetrics(login, token);
    // popular names serve from the edge without spending the token/GitHub quota
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json(metrics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = /not found|Could not resolve/i.test(msg) ? 404 : 502;
    return res.status(code).json({ error: msg });
  }
};
