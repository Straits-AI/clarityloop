#!/usr/bin/env python
"""Voice-cloned narration via VoxCPM2 (voxcpm 2.0.3).

Reads a JSON list of {id, text} narration lines and synthesizes each to a WAV,
cloned from a reference clip (prompt_wav + prompt_text). Outputs 24kHz mono WAV
plus a manifest with per-line durations (so the video compiler can sync clips).

Usage:
  python tts_voxcpm.py --script narration.json --ref assets/voice-ref-16s.wav \
      --ref-text assets/voice-ref.txt --out audio/
"""
import argparse, json, os, sys, wave
import numpy as np

SR = 24000  # VoxCPM output sample rate


def write_wav(path: str, wav: np.ndarray, sr: int = SR) -> float:
    wav = np.clip(wav, -1.0, 1.0)
    pcm = (wav * 32767.0).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    return len(wav) / sr


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", required=True)
    ap.add_argument("--ref", required=True)
    ap.add_argument("--ref-text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="openbmb/VoxCPM2")
    ap.add_argument("--device", default="mps")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    ref_text = open(args.ref_text).read().strip()
    lines = json.load(open(args.script)) if args.script.endswith(".json") else None
    if isinstance(lines, dict):
        lines = lines.get("lines", [])

    from voxcpm import VoxCPM
    print(f"[voxcpm2] loading {args.model} on {args.device} …", flush=True)
    try:
        tts = VoxCPM.from_pretrained(args.model, device=args.device)
    except Exception as e:  # MPS op gaps -> fall back to CPU
        print(f"[voxcpm2] {args.device} load failed ({e}); falling back to cpu", flush=True)
        tts = VoxCPM.from_pretrained(args.model, device="cpu")
    print("[voxcpm2] model ready", flush=True)

    manifest = []
    for i, line in enumerate(lines):
        lid, text = line["id"], line["text"].strip()
        out_path = os.path.join(args.out, f"{lid}.wav")
        print(f"[voxcpm2] ({i+1}/{len(lines)}) {lid}: {text[:60]}…", flush=True)
        wav = tts.generate(
            text=text,
            prompt_wav_path=args.ref,
            prompt_text=ref_text,
            cfg_value=2.0,
            inference_timesteps=10,
            normalize=True,
            denoise=False,
            retry_badcase=False,  # fp16/MPS can trip the badcase detector into endless retries
        )
        dur = write_wav(out_path, np.asarray(wav, dtype=np.float32))
        manifest.append({"id": lid, "file": f"{lid}.wav", "duration": round(dur, 3), "text": text})
        print(f"[voxcpm2]   -> {out_path}  ({dur:.2f}s)", flush=True)

    json.dump(manifest, open(os.path.join(args.out, "manifest.json"), "w"), indent=2)
    print("[voxcpm2] DONE manifest:", json.dumps(manifest, indent=2), flush=True)


if __name__ == "__main__":
    main()
