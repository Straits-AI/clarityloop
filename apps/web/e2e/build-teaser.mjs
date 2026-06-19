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

// shot plan: anchor span [a,b] -> clip + Ken-Burns framing + optional callout
const BEATS = [
  { clip: "usage", css: 1.8, a: "agent", b: "ship", sf: 1.06, st: 1.16, ox: 50, oy: 26, dim: 0.4, label: "AGENT-AUTHORED WORKFLOWS" },
  { clip: "usage", css: 1.8, a: "ship", b: "capability", lead: 1.7, sf: 1.18, st: 1.3, ox: 50, oy: 26, dim: 0.74, blur: 7, callout: { kind: "phrase", text: "Should it *ship*?", color: HI, shape: "underline" } },
  { clip: "usage", css: 1.8, a: "capability", b: "governance", sf: 1.1, st: 1.18, ox: 50, oy: 30, dim: 0.74, blur: 7, callout: { kind: "phrase", text: "Capability is *solved*.", color: HI } },
  { clip: "usage", css: 1.8, a: "governance", b: "clarityloop", sf: 1.12, st: 1.22, ox: 50, oy: 30, dim: 0.74, blur: 7, callout: { kind: "phrase", text: "*Governance*", sub: "is the frontier", color: HI, shape: "brackets" } },
  { clip: "c2_loop", css: 12, a: "clarityloop", b: "uncertainty", sf: 1.02, st: 1.1, ox: 50, oy: 34, dim: 0.32, label: "RELEASE CONTROL" },
  { clip: "c2_loop", css: 12, a: "uncertainty", b: "decides", sf: 1.46, st: 1.66, ox: 50, oy: 33, dim: 0.24, label: "UNCERTAINTY  →  RESOLVED" },
  { clip: "c2_loop", css: 12, a: "decides", b: "thirty", sf: 1.66, st: 1.86, ox: 46, oy: 57, dim: 0.6, callout: { kind: "phrase", text: "Commit. Or *escalate*.", color: GO } },
  { clip: "c4_bench", css: 7, a: "thirty", b: "zero", sf: 1.08, st: 1.18, ox: 40, oy: 30, dim: 0.52, callout: { kind: "stat", big: "36%", sub: "unsafe · capability-only", color: STOP, shape: "brackets" } },
  { clip: "c4_bench", css: 7, a: "zero", b: "attacks", sf: 1.12, st: 1.22, ox: 60, oy: 30, dim: 0.52, callout: { kind: "stat", big: "0%", sub: "false-commit · 86% done", color: GO, shape: "ring" } },
  { clip: "c5_compose", css: 9, a: "attacks", b: "replay", sf: 1.08, st: 1.18, ox: 50, oy: 55, dim: 0.52, callout: { kind: "stat", big: "0%", sub: "attack success rate", color: GO, shape: "ring" } },
  { clip: "c3_promotion", css: 5, a: "replay", b: "harnesses", sf: 1.05, st: 1.13, ox: 50, oy: 42, dim: 0.66, blur: 3, callout: { kind: "phrase", text: "Promote only if *safer*.", color: HI } },
];

// fill any null cue by linear interpolation between known neighbours
const order = ["agent", "ship", "capability", "governance", "clarityloop", "uncertainty", "decides", "thirty", "zero", "eighty", "attacks", "replay", "harnesses"];
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
  const end = i < BEATS.length - 1 ? starts[i + 1] : cues[bt.b];
  const from = INTRO + Math.round(start * FPS);
  const dur = Math.max(22, Math.round((end - start) * FPS));
  return {
    from, dur, clip: `recordings/${bt.clip}.webm`, clipStartFrame: Math.round(bt.css * FPS),
    scaleFrom: bt.sf, scaleTo: bt.st, originX: bt.ox, originY: bt.oy,
    label: bt.label, callout: bt.callout, dim: bt.dim, blur: bt.blur,
  };
});

const tHar = cues.harnesses ?? VO_DUR - 4;
const outroFrames = Math.round((VO_DUR - tHar) * FPS) + 24;
const teaser = { fps: FPS, introFrames: INTRO, outroFrames, vo: "audio_teaser/teaser.wav", shots };
writeFileSync(join(PUB, "teaser.json"), JSON.stringify(teaser, null, 2));

const totalF = shots[shots.length - 1].from + shots[shots.length - 1].dur + outroFrames;
console.log(`teaser.json · ${shots.length} shots · VO ${VO_DUR}s · total ${(totalF / FPS).toFixed(1)}s (${Math.floor(totalF / FPS / 60)}:${String(Math.round((totalF / FPS) % 60)).padStart(2, "0")})`);
shots.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)} ${BEATS[i].clip.padEnd(13)} ${(s.dur / FPS).toFixed(1)}s  ${BEATS[i].callout ? (BEATS[i].callout.text || BEATS[i].callout.big) : (BEATS[i].label || "")}`));
