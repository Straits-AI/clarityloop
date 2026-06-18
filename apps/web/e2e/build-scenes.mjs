// Builds video/public/scenes.json from the voiceover manifest + recordings,
// and stages clips/audio into the Remotion public dir.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FPS = 30;
const E2E = "e2e";
const AUDIO_DIR = process.env.AUDIO_DIR || "audio"; // "audio_placeholder" for the smoke test
const PUB = "e2e/video/public";
mkdirSync(join(PUB, "recordings"), { recursive: true });
mkdirSync(join(PUB, "audio"), { recursive: true });

const manifest = JSON.parse(readFileSync(join(E2E, AUDIO_DIR, "manifest.json"), "utf8"));
const dur = Object.fromEntries(manifest.map((m) => [m.id, m]));

// scene order follows the page (top→bottom); clip → narration-id mapping
const ORDER = [
  { clip: "c1_thesis", audioId: "s1_thesis", index: "00", label: "The Problem", clipStartSec: 0.9 },
  { clip: "c2_loop", audioId: "s2_loop", index: "01", label: "Live Commit Loop", clipStartSec: 3.0 },
  { clip: "c3_promotion", audioId: "s4_promotion", index: "02", label: "Improvement & Promotion", clipStartSec: 5.0 },
  { clip: "c4_bench", audioId: "s3_bench", index: "03", label: "ClarityLoopBench", clipStartSec: 6.5 },
  { clip: "c5_compose", audioId: "s5_compose", index: "04", label: "Composes with HarnessX", clipStartSec: 7.5 },
];

const TAIL = 0.55; // seconds of breathing room after the voice ends

function splitCaptions(text, frames) {
  const parts = text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
  const totalChars = parts.reduce((a, p) => a + p.length, 0);
  let f = 0;
  return parts.map((p) => {
    const share = Math.max(24, Math.round((p.length / totalChars) * (frames - 6)));
    const cap = { text: p, fromFrame: f, durFrames: share };
    f += share;
    return cap;
  });
}

const items = ORDER.map((o) => {
  const a = dur[o.audioId];
  if (!a) throw new Error(`missing audio for ${o.audioId}`);
  const clipFile = `${o.clip}.webm`;
  if (!existsSync(join(E2E, "recordings", clipFile))) throw new Error(`missing recording ${clipFile}`);
  copyFileSync(join(E2E, "recordings", clipFile), join(PUB, "recordings", clipFile));
  copyFileSync(join(E2E, AUDIO_DIR, a.file), join(PUB, "audio", a.file));
  const durationFrames = Math.round((a.duration + TAIL) * FPS);
  return {
    id: o.clip, index: o.index, label: o.label,
    clip: `recordings/${clipFile}`, audio: `audio/${a.file}`,
    clipStartFrame: Math.round(o.clipStartSec * FPS),
    durationFrames,
    captions: splitCaptions(a.text, durationFrames),
  };
});

const scenes = { fps: FPS, introFrames: 72, outroFrames: 96, items };
writeFileSync(join(PUB, "scenes.json"), JSON.stringify(scenes, null, 2));
const totalSec = ((scenes.introFrames + scenes.outroFrames + items.reduce((a, i) => a + i.durationFrames, 0)) / FPS);
console.log(`scenes.json written · ${items.length} scenes · total ${totalSec.toFixed(1)}s (${Math.floor(totalSec/60)}:${String(Math.round(totalSec%60)).padStart(2,"0")})`);
items.forEach((i) => console.log(`  ${i.index} ${i.label.padEnd(26)} ${(i.durationFrames/FPS).toFixed(1)}s · ${i.captions.length} captions`));
