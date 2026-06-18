import {
  AbsoluteFill, OffthreadVideo, Audio, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing,
  delayRender, continueRender,
} from "remotion";
import { useEffect, useState } from "react";

export type Caption = { text: string; fromFrame: number; durFrames: number };
export type SceneItem = {
  id: string; label: string; index: string;
  clip: string; audio: string; clipStartFrame: number;
  durationFrames: number; captions: Caption[];
};
export type Scenes = { fps: number; introFrames: number; outroFrames: number; items: SceneItem[] };

const INK = "#06080d", AMBER = "#f5b13d", HI = "#eef2fb", DIM = "#8b97ac", GO = "#4ad6a0";
const DISPLAY = "'Bricolage Grotesque', sans-serif";
const MONO = "'JetBrains Mono', monospace";
const BODY = "'Hanken Grotesk', sans-serif";

const useFonts = () => {
  const [h] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const id = "gf";
    if (!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");`;
      document.head.appendChild(s);
    }
    const f: FontFaceSet = document.fonts;
    Promise.all([
      f.load("700 48px 'Bricolage Grotesque'"),
      f.load("500 24px 'JetBrains Mono'"),
      f.load("500 24px 'Hanken Grotesk'"),
    ]).then(() => f.ready).then(() => continueRender(h)).catch(() => continueRender(h));
  }, [h]);
};

const grain = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const Vignette = () => (
  <AbsoluteFill style={{ boxShadow: "inset 0 0 320px 60px rgba(0,0,0,0.55)", pointerEvents: "none" }} />
);
const Grain = () => (
  <AbsoluteFill style={{ backgroundImage: grain, opacity: 0.04, pointerEvents: "none", mixBlendMode: "overlay" }} />
);

const SceneChip: React.FC<{ index: string; label: string; frame: number }> = ({ index, label, frame }) => {
  const o = interpolate(frame, [4, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(frame, [4, 16], [-16, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", top: 46, left: 52, opacity: o, transform: `translateX(${x}px)`, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 12, height: 12, transform: "rotate(45deg)", border: `2px solid ${AMBER}` }} />
      <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.22em", color: DIM }}>
        <span style={{ color: AMBER }}>{index}</span> &nbsp;{label.toUpperCase()}
      </div>
    </div>
  );
};

const CaptionBar: React.FC<{ captions: Caption[]; frame: number }> = ({ captions, frame }) => {
  const c = captions.find((cap) => frame >= cap.fromFrame && frame < cap.fromFrame + cap.durFrames);
  if (!c) return null;
  const local = frame - c.fromFrame;
  const o = interpolate(local, [0, 8, c.durFrames - 8, c.durFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(local, [0, 10], [14, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: 52, right: 52, bottom: 56, opacity: o, transform: `translateY(${y}px)` }}>
      <div style={{ display: "inline-flex", maxWidth: "82%", alignItems: "stretch", gap: 18, background: "rgba(8,11,17,0.82)", backdropFilter: "blur(6px)", border: "1px solid rgba(150,172,210,0.18)", borderRadius: 5, padding: "16px 22px" }}>
        <div style={{ width: 3, background: AMBER, borderRadius: 2 }} />
        <div style={{ fontFamily: BODY, fontSize: 28, lineHeight: 1.32, color: HI, fontWeight: 500 }}>{c.text}</div>
      </div>
    </div>
  );
};

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(150,172,210,0.12)" }}>
    <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${AMBER}, #c8851f)` }} />
  </div>
);

const Brand: React.FC<{ frames: number; outro?: boolean }> = ({ frames, outro }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 14, frames - 14, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s = interpolate(frame, [0, 20], [0.94, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(900px 540px at 50% 32%, rgba(245,177,61,0.12), transparent 60%), ${INK}`, justifyContent: "center", alignItems: "center" }}>
      <Grain />
      <div style={{ opacity: o, transform: `scale(${s})`, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <div style={{ width: 30, height: 30, transform: "rotate(45deg)", border: `3px solid ${AMBER}`, boxShadow: `0 0 36px ${AMBER}66` }} />
        </div>
        {outro ? (
          <>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 76, color: HI, letterSpacing: "-0.02em", lineHeight: 1.05 }}>
              Harnesses evolve.<br /><span style={{ color: AMBER }}>ClarityLoop</span> decides what ships.
            </div>
            <div style={{ fontFamily: MONO, fontSize: 19, color: DIM, letterSpacing: "0.16em", marginTop: 30 }}>github.com/Straits-AI/clarityloop · MIT</div>
            <div style={{ fontFamily: MONO, fontSize: 15, color: DIM, letterSpacing: "0.2em", marginTop: 12 }}>QWEN CLOUD HACKATHON · TRACK 4 · AUTOPILOT AGENT</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 92, color: HI, letterSpacing: "-0.03em" }}>ClarityLoop</div>
            <div style={{ fontFamily: MONO, fontSize: 20, color: AMBER, letterSpacing: "0.28em", marginTop: 16 }}>AUTHORITY-BOUNDARY RELEASE CONTROL</div>
            <div style={{ fontFamily: BODY, fontSize: 24, color: DIM, marginTop: 24 }}>The model proposes. Deterministic code decides what ships.</div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Scene: React.FC<{ item: SceneItem; globalFrom: number; total: number }> = ({ item, globalFrom, total }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ transform: "scale(1.005)" }}>
        <OffthreadVideo src={staticFile(item.clip)} startFrom={item.clipStartFrame} muted />
      </AbsoluteFill>
      <Vignette />
      <ProgressBar progress={(globalFrom + frame) / total} />
      <SceneChip index={item.index} label={item.label} frame={frame} />
      <CaptionBar captions={item.captions} frame={frame} />
      <Audio src={staticFile(item.audio)} />
    </AbsoluteFill>
  );
};

export const Demo: React.FC<{ scenes: Scenes }> = ({ scenes }) => {
  useFonts();
  const { durationInFrames } = useVideoConfig();
  let cursor = scenes.introFrames;
  const placed = scenes.items.map((item) => {
    const from = cursor;
    cursor += item.durationFrames;
    return { item, from };
  });
  return (
    <AbsoluteFill style={{ background: INK, fontFamily: BODY }}>
      <Sequence durationInFrames={scenes.introFrames}><Brand frames={scenes.introFrames} /></Sequence>
      {placed.map(({ item, from }) => (
        <Sequence key={item.id} from={from} durationInFrames={item.durationFrames}>
          <Scene item={item} globalFrom={from} total={durationInFrames} />
        </Sequence>
      ))}
      <Sequence from={cursor} durationInFrames={scenes.outroFrames}><Brand frames={scenes.outroFrames} outro /></Sequence>
    </AbsoluteFill>
  );
};
