#!/usr/bin/env python
"""Word-align the teaser VO so visual cuts land on the right words.

Uses Whisper word timestamps; finds the first occurrence (after a floor time) of each
anchor word and writes cues.json: { anchor: start_seconds, ... , "_duration": total }.
"""
import json, sys, warnings
warnings.filterwarnings("ignore")
from transformers import pipeline

AUDIO = sys.argv[1] if len(sys.argv) > 1 else "audio_teaser/teaser.wav"
OUT = sys.argv[2] if len(sys.argv) > 2 else "video/public/cues.json"

# (cue_key, whisper_search_substr, min_time_floor) — Whisper writes digits + "clarity loop"
ANCHORS = [
    ("agent","agent",0.0), ("clean","clean",3.0), ("governed","governed",11.0),
    ("clears","clear",18.0), ("messier","messier",25.0), ("gaps","gaps",36.0),
    ("escalates","escalat",46.0), ("promotes","promot",56.0), ("benchmark","benchmark",57.0),
    ("attack","attack",66.0), ("function","function",72.0),
]

asr = pipeline("automatic-speech-recognition", model="openai/whisper-base", chunk_length_s=30)
res = asr(AUDIO, return_timestamps="word", generate_kwargs={"task": "transcribe", "language": "en"})
words = [(c["text"].strip().lower(), c["timestamp"][0]) for c in res["chunks"] if c["timestamp"][0] is not None]

import soundfile as sf
dur = len(sf.read(AUDIO)[0]) / sf.info(AUDIO).samplerate

cues = {"_duration": round(dur, 3)}
for key, anchor, floor in ANCHORS:
    t = next((ts for w, ts in words if anchor in w and ts >= floor), None)
    cues[key] = round(t, 3) if t is not None else None
import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(cues, open(OUT, "w"), indent=2)
print(json.dumps(cues, indent=2))
print("transcript:", " ".join(w for w, _ in words))
