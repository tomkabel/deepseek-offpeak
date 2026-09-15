# DeepSeek Off-Peak — process flow

A minimal, single-page static site on Cloudflare Pages: a live peak/off-peak
clock + off-peak rate table + token cost calculator for DeepSeek API pricing.

## Source data (ground truth)
https://api-docs.deepseek.com/quick_start/pricing/  (fetched 2026-08-23)

Per 1M tokens. Off-peak is exactly half of peak.
| model            | cache-hit in | cache-miss in | output |
|------------------|--------------|---------------|--------|
| V4 Flash         | $0.007       | $0.22         | $0.66  |
| V4 Pro           | $0.022       | $0.66         | $1.98  |
| V4 Flash Vision  | $0.007       | $0.22         | $0.66  |
Peak = 2x each. Concurrency: flash 2500, pro 500, vision 2500.

Peak hours: 01:00–04:00 and 06:00–10:00 UTC (all else off-peak).
Weekends (Beijing time, UTC+8) are off-peak all day, effective 2026-08-23.

## Phases
1. Market research (subagent) — landscape + design patterns + feature list.
2. Tech research (subagent) — stack decision.
3. Planning (this doc).
4. Code — vanilla HTML/CSS/JS, no build, no deps.
5. Code review (subagent).
6. Deploy via wrangler Pages + verify live.

## Tech decision
Vanilla HTML/CSS/JS, single folder, `wrangler pages deploy`. No framework,
no build step, no external fonts/JS. Timezone logic is pure UTC + a Beijing
offset; the only non-trivial logic (peak/off-peak + next transition) is in
pure functions on `globalThis.DS` so `test.mjs` can assert it in Node.

## Files
- index.html  — semantic markup, rate table + calc + clock scaffolding
- styles.css  — dark minimal theme, CSS vars, responsive, reduced-motion
- app.js      — pure schedule logic + UI wiring (guarded for Node)
- test.mjs    — self-check for the schedule/transition logic
- PLAN.md     — this file

## Deploy
`wrangler pages project create deepseek-offpeak --production-branch main`
`wrangler pages deploy . --project-name deepseek-offpeak --branch main \
  --commit-dirty=true --commit-message "initial"`
Verify: `curl -s -o /dev/null -w "%{http_code}" https://deepseek-offpeak.pages.dev`

## Redesign v2 — tier-one spec (2026-08-23, senior critique)

Critique verdict on v1 redesign: still a 2023 "dark SaaS clone" — monotonous
~840px column, triple-redundant hero copy, non-interactive pill timeline,
unformatted raw-int inputs, binary cache toggle, amber misuse on the save
card, low-contrast subtext. Target: Stripe/Raycast-tier developer utility.

Accept: OKLCH token scale, unified emerald save card (amber = peak ONLY),
wider fluid layout with 2-col desktop grid, scrubbable dual-axis time ribbon
(local + Beijing) with live pricing preview, right-aligned tabular rates,
SI token inputs + presets + cache-hit % slider, USD/CNY toggle (fixed
indicative rate), cron/SDK export drawer.
Reject (hype, per v1): neuro-adaptive typography, haptic/biometric input,
proximity sensing, .ics calendar export, batch-concurrency checkbox, vision
per-image-tile tooltip.

### v2 phases (one subagent each, strictly sequential — same 3 files)
1. Design tokens & atmosphere — styles.css ONLY. OKLCH surface/luminance
   scale, .card-tier-1 surface (inset specular + ambient shadow), unified
   emerald save card (kill amber glow), contrast fixes (muted >= 4.5:1),
   widen .wrap to ~1120px + 2-col grid shells.
2. Hero & scrubbable time ribbon — index.html + styles.css + app.js UI.
   One consolidated status capsule (status + Beijing time + next transition,
   kill all duplicate copy); dual-axis ribbon (local top / Beijing bottom,
   continuous emerald/amber zones); draggable playhead -> preview mode:
   status + rates + calculator reflect scrubbed hour; LIVE reset affordance.
   Beijing clock visually dominant (billing source of truth).
3. Rates matrix — index.html + styles.css + app.js UI. Right-aligned,
   decimal-aligned tabular financials; off-peak/peak split + delta %;
   concurrency + version badges; USD/CNY toggle (fixed ~7.1, "indicative"
   note); responds to playhead preview.
4. Calculator engine — index.html + styles.css + app.js UI. SI token inputs
   (parse 1M/500k/128k) + preset chips; hide native steppers via CSS; cache
   hit % slider 0-100 replacing binary toggle; token breakdown line
   (x @ hit | y @ miss); unified emerald result cards; desktop 2-col
   (config | savings); responds to playhead preview.
5. Dev actionability — index.html + styles.css + app.js UI. Drawer with
   tabs: cron (TZ=Asia/Shanghai, off-peak Beijing hours) / Python / TS SDK
   snippets; one Copy button; snippet shows current model + next off-peak
   window (computed from nextTransition).
