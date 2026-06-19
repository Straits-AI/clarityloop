#!/usr/bin/env python
"""Voice-cloned narration via VoxCPM2 — using the proven `reference_wav_path` method.

Mirrors the working approach in ../myposts: structurally-isolated voice cloning via
`reference_wav_path` (NOT prompt_wav_path+prompt_text continuation mode, which inherits the
reference's prosody and produces artifacts), plus a parenthetical voice-control prompt that
sets delivery + pace at generation time (so no post-hoc time-stretch is needed).

Usage:
  python tts_voxcpm.py --script narration.json --ref assets/voice-ref-16s.wav --out audio/ --device cpu
"""
import argparse, json, os
import numpy as np
import soundfile as sf

# Delivery control (parenthetical voice-design cue VoxCPM2 reads but does not speak).
# Pacing + breaths come from this cue AND the script's punctuation (periods, ellipses,
# rhetorical questions) — NOT from inserted silence.
VOICE_CONTROL = (
    "confident product narrator with teaser energy; medium-fast pace; natural pauses "
    "between thoughts; crisp emphasis on key numbers; clear and modern; not dramatic; "
    "not reading slides"
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--ref", required=True, help="reference WAV for voice cloning (reference_wav_path)")
    ap.add_argument("--ref-text", default=None, help="unused in reference_wav_path mode; kept for compat")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="openbmb/VoxCPM2")
    ap.add_argument("--device", default="cpu")
    ap.add_argument("--steps", type=int, default=10)
    ap.add_argument("--cfg-value", type=float, default=2.0)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    lines = json.load(open(args.script))
    if isinstance(lines, dict):
        lines = lines.get("lines", [])

    from voxcpm import VoxCPM
    print(f"[voxcpm2] loading {args.model} on {args.device} (no denoiser, no optimize) …", flush=True)
    tts = VoxCPM.from_pretrained(
        args.model, load_denoiser=False, optimize=False, local_files_only=True, device=args.device
    )
    sr = tts.tts_model.sample_rate
    print(f"[voxcpm2] model ready · sample_rate={sr}", flush=True)

    manifest = []
    for i, line in enumerate(lines):
        lid, text = line["id"], line["text"].strip()
        prompted = f"({VOICE_CONTROL}) {text}"
        out_path = os.path.join(args.out, f"{lid}.wav")
        print(f"[voxcpm2] ({i+1}/{len(lines)}) {lid}: {text[:60]}…", flush=True)
        wav = tts.generate(
            text=prompted,
            reference_wav_path=str(args.ref),
            cfg_value=args.cfg_value,
            inference_timesteps=args.steps,
        )
        wav = np.asarray(wav, dtype=np.float32)
        sf.write(out_path, wav, sr)
        dur = len(wav) / sr
        manifest.append({"id": lid, "file": f"{lid}.wav", "duration": round(dur, 3), "text": text})
        print(f"[voxcpm2]   -> {out_path}  ({dur:.2f}s)", flush=True)

    json.dump(manifest, open(os.path.join(args.out, "manifest.json"), "w"), indent=2)
    print("[voxcpm2] DONE", json.dumps([(m["id"], m["duration"]) for m in manifest]), flush=True)


if __name__ == "__main__":
    main()
