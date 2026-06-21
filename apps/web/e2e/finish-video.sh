#!/bin/bash
# Run this ONCE the VoxCPM VO finishes (audio_teaser/teaser.wav written fresh by tts_voxcpm.py).
# It: slows the VO for pace, verifies it's hum-free, aligns word cues, rebuilds beats, and renders.
set -e
cd "$(dirname "$0")"                      # apps/web/e2e
PY=../../../.venv-voxcpm/bin/python

echo "== 1. slow the VO 10% (atempo, pitch-preserved) =="
cp audio_teaser/teaser.wav audio_teaser/teaser.raw.wav
ffmpeg -y -i audio_teaser/teaser.raw.wav -filter:a "atempo=0.9" audio_teaser/teaser.wav 2>/dev/null
cp audio_teaser/teaser.wav video/public/audio_teaser/teaser.wav
echo "   duration: $(ffmpeg -i audio_teaser/teaser.wav -f null - 2>&1 | grep -oE 'time=[0-9:.]+' | tail -1)"

echo "== 2. hum check (40-60Hz vs voice band; strong de-hum if needed) =="
REL=$($PY - <<'EOF'
import numpy as np, soundfile as sf
w,sr=sf.read("audio_teaser/teaser.wav"); w=w if w.ndim==1 else w.mean(1)
N=1<<16; win=np.hanning(N); acc=np.zeros(N//2+1); h=N//2; c=0
for s in range(0,len(w)-N,h): acc+=np.abs(np.fft.rfft(w[s:s+N]*win)); c+=1
acc/=c; fr=np.fft.rfftfreq(N,1/sr); db=20*np.log10(acc/acc.max()+1e-12)
b=(fr>=40)&(fr<=60); vb=(fr>=200)&(fr<=2000)
print(round(float(db[b].max()-np.median(db[vb])),1))
EOF
)
echo "   40-60Hz rel-to-voice: ${REL}dB (want <= -18)"
if (( $(echo "$REL > -18" | bc -l) )); then
  echo "   applying strong de-hum…"
  ffmpeg -y -i audio_teaser/teaser.raw.wav -af "highpass=f=105:poles=2,highpass=f=105:poles=2,highpass=f=105:poles=2,equalizer=f=49:width_type=h:width=14:g=-30,atempo=0.9" audio_teaser/teaser.wav 2>/dev/null
  cp audio_teaser/teaser.wav video/public/audio_teaser/teaser.wav
fi

echo "== 3. align word cues (whisper) =="
$PY align_vo.py audio_teaser/teaser.wav video/public/cues.json

echo "== 4. build beats =="
( cd .. && node e2e/build-teaser.mjs )

echo "== 5. render (concurrency 2; ~45-60min) =="
( cd video && npx remotion render ClarityLoopTeaser ../output/demo.mp4 --concurrency=2 )
echo "== DONE -> apps/web/e2e/output/demo.mp4 =="
