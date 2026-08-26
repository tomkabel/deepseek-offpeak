# AGENTS.md — DeepSeek Off-Peak

Zero-dependency vanilla static site (no build step, no npm, no frameworks).
Live clock / rate matrix / cost calculator for DeepSeek off-peak API pricing.

## Hard rules

- **Schedule logic is frozen.** `isPeak()`, `nextTransition()`, `isBeijingWeekend()`
  in `app.js` carry the timing model. Do NOT change them without updating
  `test.mjs` and running it. `node test.mjs` must pass before any commit.
- **No dependencies.** No new packages, no external fonts/JS/CDNs. Everything
  ships from the repo.
- **Keep `dist/` in sync with root.** Deploy artifact mirrors `app.js`,
  `index.html`, `styles.css`, `_headers` at the root. Copy changes into `dist/`
  before deploying; `diff -q` each file to verify.
- Root files are the source of truth; `dist/` is only for deployment.

## Layout

| Path | Purpose |
|---|---|
| `index.html` | Semantic markup — hero/status, ribbon, rate table, calculator |
| `styles.css` | OKLCH token system, aurora-glass theme, reduced-motion |
| `app.js` | Pure schedule logic (`globalThis.DS`) + browser UI wiring |
| `test.mjs` | Node self-check pinning schedule boundaries + rates (Node 18+) |
| `audit.mjs` | WCAG contrast audit of OKLCH token pairs |
| `dist/` | Deploy artifact (mirrors root) |
| `_headers` | Security headers (nosniff, frame denial, permissions policy) |
| `PLAN.md` | Design history v1→v4, decisions & rejections |

## Deploy

```sh
node test.mjs                        # must pass first
cp app.js index.html styles.css _headers dist/
wrangler pages deploy dist --project-name deepseek-offpeak --branch main
```

Wrangler auth: `CF_API_TOKEN` env var (account "The M3nt0r",
`c1cf23b37f7f32828f44df16938a0d2d`).

## Live URLs

- `https://deepseek-offpeak.pages.dev` (default)
- `https://ds.tomabel.ee` (custom domain, CNAME → deepseek-offpeak.pages.dev, proxied)
- `https://deepseek.tomabel.ee` (custom domain, CNAME → deepseek-offpeak.pages.dev, proxied)

Custom domains are managed in the Cloudflare Pages project
(`/accounts/{acct}/pages/projects/deepseek-offpeak/domains`) plus proxied
CNAME records in the `tomabel.ee` zone (id `d68f0c43d3e24b826db1ab807d846028`).

## Verify after deploy

```sh
curl -sI https://deepseek-offpeak.pages.dev | head -1
curl -sI https://ds.tomabel.ee | head -1
curl -sI https://deepseek.tomabel.ee | head -1
```
