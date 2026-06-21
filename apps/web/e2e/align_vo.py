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

# (cue_key, whisper_search_substr, min_time_floor) — threat-first narration anchors
ANCHORS = [
    ("agent","agent",0.0), ("wrong","wrong",4.0), ("shipped","shipped",16.0),
    ("change","change",26.0), ("escalates","escalat",40.0), ("proposes","propos",50.0),
    ("image","image",60.0), ("clean","clean",74.0), ("ambiguous","ambig",84.0),
    ("third","third",90.0), ("swap","swap",104.0), ("function","function",114.0),
    ("job","job",124.0),
]

asr = pipeline("automatic-speech-recognition", model="openai/whisper-base", chunk_length_s=30)
res = asr(AUDIO, return_timestamps="word", generate_kwargs={"task": "transcribe", "language": "en"})
words = [(c["text"].strip().lower(), c["timestamp"][0]) for c in res["chunks"] if c["timestamp"][0] is not None]

import soundfile as sf
dur = len(sf.read(AUDIO)[0]) / sf.info(AUDIO).samplerate

# Monotonic alignment: anchors occur IN ORDER, so find each one's first occurrence AFTER the
# previous anchor (not a fixed time floor) — robust to whatever length the VO actually is.
cues = {"_duration": round(dur, 3)}
last = -1.0
for key, anchor, _floor in ANCHORS:
    t = next((ts for w, ts in words if anchor in w and ts > last + 0.04), None)
    cues[key] = round(t, 3) if t is not None else None
    if t is not None:
        last = t
import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(cues, open(OUT, "w"), indent=2)
print(json.dumps(cues, indent=2))
print("transcript:", " ".join(w for w, _ in words))