6. Final code review (subagent) — adversarial diff vs critique checklist +
   v1 constraints; node test.mjs unchanged; dist/ in sync; a11y,
   reduced-motion, no deps. Fix ALL findings before sign-off.
7. Deploy (me) — wrangler pages deploy + curl verify.

Hard constraints (all phases, unchanged from v1):
- Vanilla HTML/CSS/JS. Zero deps, no build, no external fonts. dist/ mirrors
  root (index.html, styles.css, app.js) after EVERY phase.
- `node test.mjs` must pass unchanged. Pure logic in app.js (isPeak,
  isBeijingWeekend, nextTransition, MODELS, PEAK_FACTOR, usd, fmtDuration +
  globalThis.DS export) must NOT change — only the browser-only UI wiring
  block (inside `if (typeof document !== "undefined")`) may change.
- Keep: semantic HTML, aria-live, :focus-visible rings, tabular-nums, text
  contrast >= 4.5:1, prefers-reduced-motion honored.

## Redesign — 2026 visual audit (2026-08-23)

Audit verdict: flat "SaaS dark mode" — legit fixes: gradient-mesh atmosphere,
glass volumetric surfaces, softer gradient typography, labeled fluid timeline,
segmented cache control, focus-scaling inputs. Rejected as unimplementable
hype: neuro-adaptive typography, haptic/biometric inputs, proximity sensing.

Non-negotiable constraints (all phases):
- Vanilla HTML/CSS/JS. Zero deps, no build, no external fonts. dist/ mirrors
  root (index.html, styles.css, app.js) after every phase.
- `node test.mjs` must pass unchanged. Pure schedule/rate logic in app.js
  (isPeak, nextTransition, MODELS, usd, fmtDuration + globalThis.DS export)
  must NOT change — only the browser-only UI wiring block may change.
- Keep: semantic HTML, aria-live, :focus-visible rings, tabular-nums,
  text contrast >= 4.5:1, prefers-reduced-motion honored.

Design direction — "aurora glass": deep layered gradient-mesh background,
translucent glass surfaces (inner top highlight + soft z-shadow), neon
softened to gradient text + faint glow, fluid type via clamp().

Phase 1 — Atmosphere & design tokens (styles.css ONLY)
- Rework :root: layered mesh tokens (--bg-mesh, aurora blob colors), glass
  tokens (--glass, --glass-2, --ring, --shadow-1/-2), refine --off/#2ee6a8
  and --peak/#ffb454 toward bioluminescent teal/amber.
- body: replace 2 flat radial gradients with 3-4 large low-opacity aurora
  blobs (green/teal/indigo/amber, ~0.05-0.09 alpha) over a base linear
  gradient; background-attachment fixed.
- Add .panel glass utility: translucent fill, 1px rgba(255,255,255,.08)
  border, radius, inset top highlight, soft outer shadow. Apply to
  .table-scroll, #calc-form, .r (replace their flat --surface + border).
- Selection color, focus ring softened to match.

Phase 2 — Hero & timeline fluidity (index.html, styles.css, app.js UI block)
- Status badge: down from 72px to clamp(36px, 8vw, 58px), weight 700,
  letter-spacing .04em, gradient text (--off → teal), faint layered glow.
  Keep pulse dot + aria-live.
- h2: clamp(18px, 2.5vw, 22px). Eyebrow/countdown/clocks spacing tuned.
- Strip → continuous segmented bar: static axis tick row (00 06 12 18 24)
  + legend (off-peak/peak dots) in HTML; cells become pills with state
  gradients (off = teal gradient, peak = amber gradient) inside a glass
  track; JS renderStrip adds class `live` to the current-hour cell (subtle
  pulse); .now marker restyled as glowing hairline. Strip stays
  aria-hidden; the visible note carries the info.
- reduced-motion: no pulse, no transition on .now.

Phase 3 — Calculator & rates (index.html, styles.css, app.js UI block)
- Cache radios → horizontal segmented control: .seg grid of 2 button-like
  labels, hidden-but-focusable inputs, checked = glass-pill highlight,
  :focus-visible ring preserved. Keyboard nav unchanged (native radios).
- Inputs/select: scale(1.02) + glow ring on :focus-within, 150ms transition,
  none under reduced-motion.
- Rates table: glass panel, rgba row separators, row hover lift
  (background rgba lift), model small muted; keep tabular-nums.
- Result cards: .r glass; r-val.off gradient text; "You save" card gets an
  amber ::before glow bar.

Phase 4 — Final code review (subagent): adversarial diff review vs this
plan + constraints; run node test.mjs; verify a11y, reduced-motion, no deps,
dist/ in sync. Findings fixed before sign-off.

## Critique round v4 (2026-08-23, senior audit #2)

Audit claimed WCAG failures (2.4:1–3.4:1) and a flat #05080A canvas — both
contradicted by measurement: every token pair in styles.css passes AA
(4.69:1–18.4:1, see audit.mjs). Accepted fixes (this round):

- Hierarchy inversion: "Automate off-peak dispatch" demoted from solid
  emerald CTA to quiet secondary button — the $ result card is the anchor.
