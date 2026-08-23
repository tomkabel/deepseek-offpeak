# DeepSeek Off-Peak Pricing Clock — Research Brief

## 1. Existing tools (competitive landscape)
- **deepakness.com/deepseek** — a live "DeepSeek peak/off-peak price clock" already exists and is the direct competitor. It shows a live countdown to the next rate flip, local + UTC times, a peak/off-peak window table, and per-model cache-miss input/output prices for V4 Flash & Pro. (Sources: reddit.com/r/DeepSeek/comments/1vsjbxr, deepakness.com/deepseek)
- **Gaps it leaves open (our wedge):** omits the cache-hit rate (the single biggest cost lever), omits the vision model entirely, shows no concurrency limits, and injects affiliate/referral links (OpenCode) that clutter the minimal concept.
- CostGoat, Helicone, Wavespeed, Flowlyn, Layer3Labs all publish calculators, but they are cost *estimators*, not a live "is it cheap right now" clock.

## 2. What developers find confusing / valuable
- **Timezone flip:** peak windows are defined in Beijing time but DeepSeek publishes them in UTC; devs repeatedly mis-convert ("peak hours are normal hours Beijing time"). A local-time render is the core value.
- **Cache-hit vs cache-miss:** dominant confusion AND dominant savings lever (cache-hit ~98% off vs ~90% industry norm). Most tables bury it; users want it front and center.
- **Weekend rule:** effective 2026-08-23, weekends (Beijing) are off-peak ALL day — easy to miss, high value to surface.
- **New V4 pricing is ~10x V3**, so the off-peak 50% discount now matters far more for batch scheduling.

## 3. Minimal design exemplars (patterns to steal)
- **time.is** — giant exact clock, "Your time is exact!", single focal number, zero chrome → hero number = current rate state + countdown.
- **deepakness clock** — live countdown + "next flip" + window table. Great live-status affordance; drop its affiliate noise.
- **Stripe/OpenAI status pages** — green/amber status dot + Operational/Degraded vocabulary maps perfectly to Off-peak/Peak.
- **CostGoat** — clean per-model card grid → model cards showing all 3 price dims at a glance.

## 4. Feature list (ranked by value)
1. **Hero status:** OFF-PEAK / PEAK now, in user's local tz, with live countdown to next flip (proven killer feature).
2. **All 3 models** (flash, pro, vision) × 3 price dims (cache-hit, cache-miss, output), auto-switched to the current rate.
3. **Window table** in local tz, with weekend all-day-off-peak explicitly called out.
4. **Concurrency limits** per model (2500/500/2500) — small, cheap, differentiated.
5. **Cache-hit explainer** micro-copy ("reuse prompts → ~98% cheaper").
6. **Timezone toggle** (local / UTC) for the table.

## YAGNI — deliberately OUT
- No token-usage cost *estimator* / input forms (CostGoat's lane; scope creep).
- No affiliate/referral links (clutter, erodes trust).
- No historical price charts, no login/account, no backend — static page + client clock only.
- No dark/light toggle, no i18n beyond EN, no rival model comparison.
