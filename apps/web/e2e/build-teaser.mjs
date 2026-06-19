// Builds video/public/teaser.json: maps word-aligned VO cues -> footage shots + kinetic callouts.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FPS = 30, INTRO = 30, E2E = "e2e", PUB = "e2e/video/public";
const HI = "#eef2fb", AMBER = "#f5b13d", GO = "#4ad6a0", STOP = "#ff6f6f";
mkdirSync(join(PUB, "recordings"), { recursive: true });
mkdirSync(join(PUB, "audio"), { recursive: true });
  mkdirSync(join(PUB, "audio_teaser"), { recursive: true });

const cues = JSON.parse(readFileSync(join(PUB, "cues.json"), "utf8"));
const VO_DUR = cues._duration;

// Each step is a distinct CLOSE-UP: punch the camera into the element being used
// (origin = focal point, scale = zoom). Same UI section, but every beat is a new shot.
const BEATS = [
  { clip: "c2_loop", css: 12, a: "agent", b: "walk", sf: 1.04, st: 1.1, ox: 50, oy: 34, dim: 0.5, blur: 2, callout: { kind: "phrase", text: "Is it safe to *ship*?", color: HI, shape: "underline" } },
  { clip: "c2_loop", css: 5, a: "walk", b: "hand", sf: 1.7, st: 1.78, ox: 28, oy: 26, dim: 0.16, annotation: { step: "01", text: "The messy request" } },
  { clip: "c2_loop", css: 5, a: "hand", b: "running", sf: 1.66, st: 1.74, ox: 28, oy: 50, dim: 0.16, annotation: { step: "02", text: "A governed workflow" } },
  { clip: "c2_loop", css: 9, a: "running", b: "residual", sf: 1.62, st: 1.7, ox: 50, oy: 27, dim: 0.14, annotation: { step: "03", text: "Gather the evidence" } },
  { clip: "c2_loop", css: 10, a: "residual", b: "deterministic", sf: 1.95, st: 2.05, ox: 50, oy: 42, dim: 0.12, annotation: { step: "04", text: "Uncertainty drops" } },
  { clip: "c2_loop", css: 13, a: "deterministic", b: "cleared", sf: 1.85, st: 1.95, ox: 50, oy: 56, dim: 0.14, annotation: { step: "05", text: "The gate decides" } },
  { clip: "c2_loop", css: 13, a: "cleared", b: "procedures", sf: 1.6, st: 1.68, ox: 50, oy: 56, dim: 0.16, annotation: { step: "06", text: "Commit — or escalate" } },
  { clip: "c3_promotion", css: 5, a: "procedures", b: "benchmark", sf: 1.5, st: 1.6, ox: 66, oy: 30, dim: 0.16, annotation: { step: "07", text: "Promote only if safer" } },
  { clip: "c4_bench", css: 7, a: "benchmark", b: "attack", sf: 1.05, st: 1.12, ox: 50, oy: 30, dim: 0.52, callout: { kind: "dual", a: "36%", aSub: "capability-only", b: "0%", bSub: "clarityloop" } },
  { clip: "c5_compose", css: 9, a: "attack", b: "live", sf: 1.06, st: 1.14, ox: 50, oy: 55, dim: 0.52, callout: { kind: "stat", big: "0%", sub: "attack success rate", color: GO, shape: "ring" } },
  { clip: "usage", css: 1.8, a: "live", b: "_duration", sf: 1.55, st: 1.65, ox: 70, oy: 4, dim: 0.28, annotation: { step: "●", text: "Live on Alibaba Cloud · Qwen" } },
];

// fill any null cue by linear interpolation between known neighbours
const order = ["agent", "walk", "hand", "running", "residual", "deterministic", "cleared", "procedures", "benchmark", "attack", "live"];
const known = order.filter((k) => cues[k] != null);
if (cues.agent == null) cues.agent = 0.2;
for (let i = 0; i < order.length; i++) {
  const k = order[i];
  if (cues[k] != null) continue;
  const prev = order.slice(0, i).reverse().find((x) => cues[x] != null);
  const next = order.slice(i + 1).find((x) => cues[x] != null);
  const pv = cues[prev] ?? 0, nv = cues[next] ?? VO_DUR;
  cues[k] = +(pv + (nv - pv) * 0.5).toFixed(2);
}

const stage = (rel, file) => { if (!existsSync(join(E2E, rel, file))) throw new Error(`missing ${rel}/${file}`); copyFileSync(join(E2E, rel, file), join(PUB, rel, file)); };
stage("audio_teaser", "teaser.wav");
[...new Set(BEATS.map((b) => b.clip))].forEach((c) => stage("recordings", `${c}.webm`));

// each beat starts at its anchor minus a small lead (anticipation); duration runs to the next start
const starts = BEATS.map((bt) => Math.max(0, cues[bt.a] - (bt.lead ?? 0.15)));
const shots = BEATS.map((bt, i) => {
  const start = starts[i];
  const end = i < BEATS.length - 1 ? starts[i + 1] : cues._duration;
  const from = INTRO + Math.round(start * FPS);
  const dur = Math.max(22, Math.round((end - start) * FPS));
  return {
    from, dur, clip: `recordings/${bt.clip}.webm`, clipStartFrame: Math.round(bt.css * FPS),
    scaleFrom: bt.sf, scaleTo: bt.st, originX: bt.ox, originY: bt.oy,
    label: bt.label, callout: bt.callout, dim: bt.dim, blur: bt.blur, highlight: bt.highlight, annotation: bt.annotation,
  };
});

const tHar = VO_DUR;
const outroFrames = 78;
const teaser = { fps: FPS, introFrames: INTRO, outroFrames, vo: "audio_teaser/teaser.wav", shots };
writeFileSync(join(PUB, "teaser.json"), JSON.stringify(teaser, null, 2));

const totalF = shots[shots.length - 1].from + shots[shots.length - 1].dur + outroFrames;
console.log(`teaser.json · ${shots.length} shots · VO ${VO_DUR}s · total ${(totalF / FPS).toFixed(1)}s (${Math.floor(totalF / FPS / 60)}:${String(Math.round((totalF / FPS) % 60)).padStart(2, "0")})`);
shots.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)} ${BEATS[i].clip.padEnd(13)} ${(s.dur / FPS).toFixed(1)}s  ${BEATS[i].callout ? (BEATS[i].callout.text || BEATS[i].callout.big) : (BEATS[i].label || "")}`));
