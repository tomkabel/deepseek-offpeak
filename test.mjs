"use strict";
// Self-check for the peak/off-peak schedule + transition logic. Run: node test.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Minimal DOM stub so app.js's browser-only UI block initializes (builders + CNY_MODELS).
const el = () => ({ value: "", textContent: "", innerHTML: "", hidden: true, open: false, style: {}, addEventListener() {}, setAttribute() {}, appendChild() {}, closest() { return null; }, querySelector() { return { textContent: "" }; }, querySelectorAll() { return []; }, classList: { add() {}, remove() {}, toggle() {} }, dataset: {} });
const modelSel = el();
globalThis.document = {
  getElementById: (id) => (id === "model" ? modelSel : el()),
  querySelector: () => el(),
  querySelectorAll: () => [],
  createElement: () => el(),
  addEventListener() {},
};
require("./app.js");

const DS = globalThis.DS;
let fails = 0;
function eq(actual, expected, label) {
  const ok = Object.is(actual, expected);
  if (!ok) { fails++; console.error("FAIL " + label + ": got " + actual + ", want " + expected); }
  return ok;
}

// 2026-08-26 = Wednesday (verified). Weekday peak windows 01–04 & 06–10 UTC.
const W = (h, m = 0) => Date.UTC(2026, 7, 26, h, m);       // Wed
const SAT = (h, m = 0) => Date.UTC(2026, 7, 22, h, m);     // Sat
const SUN = (h, m = 0) => Date.UTC(2026, 7, 23, h, m);     // Sun
const FRI = (h, m = 0) => Date.UTC(2026, 7, 21, h, m);     // Fri
const MON = Date.UTC(2026, 7, 24, 1);                      // Mon 01:00 UTC

// isPeak (weekday)
eq(DS.isPeak(W(2, 30)), true, "Wed 02:30 peak");
eq(DS.isPeak(W(7, 0)), true, "Wed 07:00 peak");
eq(DS.isPeak(W(0, 30)), false, "Wed 00:30 off");
eq(DS.isPeak(W(5, 0)), false, "Wed 05:00 off");
eq(DS.isPeak(W(12, 0)), false, "Wed 12:00 off");
// boundaries
eq(DS.isPeak(W(1, 0)), true, "01:00 peak");
eq(DS.isPeak(W(4, 0)), false, "04:00 off");
eq(DS.isPeak(W(6, 0)), true, "06:00 peak");
eq(DS.isPeak(W(10, 0)), false, "10:00 off");

// weekend override
eq(DS.isPeak(SAT(2, 0)), false, "Sat 02:00 off (weekend override)");
eq(DS.isPeak(SUN(8, 0)), false, "Sun 08:00 off (weekend override)");
eq(DS.isPeak(FRI(18, 0)), false, "Fri 18:00 UTC = Sat Beijing → off");

// nextTransition — weekday
eq(DS.nextTransition(W(2, 30)).time, Date.UTC(2026, 7, 26, 4), "Wed 02:30 → 04:00");
eq(DS.nextTransition(W(2, 30)).to, "off", "…to off");
eq(DS.nextTransition(W(7, 0)).time, Date.UTC(2026, 7, 26, 10), "Wed 07:00 → 10:00");
eq(DS.nextTransition(W(0, 30)).time, Date.UTC(2026, 7, 26, 1), "Wed 00:30 → 01:00");
eq(DS.nextTransition(W(5, 0)).time, Date.UTC(2026, 7, 26, 6), "Wed 05:00 → 06:00");
eq(DS.nextTransition(W(12, 0)).time, Date.UTC(2026, 7, 27, 1), "Wed 12:00 → Thu 01:00");
eq(DS.nextTransition(W(4, 0)).time, Date.UTC(2026, 7, 26, 6), "Wed 04:00 (off) → 06:00");

