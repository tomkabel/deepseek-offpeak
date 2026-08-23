"use strict";
// WCAG contrast audit for the actual OKLCH token pairs in styles.css.
// OKLCH -> OKLab -> linear sRGB -> relative luminance -> ratio.
function oklchToLinearRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  };
}
const lum = (rgb) => {
  const c = [rgb.r, rgb.g, rgb.b].map((v) => {
    const l = Math.min(1, Math.max(0, v));
    return l <= 0.04045 ? l / 12.92 : ((l + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (fg, bg) => {
  const l1 = lum(fg), l2 = lum(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};
const hexOf = (rgb) => {
  const to = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
  return "#" + to(rgb.r) + to(rgb.g) + to(rgb.b);
};

const T = {
  canvas:  oklchToLinearRgb(0.12, 0.015, 240),
  surface1:oklchToLinearRgb(0.16, 0.015, 240),
  surface2:oklchToLinearRgb(0.20, 0.015, 240),
  text1:   oklchToLinearRgb(0.98, 0.005, 240),
  text2:   oklchToLinearRgb(0.78, 0.02, 240),
  muted:   oklchToLinearRgb(0.775, 0.025, 240),
  em:      oklchToLinearRgb(0.78, 0.18, 155),
  emB:     oklchToLinearRgb(0.90, 0.12, 160),
  am:      oklchToLinearRgb(0.75, 0.16, 55),
  amB:     oklchToLinearRgb(0.90, 0.09, 85),
  darkTxt: { r: 4/255, g: 19/255, b: 12/255 }, // #04130c
};
const pairs = [
  ["text-primary on canvas",      T.text1, T.canvas],
  ["text-secondary on canvas",    T.text2, T.canvas],
  ["text-muted on canvas",        T.muted, T.canvas],
  ["text-secondary on surface-1", T.text2, T.surface1],
  ["text-muted on surface-1",     T.muted, T.surface1],
  ["text-secondary on surface-2", T.text2, T.surface2],
  ["text-muted on surface-2",     T.muted, T.surface2],
  ["emerald-active on canvas",    T.em, T.canvas],
  ["emerald-active on surface-1", T.em, T.surface1],
  ["amber-peak on canvas",        T.am, T.canvas],
  ["amber-peak on surface-1",     T.am, T.surface1],
  ["emerald-bright on canvas",    T.emB, T.canvas],
  ["amber-bright on canvas",      T.amB, T.canvas],
  ["gradient text (0.84 mid) on canvas", oklchToLinearRgb(0.84, 0.15, 157), T.canvas],
  ["gradient text (0.84 mid) on surface-1", oklchToLinearRgb(0.84, 0.15, 157), T.surface1],
  ["#04130c on emerald gradient", T.darkTxt, T.em],
  ["#04130c on emerald-bright",   T.darkTxt, T.emB],
];
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg);
  const pass = r >= 4.5 ? "AA " : r >= 3 ? "AAA-ish? no" : "FAIL";
  console.log((r >= 4.5 ? "PASS " : "FAIL ") + r.toFixed(2).padStart(5) + "  " + name.padEnd(38) + " fg=" + hexOf(fg) + " bg=" + hexOf(bg));
}
