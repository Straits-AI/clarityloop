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
    ("agent", "agent", 0.0), ("ship", "ship", 3.0), ("capability", "capabilit", 5.0),
    ("governance", "governance", 6.5), ("clarityloop", "clarity", 7.5),
    ("uncertainty", "uncertaint", 10.0), ("decides", "decide", 16.0),
    ("thirty", "36", 22.0), ("zero", "0", 27.0), ("eighty", "86", 29.0),
    ("attacks", "attack", 31.0), ("replay", "replay", 34.0), ("harnesses", "harness", 37.0),
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