- Temporal ergonomics: 4 time displays → dual-zone pill (Local → Beijing,
  billing). UTC clock removed; Beijing time deduped out of the capsule;
  capsule copy clarified ("Off-peak for the next X" / "Peak ends in X").
- Micro-type: sub-12px labels bumped (ribbon 9→11, CST small 9.5→11,
  pills 10→11, delta 10.5→11.5, rate-sub 11.5→12, legend 11→12, eyebrow
  →13). Legibility, not contrast (contrast already passed).
- Dead space: .wrap 1120 → 1280px.
Rejected as opinion/hype: borderless tables, sticky sidebars/split command
decks, white primary CTA (would compete MORE with metrics), slider readout
relocation (label already carries the live %).
Frozen-logic guard held: node test.mjs unchanged and green; only the
browser-only UI block of app.js touched.

## v5 — calculator → cache playbook (2026-09-15)

**Why:** the calculator answered "what does this cost?" — a question the user
already knows the answer to. The bigger lever is the one nobody tunes: on
Flash a cache hit is **50×** cheaper than a miss ($0.003 vs $0.15/1M), so
prompt-prefix discipline beats window-shifting. Off-peak alone is −50%; ~95%
cache hits alone is −85%; both stack to −92.6%. The tool should teach the
bigger lever and prove it with one number.

### Mechanics (api-docs.deepseek.com/guides/kv_cache, scraped 2026-09-15)

A hit requires a request to **fully match a persisted cache prefix unit from
token 0**. Partial/middle matches never hit. Units are persisted three ways:

1. **Request boundaries** — every request persists two units: end of user
   input, end of model output. (→ append-only multi-turn hits for free.)
2. **Common-prefix detection** — a prefix shared across requests is persisted
   as its own unit *once DeepSeek has detected it*. In DeepSeek's own long-text
   example requests #1 and #2 miss and #3 hits. (→ cold fan-out is all misses;
   warm the prefix first.)
3. **Fixed token intervals** — long inputs/outputs get units carved at
   intervals so a long prefix is never wholly uncacheable.

Best-effort, no 100% guarantee. Cache builds in seconds, is evicted hours-to-
days after last use. Free, automatic, no code change, no storage fee. Sampling
randomness is unaffected (only the prefix is reused, decoding still runs).
Monitor `usage.prompt_cache_hit_tokens / prompt_cache_miss_tokens`.

### Playbook (8 rules, shipped as the left column)

1. Freeze prefix order: system → tools → few-shot → documents → user turn LAST.
2. Evict volatile tokens from the head (timestamps, UUIDs, "today is…",
   randomly sampled few-shots). One changed token at position 12 rebills the
   whole prefix.
3. Serialize deterministically — stable JSON key order, stable tool order,
   identical whitespace.
4. Append, never rewrite history. Summarizing/trimming old turns rewrites the
   prefix and forfeits the whole conversation's cache.
5. Warm the prefix before fan-out (rule 2 of mechanics): two cheap calls with
   different tails, then parallelize. One is not enough — the common prefix
   unit only exists once DeepSeek has seen the prefix across requests, which
   is why #1 and #2 both miss in the official example. Never launch N cold
   parallel requests on a fresh document.
6. Batch by prefix, not by arrival — unused prefixes are evicted in hours.
7. Ship one prompt version at a time; every live variant is a separate prefix
   that must be warmed and kept warm on its own share of traffic.
8. Measure: hit rate = hit/(hit+miss) per request, alert on drops. A silent
   prefix change is a 50× price increase.

Then stack off-peak on the residual misses.

### Anchor scenario (computed live from MODELS, not hardcoded)

Docs/support assistant on Flash: 12,000 req/day · 30,000 input tokens of which
28,500 are the stable prefix (system 1.2k + tools 1.8k + 20 few-shots 6.5k +
retrieved docs 19k) and 1,500 are the live question · 700 output · 365 days.
Max achievable hit ratio = prefix share = 95%.

| | no cache | 95% cache |
|---|---|---|
| peak | $43,099/yr | $6,399/yr |
| off-peak | $21,550/yr | **$3,200/yr** |

Headline: **$39,899/yr saved, −92.6%**.

### Build

- `index.html`: `<section class="calc">` (form + result) → `<section class="play">`:
  mechanics card + 8-rule list (left) | savings panel (right). The model
  `<select>` survives as the one control — it drives both the savings figure
  and the export snippets. Everything else in the form is deleted.
- `app.js`: delete `parseTokens`/`fmtTokens`/`recalc`/chip+slider+image wiring;
  add `annualCost()` + `renderSavings()` reading `MODELS`/`CNY_MODELS` so the
  matrix follows the currency toggle and never hardcodes a price.
- Export drawer kept; adds a 4th **Cache** tab — a copy-ready cache-optimal
  prompt skeleton (stable prefix, variable tail, warm-up, hit-rate logging).
- `test.mjs`: calculator assertions → `annualCost` quadrant assertions.
- `styles.css`: `.play` / `.rules` / `.s-matrix`; dead calculator rules removed.
