<div align="center">

# 🐴 DeepSeek Off-Peak

**Live peak/off-peak clock, rate matrix & cost calculator for DeepSeek API pricing**

Zero-dependency · static · deployed on Cloudflare Pages

`https://deepseek-offpeak.pages.dev`

</div>

---

## What it is

DeepSeek API pricing has an off-peak window (01:00–04:00 & 06:00–10:00 UTC, all
weekend) where every token costs **exactly half** the peak rate. This is a
single-page tool that tells you — in one glance — whether you're in the cheap
window right now, when it flips, and what a given workload actually costs in
each window.

- **Live status** — OFF-PEAK / PEAK with a natural-language countdown
  ("Off-peak for the next 18h 57m") and a unified `Local → Beijing` dual-zone
  clock pill (billing runs on Beijing time).
- **Scrubbable 24h ribbon** — dual-axis (Local + Beijing) timeline; drag the
  playhead to preview status, rates and calculator results at any hour.
- **Rate matrix** — right-aligned, decimal-aligned tabular pricing for V4
  Flash / Pro / Vision with off-peak ↔ peak deltas, concurrency and USD/CNY
  toggle (indicative rate).
- **Cost calculator** — SI token inputs (`1M`, `500k`, `128k`), preset chips,
  cache-hit-ratio slider, and a live savings breakdown.
- **Automation snippets** — copy-ready cron / Python / TypeScript snippets
  for scheduling jobs into the off-peak window.

Built for the developer question "should I run this now, or in 3 hours?"

## Quick start

The site is static — open `index.html` or serve the folder:

```sh
# local preview
python3 -m http.server 8080 --directory dist

# self-check (schedule + transition logic, Node 18+)
node test.mjs
```

No build step, no dependencies, no external fonts or JS.

## Project layout

| Path | Purpose |
|---|---|
| `index.html` | Semantic markup — hero/status, ribbon, rate table, calculator, export drawer |
| `styles.css` | OKLCH token system, aurora-glass theme, responsive + reduced-motion |
| `app.js` | Pure schedule logic (`globalThis.DS`) + browser-only UI wiring |
| `test.mjs` | Node self-check for `isPeak`, `nextTransition`, rates, formatting |
| `audit.mjs` | WCAG contrast audit of the OKLCH token pairs (all pass AA) |
| `dist/` | Deploy artifact — mirrors root (kept in sync) |
| `PLAN.md` | Design history: v1 → v4 critique rounds, decisions & rejections |
| `_headers` | Security headers (nosniff, frame denial, permissions policy) |

## How the schedule works

Pure functions on `globalThis.DS`, isolated so Node can assert them:

- **Peak hours:** 01:00–04:00 and 06:00–10:00 **UTC**
- **Weekend override:** Beijing time (UTC+8) Saturday/Sunday are off-peak all day
- Off-peak = exactly ½ peak for every model

`isPeak()`, `nextTransition()` and `isBeijingWeekend()` carry the whole
timing model; the UI is just a renderer over them. `test.mjs` pins the
boundary cases (weekday edges, Friday→Monday weekend rollover, weekend
overrides).

## Deploy

```sh
wrangler pages project create deepseek-offpeak --production-branch main
wrangler pages deploy dist --project-name deepseek-offpeak --branch main
```

Live: `https://deepseek-offpeak.pages.dev`

## Design & accessibility

Dark aurora-glass aesthetic on an OKLCH perceptual token scale. Every text
pair measures ≥ 4.5:1 (WCAG AA — verified by `audit.mjs`); emerald is
reserved for off-peak/success, amber for peak/warning. Semantic HTML,
`aria-live` status, `:focus-visible` rings, `prefers-reduced-motion` honored.

## License

MIT © 2026 Tom Kristian Abel
