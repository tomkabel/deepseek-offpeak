"use strict";

/* ============================================================
 * DeepSeek peak/off-peak schedule — pure logic (timezone-correct).
 * Peak (weekdays, UTC): 01:00–04:00 and 06:00–10:00. All else off-peak.
 * Weekends (Beijing time = UTC+8): off-peak all day.
 * Ref: https://api-docs.deepseek.com/quick_start/pricing/
 * ============================================================ */

const HOUR_MS = 3600 * 1000;
const BJS_OFFSET = 8 * HOUR_MS; // Beijing has no DST

function isBeijingWeekend(ms) {
  const bj = new Date(ms + BJS_OFFSET);
  const d = bj.getUTCDay(); // 0=Sun … 6=Sat
  return d === 0 || d === 6;
}

function isPeak(ms) {
  if (isBeijingWeekend(ms)) return false; // off-peak all weekend
  const h = new Date(ms).getUTCHours();
  return (h >= 1 && h < 4) || (h >= 6 && h < 10);
}

// Next instant the status flips, and what it flips to.
// ponytail: scan ≤8 days of the 4 flip-hours (01/04/06/10 UTC) and skip
// weekends; O(32) and provably correct — swap for closed-form day math only
// if this ever shows up in a hot loop.
function nextTransition(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear(), mo = d.getUTCMonth(), da = d.getUTCDate();
  for (let step = 0; step < 8; step++) {
    for (const hh of [1, 4, 6, 10]) {
      const t = Date.UTC(y, mo, da + step, hh);
      if (t > ms && !isBeijingWeekend(t)) {
        return { time: t, to: isPeak(t) ? "peak" : "off" };
      }
    }
  }
  throw new Error("unreachable: no transition found");
}

/* ============================================================
 * Rates (per 1M tokens, off-peak). Peak = 2×. Single source of truth.
 * ============================================================ */

const PEAK_FACTOR = 2;

const MODELS = [
  { id: "flash",  name: "DeepSeek V4 Flash",       version: "V4-Flash-0731",        concurrency: "2,500", hit: 0.007, miss: 0.22, out: 0.66 },
  { id: "pro",    name: "DeepSeek V4 Pro",         version: "V4-Pro-0813",          concurrency: "500",   hit: 0.022, miss: 0.66, out: 1.98 },
  { id: "vision", name: "DeepSeek V4 Flash Vision", version: "V4-Flash-Vision-Exp", concurrency: "2,500", hit: 0.007, miss: 0.22, out: 0.66 },
];

function usd(x) {
  if (!isFinite(x)) return "—";
  if (x === 0) return "$0";
  const abs = Math.abs(x);
  const fixed = abs >= 1 ? x.toFixed(2) : (abs >= 0.001 ? x.toFixed(4) : x.toFixed(6));
  return "$" + fixed.replace(/\.?0+$/, "");
}

function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return h + "h " + m + "m";
  if (m > 0) return m + "m " + sec + "s";
  return sec + "s";
}

// Expose pure logic for tests (works in Node and browser).
globalThis.DS = { isPeak, isBeijingWeekend, nextTransition, MODELS, PEAK_FACTOR, usd, fmtDuration };

/* ============================================================
 * UI wiring (browser only)
 * ============================================================ */

