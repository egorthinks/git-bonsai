# git-bonsai playground API

Tiny Vercel service the [playground](https://egorthinks.github.io/git-bonsai/)
uses so it never hits GitHub's anonymous rate limit and grows trees identical
to the Action. Deployed at **`git-bonsai-api.vercel.app`**.

## Endpoints

- **`GET /api/metrics?u=<login>`** — the full `Metrics` object, produced by the
  engine's own `fetchMetrics()` over the GitHub GraphQL API using a server-side
  token. Real contribution calendar + real per-language byte sizes. Primary
  source when the page's `OWN_API` is set. Returns `503` if no token is
  configured (the page then falls back to its public path).
- **`GET /api/calendar?u=<login>&since=<year>`** — just the contribution
  calendar, scraped from GitHub's public HTML (no token needed). Backup path.

Both send `Access-Control-Allow-Origin: *` and edge-cache for 6h, so popular
names are served without spending quota. The login is regex-validated. Only
**public** data is read; the token never leaves the server.

## The token

`/api/metrics` reads `process.env.GITHUB_TOKEN`. Add it in the Vercel project:
**Settings → Environment Variables → `GITHUB_TOKEN`** (Production), then
redeploy so it takes effect. A classic PAT with **no scopes** (or a
fine-grained token with only public read) is enough — it authenticates public
API calls, lifting the limit from 60/h per IP to 5000/h.

## Deploy / update

`api/metrics.js` runs the compiled engine, so keep its copy in sync:

```bash
npm run build            # in the repo root, if data.ts/seed.ts changed
node playground-api/sync-dist.js
# then redeploy playground-api/ to Vercel
```