// nextTransition — weekend + Friday edge
eq(DS.nextTransition(SAT(12, 0)).time, MON, "Sat → Mon 01:00");
eq(DS.nextTransition(SUN(12, 0)).time, MON, "Sun → Mon 01:00");
eq(DS.nextTransition(FRI(18, 0)).time, MON, "Fri 18:00 (Sat Beijing) → Mon 01:00");
eq(DS.nextTransition(FRI(15, 0)).time, MON, "Fri 15:00 (Fri Beijing) → Mon 01:00 (skips Sat)");

// rates sanity
eq(DS.MODELS.length, 3, "3 models");
eq(DS.MODELS[1].hit, 0.022, "pro cache-hit off-peak");
eq(DS.MODELS[1].out * DS.PEAK_FACTOR, 3.96, "pro output peak = 2x");

// CNY official table (ZH pricing page, fetched 2026-08-26): flash hit ¥0.05, miss ¥1.5, out ¥4.5
const CNY = DS_UI.CNY_MODELS;
eq(CNY.flash.hit, 0.05, "cny flash hit");
eq(CNY.pro.miss, 4.5, "cny pro miss");
eq(CNY.vision.out, 4.5, "cny vision out");
// official implied FX ≈ 6.82 (not 7.1)
eq(Math.round((4.5 / 0.66) * 100) / 100, 6.82, "cny implied fx");

// vision model API id + snippet builders emit the official id
eq(DS_UI.MODEL_API.vision, "deepseek-v4-flash-vision-exp", "vision api id");
// builders read the live #model select; select vision before building
const sel = document.getElementById("model");
sel.value = "vision";
const py = DS_UI.buildPy();
eq(py.includes("deepseek-v4-flash-vision-exp"), true, "py snippet vision id");
const ts = DS_UI.buildTs();
eq(ts.includes("deepseek-v4-flash-vision-exp"), true, "ts snippet vision id");

// formatting
eq(DS.usd(0.007), "$0.007", "usd 0.007");
eq(DS.usd(1.98), "$1.98", "usd 1.98");
eq(DS.usd(0), "$0", "usd 0");
eq(DS.fmtDuration(3 * 3600 * 1000 + 12 * 60 * 1000), "3h 12m", "duration");

// calculator parsing/formatting (audit fix: no silent 0 on unparsable input)
eq(DS_UI.parseTokens("50 M"), 50_000_000, "parse '50 M'");
eq(DS_UI.parseTokens("1.5m"), 1_500_000, "parse '1.5m'");
eq(DS_UI.parseTokens("50_000_000"), 50_000_000, "parse underscores");
eq(DS_UI.parseTokens("1,000,000"), 1_000_000, "parse commas");
eq(DS_UI.parseTokens(""), 0, "parse empty → 0");
eq(Number.isNaN(DS_UI.parseTokens("fifty")), true, "parse garbage → NaN");
eq(Number.isNaN(DS_UI.parseTokens("1e6")), true, "parse 1e6 → NaN (flagged, not 0)");
eq(Number.isFinite(DS_UI.parseTokens("9".repeat(400))), false, "parse overflow → non-finite (must be treated invalid)");
eq(DS_UI.fmtTotal(NaN), "—", "fmtTotal NaN → dash (invalid bill blanks cards)");
eq(DS_UI.fmtTotal(0.000691), "$0.000691", "fmtTotal sub-cent keeps 6 decimals");
eq(DS_UI.fmtTotal(0.7735), "$0.7735", "fmtTotal <$10 4 decimals");
eq(DS_UI.fmtTotal(11.66), "$11.66", "fmtTotal ≥$10 2 decimals");

if (fails === 0) {
  console.log("OK — all schedule/rate checks passed (" + (Date.now()) + ")");
  clearInterval(globalThis.DS_UI._exportTimer); // stop the app's 30s render interval so the process can exit
  process.exit(0);
} else {
  console.error(fails + " check(s) FAILED");
  process.exit(1);
}
