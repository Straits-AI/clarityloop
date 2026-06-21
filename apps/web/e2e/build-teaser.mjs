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

// THREAT-FIRST. Cold-open on the danger (capability-only SHIPS a fraudulent quote), then the one
// switch (ClarityLoop ESCALATES), the hero line, multimodal Qwen-VL, the everyday loop, the 36%->0%
// wall, harness-independence, the 5-model Qwen router, and the close. All footage is the live dashboard
// driving real Qwen on the deployed Alibaba FC. STEADY frames (sf == st => no zoom drift); the motion is
// the live footage itself. clipStart (css) is a MINIMUM — consecutive same-clip beats auto-chain forward
// (never rewind). cf_switch (46.9s) holds BOTH outcomes: gate-off stream ~12s, red SHIP verdict ~22s,
// flip ~30s, amber ESCALATE verdict ~42s.
const BEATS = [
  { bg: false, a: "agent", callout: { kind: "phrase", text: "It ships in *seconds*.", color: HI, shape: "underline" } },
  { clip: "cf_switch", css: 7, a: "wrong", sf: 1.16, st: 1.16, ox: 48, oy: 30, dim: 0.1, annotation: { step: "01", text: "Capability-only agent · same Qwen" } },
  { clip: "cf_switch", css: 21, a: "shipped", sf: 1.3, st: 1.3, ox: 70, oy: 30, dim: 0.1, annotation: { step: "02", text: "Shipped — no release control" } },
  { clip: "cf_switch", css: 27, a: "change", sf: 1.16, st: 1.16, ox: 50, oy: 30, dim: 0.12, annotation: { step: "03", text: "Same request · ClarityLoop on" } },
  { clip: "cf_switch", css: 42, a: "escalates", sf: 1.32, st: 1.32, ox: 70, oy: 28, dim: 0.1, annotation: { step: "04", text: "ClarityLoop escalates · nothing ships" } },
  { bg: false, a: "proposes", callout: { kind: "phrase", text: "The model proposes. Code *decides*.", color: HI, shape: "underline" } },
  { clip: "mm_parse", css: 7, a: "image", sf: 1.12, st: 1.12, ox: 50, oy: 33, dim: 0.1, annotation: { step: "05", text: "Qwen-VL reads the price sheet" } },
  { clip: "live_commit", css: 30, a: "clean", sf: 1.3, st: 1.3, ox: 50, oy: 42, dim: 0.1, annotation: { step: "06", text: "Clean order · commits on its own" } },
  { clip: "live_escalate", css: 31, a: "ambiguous", sf: 1.3, st: 1.3, ox: 50, oy: 42, dim: 0.1, annotation: { step: "07", text: "Ambiguous · asks, not guesses" } },
  { clip: "c4_bench", css: 7, a: "third", sf: 1.06, st: 1.06, ox: 50, oy: 30, dim: 0.52, callout: { kind: "dual", a: "36%", aSub: "capability-only", b: "0%", bSub: "clarityloop" } },
  { clip: "c5_compose", css: 9, a: "swap", sf: 1.08, st: 1.08, ox: 50, oy: 50, dim: 0.5, callout: { kind: "phrase", text: "Swap the model. The *gate* holds.", color: HI, shape: "underline" } },
  { clip: "qwen_router", css: 1, a: "function", sf: 1.18, st: 1.18, ox: 50, oy: 14, dim: 0.1, annotation: { step: "●", text: "Qwen flash · plus · max · VL — routed per task" } },
  { clip: "usage", css: 1.8, a: "job", sf: 1.4, st: 1.4, ox: 60, oy: 28, dim: 0.2, annotation: { step: "●", text: "Let the agent do the job" } },
];

// fill any null cue by linear interpolation between known neighbours
const order = ["agent", "wrong", "shipped", "change", "escalates", "proposes", "image", "clean", "ambiguous", "third", "swap", "function", "job"];
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
[...new Set(BEATS.map((b) => b.clip).filter(Boolean))].forEach((c) => stage("recordings", `${c}.webm`));

// each beat starts at its anchor minus a small lead (anticipation); duration runs to the next start
const starts = BEATS.map((bt) => Math.max(0, cues[bt.a] - (bt.lead ?? 0.15)));
// AUTO-CHAIN: within a run of consecutive same-clip beats, a beat's clipStart is the MAX of its
// declared css and where the previous same-clip beat finished playing — so the footage only ever
// advances (never rewinds => no "repeating artifact"), playing continuously when css would lag and
// jumping forward when css is ahead. Resets whenever the clip changes (incl. through hook cards).
const CLIP_LEN = { cf_switch: 46.88, mm_parse: 13.52, qwen_router: 9.72, live_commit: 35.88, live_escalate: 38.68, c4_bench: null, c5_compose: null, usage: null };
let prevClip = null, prevEnd = 0;
const shots = BEATS.map((bt, i) => {
  const start = starts[i];
  const end = i < BEATS.length - 1 ? starts[i + 1] : cues._duration;
  const from = INTRO + Math.round(start * FPS);
  const dur = Math.max(22, Math.round((end - start) * FPS));
  const base = { from, dur, label: bt.label, callout: bt.callout, highlight: bt.highlight, annotation: bt.annotation };
  if (bt.bg === false) { prevClip = null; return { ...base, clip: null }; }
  const csf = bt.clip === prevClip ? Math.max(Math.round(bt.css * FPS), prevEnd) : Math.round(bt.css * FPS);
  const len = CLIP_LEN[bt.clip];
  if (len && (csf + dur) / FPS > len + 0.4)
    console.warn(`  ⚠ beat ${i + 1} (${bt.clip}) plays to ${((csf + dur) / FPS).toFixed(1)}s past clip end ${len}s — will freeze`);
  prevClip = bt.clip; prevEnd = csf + dur;
  return {
    ...base, clip: `recordings/${bt.clip}.webm`, clipStartFrame: csf,
    scaleFrom: bt.sf, scaleTo: bt.st, originX: bt.ox, originY: bt.oy, dim: bt.dim, blur: bt.blur,
  };
});

const tHar = VO_DUR;
const outroFrames = 78;
const teaser = { fps: FPS, introFrames: INTRO, outroFrames, vo: "audio_teaser/teaser.wav", shots };
writeFileSync(join(PUB, "teaser.json"), JSON.stringify(teaser, null, 2));

const totalF = shots[shots.length - 1].from + shots[shots.length - 1].dur + outroFrames;
console.log(`teaser.json · ${shots.length} shots · VO ${VO_DUR}s · total ${(totalF / FPS).toFixed(1)}s (${Math.floor(totalF / FPS / 60)}:${String(Math.round((totalF / FPS) % 60)).padStart(2, "0")})`);
shots.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)} ${(BEATS[i].clip ?? "(hook card)").padEnd(13)} ${(s.dur / FPS).toFixed(1)}s  ${BEATS[i].callout ? (BEATS[i].callout.text || BEATS[i].callout.big) : (BEATS[i].label || "")}`));