if (typeof document !== "undefined") {
  const $ = (id) => document.getElementById(id);

  // Rate table — Phase 3 matrix: right-aligned tabular prices, off/peak/delta
  // split, model badges + concurrency column, USD/CNY toggle, preview-aware.
  const rateBody = $("rate-body");
  const ratesSub = $("rates-sub");
  let currency = "usd";
  // Official CNY prices from api-docs.deepseek.com/zh-cn/quick_start/pricing/ (fetched 2026-08-26).
  // DeepSeek bills CNY on the ZH platform; official ¥ beats a USD*FX conversion. Off-peak shown;
  // peak = 2× (same as USD). ¥ is a hard-coded table, not an FX rate — drift only if DeepSeek reprices.
  const CNY_MODELS = {
    flash:  { hit: 0.05, miss: 1.5, out: 4.5 },
    pro:    { hit: 0.15, miss: 4.5, out: 13.5 },
    vision: { hit: 0.05, miss: 1.5, out: 4.5 },
  };
  // Same formatting logic as DS.usd with a swappable prefix — DS.usd stays frozen.
  // Iteration-3 audit: fixed 3 decimals in the matrix so decimals align vertically
  // ($0.007 / $0.220 / $0.660) instead of magnitude-based stripping.
  const rateFmt = (x, cny) => {
    if (!isFinite(x)) return "—";
    if (x === 0) return (cny ? "¥" : "$") + "0";
    return (cny ? "¥" : "$") + x.toFixed(3);
  };
  const fmtConc = (s) => { const n = Number(String(s).replace(/\D/g, "")); return n >= 1000 ? n / 1000 + "k" : String(n); };
  const DELTA = Math.round((1 / DS.PEAK_FACTOR - 1) * 100); // -50 for factor 2
  // Skip rebuilds when nothing changed (1s tick heartbeat; peak flips ~2/day).
  let ratesSig = "";

  function renderRates() {
    const now = preview ?? Date.now();
    const peak = isPeak(now);
    const cny = currency === "cny";
    const sig = (preview === null ? "L" : String(preview)) + "|" + peak + "|" + cny;
    if (sig === ratesSig) return;
    ratesSig = sig;
    const src = cny ? "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/" : "https://api-docs.deepseek.com/quick_start/pricing/";
    ratesSub.textContent = (cny ? "CNY" : "USD") + " per 1M tokens" +
      (preview !== null && peak ? " · showing peak rates (preview at " + hm(new Date(now)) + ")" : "");
    ratesSub.innerHTML += ' — <a href="' + src + '" rel="noopener">source</a>';
    rateBody.innerHTML = "";
    for (const m of MODELS) {
      const cnyR = CNY_MODELS[m.id];
      const priceTds = [["hit", m.hit], ["miss", m.miss], ["out", m.out]].map(([key, off]) => {
        const offV = cny ? cnyR[key] : off;
        const pkV = offV * DS.PEAK_FACTOR;
        const main = peak ? pkV : offV;
        const sub = peak ? offV : pkV;
        // Delta reads relative to the main rate: peak sub is +100% when off-peak
        // is the main, off sub is -50% when peak is the main.
        const subDelta = peak ? DELTA : Math.round((DS.PEAK_FACTOR - 1) * 100);
        return "<td class='num'><span class='rate-main " + (peak ? "pk" : "of") + "'>" + rateFmt(main, cny) + "</span>" +
          "<span class='rate-sub'>" + (peak ? "off " : "peak ") + rateFmt(sub, cny) + " <b class='delta'>" + (subDelta > 0 ? "+" : "") + subDelta + "%</b></span></td>";
      }).join("");
      const tr = document.createElement("tr");
      tr.innerHTML =
        "<td class='model'><span class='m-name'>" + m.name + "</span>" +
        "<span class='m-badges'><span class='pill'>" + m.version + "</span><span class='pill'>" + fmtConc(m.concurrency) + " conc</span></span></td>" +
        priceTds;
      rateBody.appendChild(tr);
    }
  }

  // Model select
  const sel = $("model");
  for (const m of MODELS) {
    const o = document.createElement("option");
    o.value = m.id; o.textContent = m.name;
    sel.appendChild(o);
  }

  // Status capsule — one line: Beijing time + next transition (live) or preview
  const capsule = $("capsule");

  // Scrub ribbon + preview mode. preview = ms of the scrubbed minute, or null = live.
  const ribbon = $("ribbon");
  const scrub = $("scrub");
  const hairline = $("ribbon-hairline");
  const liveBtn = $("live-btn");
  const zones = $("ribbon-zones");
  const bjAxisEls = document.querySelectorAll(".ribbon-axis--beijing .ribbon-tick");
  let preview = null;

  const startOfDay = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const two = (n) => String(n).padStart(2, "0");
  const hm = (d) => two(d.getHours()) + ":" + two(d.getMinutes());

  // Continuous state zones for the shown day: per-hour isPeak, adjacent equal
  // states merged into one band. Keyed on the day so we only rebuild at midnight.
  let zoneKey = "";
  function renderZones(dayStart) {
    const key = new Date(dayStart).toDateString();
    if (key === zoneKey) return;
    zoneKey = key;
    zones.innerHTML = "";
    let run = { state: isPeak(dayStart) ? "peak" : "off", start: 0 };
    for (let h = 1; h <= 24; h++) {
      const st = h === 24 ? null : (isPeak(dayStart + h * HOUR_MS) ? "peak" : "off");
      if (st !== run.state) {
        const el = document.createElement("div");
        el.className = "ribbon-band " + run.state;
        el.style.left = ((run.start / 24) * 100) + "%";
        el.style.width = (((h - run.start) / 24) * 100) + "%";
        zones.appendChild(el);
        run = { state: st, start: h };
      }
    }
  }

  function syncScrubber(now) {
    const mins = (now - startOfDay(now)) / 60000;
    scrub.value = String(Math.floor(mins));
    hairline.style.left = (mins / 1440 * 100) + "%";
    hairline.classList.toggle("peak", isPeak(now));
    ribbon.classList.toggle("previewing", preview !== null);
    liveBtn.hidden = preview === null;
    scrub.setAttribute("aria-valuetext",
      hm(new Date(now)) + ", " + (isPeak(now) ? "peak pricing" : "off-peak pricing"));
  }

  // Live clock + status. `now` = preview ?? Date.now() so scrubbing re-targets
  // the whole hero through this single path (later phases inherit preview free).
  function tick() {
    const now = preview ?? Date.now();
    const peak = isPeak(now);
    const badge = $("status-badge");
    badge.textContent = peak ? "PEAK" : "OFF-PEAK";
    badge.className = "status " + (peak ? "peak" : "off");

    const t = nextTransition(now);
    const dur = fmtDuration(t.time - now);
    const weekend = isBeijingWeekend(now);
    if (preview !== null) {
      capsule.textContent = "At " + hm(new Date(now)) + " — " + (peak ? "PEAK" : "OFF-PEAK") +
        (weekend ? " · off-peak all weekend" : " · " + (peak ? "off-peak at " : "peak at ") + hm(new Date(t.time)));
    } else {
      // Billing time lives in the Beijing clock pill below; the capsule says
      // only what the user actually needs: how long until the window flips.
      capsule.textContent = weekend ? "Off-peak all weekend"
        : (peak ? "Peak ends in " + dur : "Off-peak for the next " + dur);
    }

    const ld = new Date(now);
    $("local-clock").textContent = two(ld.getHours()) + ":" + two(ld.getMinutes()) + ":" + two(ld.getSeconds());
    $("bj-clock").textContent = new Date(now + BJS_OFFSET).toISOString().slice(11, 19);

    const ds = startOfDay(now);
    renderZones(ds);
    syncScrubber(now);
    // Beijing axis labels are viewer-locale dependent (local 00:00 is Beijing
    // 08:00 only for UTC+8 viewers) — compute them from the real offset.
    for (let i = 0; i < bjAxisEls.length; i++) {
      bjAxisEls[i].textContent = two(new Date(ds + i * 6 * HOUR_MS + BJS_OFFSET).getUTCHours());
    }
    renderRates(); // Phase 3: rates matrix follows the same preview ?? Date.now() heartbeat
  }
  tick();
  setInterval(tick, 1000);

  scrub.addEventListener("input", () => {
    preview = startOfDay(Date.now()) + Number(scrub.value) * 60000;
    tick();
  });
  liveBtn.addEventListener("click", () => {
    preview = null;
    tick();
  });

  // Currency toggle — re-renders the matrix in whichever preview state is active.
  for (const r of document.querySelectorAll('input[name="currency"]')) {
    r.addEventListener("change", () => { currency = r.value; renderRates(); });
  }

  // Calculator — Phase 4: SI token inputs + preset chips, cache-hit % slider,
  // token breakdown line, unified emerald result cards, preview-aware prominence.
  const calcIn = $("calc-in"), calcOut = $("calc-out"), cacheRatio = $("cache-ratio");
  const cacheReadout = $("cache-readout"), breakdown = $("calc-breakdown");
  const calcImgs = $("calc-imgs"), imgField = calcImgs?.closest(".field");
  const offLabel = $("r-off-label"), pkLabel = $("r-peak-label"), svLabel = $("r-save-label");
  const svNote = $("r-save-note");
  const VISION_TOKENS_PER_IMAGE = 384; // official: up to 384 tokens/image (api-docs deepseek vision guide)

  // SI token parsing: "1M" / "500k" / "1,000,000" / "1000000" → integer. Bad/empty → 0.
  function parseTokens(s) {
    const t = String(s ?? "").trim().toLowerCase();
    const m = t.match(/^([0-9,]+)([km]?)$/);
    if (!m) return 0;
    const n = Number(m[1].replace(/,/g, ""));
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1));
  }
  function fmtTokens(n) { return Number(n || 0).toLocaleString("en-US"); }

  // Uniform total formatting — iteration-3 audit: all three cards must agree.
  // Rule: < $10 → 4 decimals ($0.7096 / $1.4192), ≥ $10 → 2 decimals ($101.13).
  // Fixed precision per magnitude (no trailing-zero stripping) so $1.42 never
  // appears beside $0.7096. Intl.NumberFormat is stdlib — no new deps.
  const fmtTotal = (x) => {
    if (!isFinite(x)) return "—";
    const d = x > 0 && x < 10 ? 4 : 2;
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  };

  // Exposed for the Node smoke test without touching the frozen DS export.
  // MODEL_API declared here (before DS_UI export) to avoid TDZ — matches CNY_MODELS.
  const MODEL_API = { flash: "deepseek-v4-flash", pro: "deepseek-v4-pro", vision: "deepseek-v4-flash-vision-exp" };
  globalThis.DS_UI = { parseTokens, fmtTokens, fmtTotal, rateFmt, CNY_MODELS, MODEL_API };

  function recalc() {
    const m = MODELS.find((x) => x.id === sel.value) || MODELS[0];
    const inT = parseTokens(calcIn.value);
    const outT = parseTokens(calcOut.value);
    const ratio = Math.min(100, Math.max(0, Number(cacheRatio.value) || 0)) / 100;
    const hit = inT * ratio, miss = inT * (1 - ratio);
    const imgT = m.id === "vision" ? Math.max(0, Math.round(Number(calcImgs.value) || 0)) * VISION_TOKENS_PER_IMAGE : 0;
    // Critique spec: inputCost = inT·ratio·hitRate + inT·(1−ratio)·missRate + imgT·missRate, outputCost = outT·outRate
    const off = (hit * m.hit + (miss + imgT) * m.miss + outT * m.out) / 1e6;
    const peak = off * PEAK_FACTOR;

    cacheReadout.textContent = Math.round(ratio * 100) + "%";
    const inputCost = (hit * m.hit + (miss + imgT) * m.miss) / 1e6;
    const outputCost = (outT * m.out) / 1e6;
    breakdown.textContent = fmtTokens(hit) + " @ " + usd(m.hit) + " (hit) · " +
      fmtTokens(miss) + " @ " + usd(m.miss) + " (miss) · " +
      fmtTokens(outT) + " @ " + usd(m.out) + " (out) = " + fmtTotal(inputCost + outputCost);

    // Preview-aware prominence: card 1 is always the active-window total. When
    // the playhead sits in a peak window, card 1 flips to PEAK and the save
    // card becomes "Save by waiting". Live mode stays off-peak-first.
    const activePeak = preview !== null && isPeak(preview);
    const rOff = $("r-off"), rPeak = $("r-peak"), rSave = $("r-save");
    rOff.textContent = fmtTotal(activePeak ? peak : off);
    rPeak.textContent = fmtTotal(activePeak ? off : peak);
    offLabel.textContent = (activePeak ? "Peak" : "Off-peak") + (preview !== null ? " · preview" : "");
    pkLabel.textContent = activePeak ? "Off-peak" : "Peak";
    rOff.className = "r-val " + (activePeak ? "pk" : "off"); // prominent: amber when peak is active, emerald otherwise
    rPeak.className = "r-val dim";  // secondary: muted
    const save = peak - off;
    const savePct = Math.round((save / peak) * 100) + "%";
    if (activePeak) {
      svLabel.textContent = "Save by waiting";
      rSave.textContent = fmtTotal(save) + " · " + savePct + " off";
      svNote.textContent = "Queue off-peak to save " + fmtTotal(save);
    } else {
      svLabel.textContent = "You save";
      rSave.textContent = fmtTotal(save) + " · " + savePct + " off";
      svNote.textContent = "";
    }
  }

  // Preset chips fill + recalc (type="button", never a form submit).
  for (const chip of document.querySelectorAll(".chip")) {
    chip.addEventListener("click", () => {
      const el = $(chip.dataset.target);
      el.value = fmtTokens(Number(chip.dataset.tokens));
      el.blur();  // Trigger blur listener for immediate normalization.
    });
  }
  // Blur normalizes the raw SI value into grouped digits.
  for (const el of [calcIn, calcOut]) {
    el.addEventListener("blur", () => { el.value = fmtTokens(parseTokens(el.value)); recalc(); });
  }
  document.getElementById("calc-form").addEventListener("input", recalc);
  // Direct listener on cache-ratio ensures reliable updates; form bubbling unreliable for range inputs.
  cacheRatio.addEventListener("input", () => {
    const pct = Math.round(Number(cacheRatio.value)) + "%";
    cacheRatio.setAttribute("aria-valuetext", pct + " cache hit ratio");
    recalc();
  });
  // Vision shows the image-count field; other models hide it.
  sel.addEventListener("change", () => {
    if (imgField) imgField.hidden = sel.value !== "vision";
    // Reset image count when switching from vision to other models.
    if (sel.value !== "vision") {
      calcImgs.value = "0";
    }
    recalc();
  });
  // Follow the playhead: scrub sets `preview` (Phase 2) then recalc re-prominences;
  // LIVE resets prominence. Only listeners — Phase 2 functions untouched.
  scrub.addEventListener("input", recalc);
  liveBtn.addEventListener("click", recalc);
  recalc();

  /* ============================================================
   * Phase 5 — dev actionability: cron / SDK export drawer.
   * Fills #export-slot only; reads the live #model select; no new
   * state that collides with `preview` or the calculator.
   * ============================================================ */
  // Local model-id map (UI-only; MODELS stays frozen as the rate source).
  // Official API ids — vision exp suffix matters (400 without it).
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Next instant that FLIPS INTO off-peak. nextTransition can report
  // peak->peak flips (01:00->06:00 UTC), so loop until .to === "off".
  // ponytail: bounded 3-iteration loop; the schedule needs at most 2.
  function nextOffPeakStart(ms) {
    let t = ms;
    for (let i = 0; i < 3; i++) {
      const n = DS.nextTransition(t);
      if (n.to === "off") return n.time;
      t = n.time;
    }
    throw new Error("unreachable: no off-peak transition");
  }

  const fmtBj = (ms) => {
    const d = new Date(ms + BJS_OFFSET); // Beijing = UTC+8, no DST
    return DAYS[d.getUTCDay()] + " " + d.toISOString().slice(0, 10) + " " + d.toISOString().slice(11, 16) + " CST";
  };
  const fmtUtc = (ms) => new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const activeModel = () => {
    const m = MODELS.find((x) => x.id === sel.value) || MODELS[0];
    return { id: MODEL_API[m.id] || m.id, name: m.name };
  };

  // Plain-ASCII snippets, 4-space indent. Peak CST (Mon-Fri) 09-12 & 14-18,
  // off-peak otherwise; weekends off-peak all day. 00:00 CST sits inside the
  // overnight off-peak window (18:00-09:00 CST), so Mon-Fri midnight is the
  // safe dispatch slot.
  const buildCron = () =>
    "# DeepSeek off-peak dispatch - run jobs at 50% off-peak pricing\n" +
    "# Peak CST (Mon-Fri): 09-12 & 14-18. Off-peak otherwise.\n" +
    "# Weekends are off-peak all day, so no cron entry is needed.\n" +
    "# Mon-Fri 00:00 Beijing time - inside the overnight off-peak window.\n" +
    "TZ=Asia/Shanghai\n" +
    "0 0 * * 1-5\n";

  const buildPy = () => {
    const m = activeModel();
    return [
      "import os, time",
      "from openai import OpenAI",
      "",
      "# DeepSeek API - off-peak billing is 50% cheaper. Peak CST (Mon-Fri)",
      "# 09-12 & 14-18; off-peak otherwise; weekends off-peak all day.",
      "client = OpenAI(api_key=os.environ[\"DEEPSEEK_API_KEY\"],",
      "                base_url=\"https://api.deepseek.com\")",
      "MODEL = \"" + m.id + "\"  # " + m.name,
      "",
      "def is_weekend(ms):",
      "    bj_day = (ms + 8 * 3600000) // 86400000",
      "    return (bj_day + 4) % 7 in (0, 6)",
      "",
      "def is_peak(ms):",
      "    if is_weekend(ms):",
      "        return False",
      "    h = (ms // 3600000) % 24",
      "    return 1 <= h < 4 or 6 <= h < 10",
      "",
      "def ms_until_off_peak(now_ms):",
      "    day = now_ms - now_ms % 86400000",
      "    for step in range(8):",
      "        for hh in (1, 4, 6, 10):",
      "            t = day + step * 86400000 + hh * 3600000",
      "            if t > now_ms and not is_weekend(t) and not is_peak(t):",
      "                return t - now_ms",
      "    raise RuntimeError(\"unreachable\")",
      "",
      "def run():",
      "    time.sleep(ms_until_off_peak(time.time() * 1000) / 1000)",
      "    client.chat.completions.create(model=MODEL, messages=[",
      "        {\"role\": \"user\", \"content\": \"off-peak dispatch\"}])",
      "",
      "run()",
    ].join("\n");
  };

  const buildTs = () => {
    const m = activeModel();
    return [
      "import OpenAI from \"openai\";",
      "// DeepSeek API - off-peak billing is 50% cheaper. Peak CST (Mon-Fri)",
      "// 09-12 & 14-18; off-peak otherwise; weekends off-peak all day.",
      "const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY,",
      "                            baseURL: \"https://api.deepseek.com\" });",
      "const MODEL = \"" + m.id + "\"; // " + m.name,
      "const isWeekend = (ms: number) => {",
      "  const bj = Math.floor((ms + 8 * 3600000) / 86400000);",
      "  return (bj + 4) % 7 === 0 || (bj + 4) % 7 === 6;",
      "};",
      "const isPeak = (ms: number) => {",
      "  if (isWeekend(ms)) return false;",
      "  const h = Math.floor(ms / 3600000) % 24;",
      "  return (h >= 1 && h < 4) || (h >= 6 && h < 10);",
      "};",
      "const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));",
      "async function dispatch() {",
      "  const day = Date.now() - (Date.now() % 86400000);",
      "  for (let step = 0; step < 8; step++) {",
      "    for (const hh of [1, 4, 6, 10]) {",
      "      const t = day + step * 86400000 + hh * 3600000;",
      "      if (t > Date.now() && !isWeekend(t) && !isPeak(t)) {",
      "        await sleep(t - Date.now()); // start of next off-peak window",
      "        await client.chat.completions.create({",
      "          model: MODEL,",
      "          messages: [{ role: \"user\", content: \"off-peak dispatch\" }],",
      "        });",
      "        return;",
      "      }",
      "    }",
      "  }",
      "  throw new Error(\"unreachable\");",
      "}",
      "dispatch();",
    ].join("\n");
  };

  const TABS = [
    { key: "cron", btn: $("tab-cron"), panel: $("panel-cron") },
    { key: "py", btn: $("tab-py"), panel: $("panel-py") },
    { key: "ts", btn: $("tab-ts"), panel: $("panel-ts") },
  ];
  const BUILDERS = { cron: buildCron, py: buildPy, ts: buildTs };
  const exportDetails = $("export-drawer");
  const exportNext = $("export-next");
  const copyBtn = $("copy-btn");
  let activeTab = "cron";
  let copyTimer = null;

  function renderExport() {
    if (!exportDetails.open) return; // toggle/change handlers re-render on open
    const now = preview ?? Date.now();
    const t = nextOffPeakStart(now);
    exportNext.textContent = isPeak(now)
      ? "Next off-peak window: " + fmtBj(t) + " (" + fmtUtc(t) + ") · starts in " + DS.fmtDuration(t - now)
      : "Off-peak now · next window starts " + fmtBj(t) + " · in " + DS.fmtDuration(t - now);
    const tab = TABS.find((x) => x.key === activeTab);
    tab.panel.querySelector("code").textContent = BUILDERS[activeTab]();
  }

  function selectTab(key) {
    activeTab = key;
    for (const t of TABS) {
      t.btn.setAttribute("aria-selected", String(t.key === key));
      t.panel.hidden = t.key !== key;
    }
    renderExport();
  }

  function copyFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* noop */ }
    document.body.removeChild(ta);
    copyBtn.focus(); // execCommand stole focus — give it back
  }

  copyBtn.addEventListener("click", () => {
    const tab = TABS.find((x) => x.key === activeTab);
    const text = tab.panel.querySelector("code").textContent;
    const done = () => {
      copyBtn.textContent = "Copied ✓";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { copyBtn.textContent = "Copy snippet"; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => { copyFallback(text); done(); });
    } else {
      copyFallback(text);
      done();
    }
  });

  for (const t of TABS) t.btn.addEventListener("click", () => selectTab(t.key));
  exportDetails.addEventListener("toggle", () => { if (exportDetails.open) renderExport(); });
  sel.addEventListener("change", renderExport); // regenerate on model change
  selectTab("cron"); // initial render + panel visibility

  // Exposed for the Node smoke test (DS_UI already exists from Phase 4).
  globalThis.DS_UI.nextOffPeakStart = nextOffPeakStart;
  globalThis.DS_UI.buildCron = buildCron;
  globalThis.DS_UI.buildPy = buildPy;
  globalThis.DS_UI.buildTs = buildTs;
  globalThis.DS_UI.renderExport = renderExport;
  globalThis.DS_UI.copyActive = () => copyBtn.dispatchEvent(new Event("click"));
  globalThis.DS_UI._exportTimer = setInterval(renderExport, 30000); // keep the "next window" line current
}
