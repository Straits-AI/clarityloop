// Dependency-free SVG figure generator for the ClarityLoop paper.
// Run: node research/paper/figures/gen_figures.mjs   (writes *.svg alongside)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const DIR = dirname(fileURLToPath(import.meta.url));

const C = { ink: "#1a1a2e", grid: "#d9d9e3", a: "#3b6fd4", b: "#d4493b", c: "#2e9e6b", d: "#8a8a99", bg: "#ffffff" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function frame(w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica,Arial,sans-serif">
<rect width="${w}" height="${h}" fill="${C.bg}"/>
<text x="${w / 2}" y="26" text-anchor="middle" font-size="16" font-weight="700" fill="${C.ink}">${esc(title)}</text>
${body}
</svg>`;
}
// grouped/single bars helper: data = [{label, bars:[{v,color,tag}]}], yMax in %
function barChart({ w = 640, h = 380, title, data, yMax = 100, yLabel = "%", note = "" }) {
  const padL = 54, padR = 18, padT = 44, padB = 64;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const y = (v) => padT + plotH - (v / yMax) * plotH;
  let g = "";
  for (let t = 0; t <= yMax; t += yMax / 5) {
    const yy = y(t);
    g += `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="${C.grid}"/><text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="${C.d}">${Math.round(t)}</text>`;
  }
  const groupW = plotW / data.length;
  data.forEach((grp, i) => {
    const n = grp.bars.length, bw = Math.min(54, (groupW * 0.7) / n), x0 = padL + i * groupW + (groupW - bw * n) / 2;
    grp.bars.forEach((b, j) => {
      const x = x0 + j * bw, yy = y(b.v), hh = padT + plotH - yy;
      g += `<rect x="${x}" y="${yy}" width="${bw - 4}" height="${hh}" fill="${b.color}" rx="2"/>`;
      g += `<text x="${x + (bw - 4) / 2}" y="${yy - 5}" text-anchor="middle" font-size="11" font-weight="600" fill="${C.ink}">${b.v}${b.tag || ""}</text>`;
    });
    g += `<text x="${padL + i * groupW + groupW / 2}" y="${h - padB + 18}" text-anchor="middle" font-size="11" fill="${C.ink}">${esc(grp.label)}</text>`;
  });
  g += `<text x="14" y="${padT + plotH / 2}" transform="rotate(-90 14 ${padT + plotH / 2})" text-anchor="middle" font-size="11" fill="${C.d}">${esc(yLabel)}</text>`;
  if (note) g += `<text x="${w / 2}" y="${h - 8}" text-anchor="middle" font-size="10" fill="${C.d}">${esc(note)}</text>`;
  return frame(w, h, title, g);
}
function lineChart({ w = 640, h = 360, title, xs, series, yMax = 100, xLabel, note = "" }) {
  const padL = 54, padR = 110, padT = 44, padB = 56;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const x = (i) => padL + (i / (xs.length - 1)) * plotW, y = (v) => padT + plotH - (v / yMax) * plotH;
  let g = "";
  for (let t = 0; t <= yMax; t += yMax / 5) { const yy = y(t); g += `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="${C.grid}"/><text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="${C.d}">${Math.round(t)}</text>`; }
  xs.forEach((xv, i) => { g += `<text x="${x(i)}" y="${h - padB + 18}" text-anchor="middle" font-size="11" fill="${C.ink}">${esc(xv)}</text>`; });
  series.forEach((s, si) => {
    const pts = s.vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5"/>`;
    s.vals.forEach((v, i) => { g += `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${s.color}"/>`; });
    g += `<text x="${w - padR + 10}" y="${padT + 14 + si * 18}" font-size="11" fill="${s.color}" font-weight="600">${esc(s.name)}</text><line x1="${w - padR + 0}" y1="${padT + 10 + si * 18}" x2="${w - padR + 8}" y2="${padT + 10 + si * 18}" stroke="${s.color}" stroke-width="3"/>`;
  });
  g += `<text x="${padL + plotW / 2}" y="${h - 12}" text-anchor="middle" font-size="11" fill="${C.d}">${esc(xLabel)}</text>`;
  if (note) g += `<text x="${w / 2}" y="14" text-anchor="middle" font-size="10" fill="${C.d}">${esc(note)}</text>`;
  return frame(w, h, title, g);
}

// ── Fig 1: baseline comparison (completion vs false-commit) ───────────────────
writeFileSync(join(DIR, "fig1-baselines.svg"), barChart({
  title: "Fig 1.  ClarityLoopBench: completion vs false-commit (36 cases)",
  yLabel: "rate (%)",
  note: "blue = task completion (higher better) · red = false-commit (lower better) · one uniform scorer for all baselines",
  data: [
    { label: "bare_qwen", bars: [{ v: 100, color: C.a }, { v: 92, color: C.b }] },
    { label: "dynamic_qwen", bars: [{ v: 100, color: C.a }, { v: 56, color: C.b }] },
    { label: "harness_evol.", bars: [{ v: 100, color: C.a }, { v: 36, color: C.b }] },
    { label: "fixed_gate", bars: [{ v: 31, color: C.a }, { v: 0, color: C.b }] },
    { label: "clarityloop", bars: [{ v: 86, color: C.a }, { v: 0, color: C.b }] },
  ],
}));

// ── Fig 2: threshold invariance (the robust negative result) ──────────────────
writeFileSync(join(DIR, "fig2-threshold-invariance.svg"), lineChart({
  title: "Fig 2.  Entropy threshold is inert on realistic load",
  xs: ["0.10", "0.20", "0.30", "0.50", "0.90"],
  xLabel: "commit-entropy threshold τ",
  note: "ClarityLoop on the 36-case bench — both curves are flat: the named uncertainty knob changes nothing (003).",
  series: [
    { name: "completion", color: C.a, vals: [86, 86, 86, 86, 86] },
    { name: "false-commit", color: C.b, vals: [0, 0, 0, 0, 0] },
  ],
}));

// ── Fig 3: emission-robustness curve (the non-circular spine) ─────────────────
writeFileSync(join(DIR, "fig3-emission-robustness.svg"), lineChart({
  title: "Fig 3.  Release-control robustness vs emission infidelity",
  xs: ["0", "0.10", "0.25", "0.50", "0.75", "1.0"],
  xLabel: "per-signal emission infidelity  p",
  yMax: 40,
  note: "18 unsafe cases, 2000 trials/point (n=36k), Wilson 95% CIs tight (<1pt). Graceful linear decay; extract channel steeper.",
  series: [
    { name: "extract-channel", color: C.b, vals: [0, 2.4, 6.9, 15.8, 26.0, 38.9] },
    { name: "emit-channel", color: C.a, vals: [0, 2.2, 5.7, 11.4, 16.7, 22.2] },
  ],
}));

// ── Fig 4: held-out calibration (entropy rehabilitated, non-circular) ─────────
writeFileSync(join(DIR, "fig4-heldout-calibration.svg"), barChart({
  title: "Fig 4.  Diffuse regime, held-out: calibrated weighting generalizes",
  yLabel: "held-out accuracy (%)",
  note: "120-case diffuse corpus, materiality GT independent of weights; τ tuned on calib half, scored on held-out test.",
  data: [
    { label: "entropy-OFF", bars: [{ v: 28.3, color: C.d }] },
    { label: "naive count", bars: [{ v: 78.3, color: C.a }] },
    { label: "calibrated weighted", bars: [{ v: 98.3, color: C.c }] },
  ],
}));

console.log("wrote fig1-baselines.svg, fig2-threshold-invariance.svg, fig3-emission-trust-boundary.svg, fig4-heldout-calibration.svg");
