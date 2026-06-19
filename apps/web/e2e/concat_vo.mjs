// Trim + loudness-normalize each VO segment, concatenate seamlessly (tiny natural gap),
// and emit video/public/cues.json with each section's start time (keys s01..sNN + _duration).
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIR = "e2e/audio_teaser", PROC = join(DIR, "proc"), GAP = 0.16;
mkdirSync(PROC, { recursive: true });
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
const dur = (f) => parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`));

const man = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8"));
// short natural breath between sections
const sil = join(PROC, "_sil.wav");
sh(`ffmpeg -y -f lavfi -i anullsrc=r=48000:cl=mono -t ${GAP} "${sil}" 2>/dev/null || true`);

const cues = {};
let t = 0;
const parts = [];
for (const m of man) {
  const inF = join(DIR, m.file), outF = join(PROC, m.file);
  sh(`ffmpeg -y -i "${inF}" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04:stop_periods=-1:stop_threshold=-45dB:stop_silence=0.18,loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -ac 1 "${outF}" 2>/dev/null`);
  cues[m.id] = +t.toFixed(3);
  const d = dur(outF);
  t += d + GAP;
  parts.push(outF, sil);
}
parts.pop(); // no trailing gap
cues._duration = +t.toFixed(3);

// concat
const listF = join(PROC, "list.txt");
writeFileSync(listF, parts.map((p) => `file '${p.replace("e2e/", "")}'`).join("\n"));
// run ffmpeg concat from e2e dir so relative paths resolve
sh(`cd e2e && ffmpeg -y -f concat -safe 0 -i "${listF.replace("e2e/", "")}" -c copy "audio_teaser/teaser.wav" 2>/dev/null || (cd e2e && ffmpeg -y -f concat -safe 0 -i "${listF.replace("e2e/", "")}" -ar 48000 -ac 1 "audio_teaser/teaser.wav" 2>/dev/null)`);

mkdirSync("e2e/video/public", { recursive: true });
writeFileSync("e2e/video/public/cues.json", JSON.stringify(cues, null, 2));
console.log(`concatenated ${man.length} sections -> teaser.wav (${cues._duration}s = ${Math.floor(cues._duration / 60)}:${String(Math.round(cues._duration % 60)).padStart(2, "0")})`);
console.log(JSON.stringify(cues, null, 2));
