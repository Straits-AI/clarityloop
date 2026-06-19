import {
  AbsoluteFill, OffthreadVideo, Audio, Sequence, staticFile,
  useCurrentFrame, useVideoConfig, interpolate, Easing, delayRender, continueRender, spring,
} from "remotion";
import { useEffect, useState } from "react";

export type Callout =
  | { kind: "phrase"; text: string; color?: string; sub?: string; shape?: ShapeKind }
  | { kind: "stat"; big: string; sub: string; color: string; shape?: ShapeKind }
  | { kind: "dual"; a: string; aSub: string; b: string; bSub: string };
type ShapeKind = "brackets" | "underline" | "ring" | "slash" | "none";
export type Box = { x: number; y: number; w: number; h: number };
export type Shot = {
  from: number; dur: number; clip: string; clipStartFrame: number;
  scaleFrom: number; scaleTo: number; originX: number; originY: number;
  label?: string; callout?: Callout; dim?: number; blur?: number;
  highlight?: Box; annotation?: { step: string; text: string };
};
export type Teaser = { fps: number; introFrames: number; outroFrames: number; vo: string; shots: Shot[] };

const INK = "#06080d", AMBER = "#f5b13d", HI = "#eef2fb", DIM = "#8b97ac", GO = "#4ad6a0", STOP = "#ff6f6f";
const DISPLAY = "'Bricolage Grotesque', sans-serif", MONO = "'JetBrains Mono', monospace", BODY = "'Hanken Grotesk', sans-serif";
const grain = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const useFonts = () => {
  const [h] = useState(() => delayRender("fonts"));
  useEffect(() => {
    if (!document.getElementById("gf")) {
      const s = document.createElement("style"); s.id = "gf";
      s.textContent = `@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap");`;
      document.head.appendChild(s);
    }
    const f = document.fonts;
    Promise.all([f.load("800 120px 'Bricolage Grotesque'"), f.load("700 28px 'JetBrains Mono'"), f.load("500 28px 'Hanken Grotesk'")])
      .then(() => f.ready).then(() => continueRender(h)).catch(() => continueRender(h));
  }, [h]);
};

const Grain = () => <AbsoluteFill style={{ backgroundImage: grain, opacity: 0.05, pointerEvents: "none", mixBlendMode: "overlay" }} />;
const Vignette = () => <AbsoluteFill style={{ boxShadow: "inset 0 0 380px 90px rgba(0,0,0,0.62)", pointerEvents: "none" }} />;
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

// ── shapes ────────────────────────────────────────────────────────────────────
const CornerBrackets: React.FC<{ frame: number; dur: number; color: string; pad?: number }> = ({ frame, dur, color, pad = 26 }) => {
  const draw = interpolate(frame, [4, 16], [0, 1], clamp);
  const out = interpolate(frame, [dur - 10, dur], [1, 0], clamp);
  const o = Math.min(draw, out), L = 54 * draw;
  const C = (s: React.CSSProperties) => <div style={{ position: "absolute", width: L, height: L, borderColor: color, opacity: o, ...s }} />;
  return (
    <div style={{ position: "absolute", inset: -pad }}>
      <C style={{ top: 0, left: 0, borderTop: "3px solid", borderLeft: "3px solid" }} />
      <C style={{ top: 0, right: 0, borderTop: "3px solid", borderRight: "3px solid" }} />
      <C style={{ bottom: 0, left: 0, borderBottom: "3px solid", borderLeft: "3px solid" }} />
      <C style={{ bottom: 0, right: 0, borderBottom: "3px solid", borderRight: "3px solid" }} />
    </div>
  );
};
const Underline: React.FC<{ frame: number; dur: number; color: string }> = ({ frame, dur, color }) => {
  const w = interpolate(frame, [8, 22], [0, 100], { ...clamp, easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [dur - 10, dur], [1, 0], clamp);
  return <div style={{ position: "absolute", left: "50%", bottom: -22, transform: "translateX(-50%)", width: `${w}%`, height: 5, background: color, opacity: out, boxShadow: `0 0 16px ${color}` }} />;
};
const Ring: React.FC<{ frame: number; dur: number; color: string }> = ({ frame, dur, color }) => {
  const s = spring({ frame, fps: 30, config: { damping: 12, stiffness: 120 }, durationInFrames: 20 });
  const out = interpolate(frame, [dur - 10, dur], [1, 0], clamp);
  return <div style={{ position: "absolute", inset: "-18% -8%", border: `2px solid ${color}`, borderRadius: 999, opacity: 0.5 * s * out, transform: `scale(${0.8 + 0.2 * s})` }} />;
};
const Slash: React.FC<{ frame: number; color: string }> = ({ frame, color }) => {
  const d = interpolate(frame, [6, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={{ position: "absolute", left: "-6%", right: "-6%", top: "50%", height: 4, background: color, transform: `rotate(-8deg) scaleX(${d})`, transformOrigin: "left", opacity: 0.85, boxShadow: `0 0 14px ${color}` }} />;
};
const Shape: React.FC<{ kind: ShapeKind | undefined; frame: number; dur: number; color: string }> = ({ kind, frame, dur, color }) =>
  kind === "brackets" ? <CornerBrackets frame={frame} dur={dur} color={color} /> :
  kind === "underline" ? <Underline frame={frame} dur={dur} color={color} /> :
  kind === "ring" ? <Ring frame={frame} dur={dur} color={color} /> :
  kind === "slash" ? <Slash frame={frame} color={color} /> : null;

// ── kinetic words: fly in (stagger), emphasis grows, fly off at the end ─────────
const Words: React.FC<{ text: string; color: string; frame: number; dur: number; fps: number; size: number }> = ({ text, color, frame, dur, fps, size }) => {
  const tokens = text.split(" ");
  const exitStart = dur - 12;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${size * 0.26}px`, maxWidth: "86%" }}>
      {tokens.map((tok, i) => {
        const emph = tok.includes("*");
        const word = tok.replace(/\*/g, "");
        const d = i * 3;
        const inS = spring({ frame: frame - d, fps, config: { damping: 14, stiffness: 150 }, durationInFrames: 16 });
        const y = interpolate(inS, [0, 1], [70, 0]);
        const exitO = interpolate(frame, [exitStart + i * 1.2, exitStart + 10 + i * 1.2], [1, 0], clamp);
        const exitY = interpolate(frame, [exitStart, dur], [0, -50], clamp);
        const grow = emph ? interpolate(spring({ frame: frame - d - 4, fps, config: { damping: 10, stiffness: 120 }, durationInFrames: 18 }), [0, 1], [1, 1.34]) : 1;
        const rot = interpolate(inS, [0, 1], [(i % 2 ? 8 : -8), 0]);
        const blur = interpolate(inS, [0, 0.7], [12, 0], clamp);
        const exitRot = interpolate(frame, [exitStart, dur], [0, (i % 2 ? 10 : -10)], clamp);
        return (
          <span key={i} style={{
            fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.0, letterSpacing: "-0.02em",
            color: emph ? AMBER : color, opacity: Math.min(inS, exitO),
            transform: `translateY(${y + exitY}px) rotate(${rot + exitRot}deg) scale(${grow})`, transformOrigin: "center bottom", display: "inline-block",
            filter: `blur(${blur}px)`, textShadow: emph ? `0 0 40px ${AMBER}66` : "0 6px 34px rgba(0,0,0,0.7)",
          }}>{word}</span>
        );
      })}
    </div>
  );
};

const Sub: React.FC<{ text: string; frame: number; dur: number }> = ({ text, frame, dur }) => {
  const w = interpolate(frame, [12, 26], [0, 100], { ...clamp, easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [dur - 12, dur], [1, 0], clamp);
  return (
    <div style={{ overflow: "hidden", marginTop: 26, opacity: out }}>
      <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.26em", color: DIM, textTransform: "uppercase", clipPath: `inset(0 ${100 - w}% 0 0)` }}>{text}</div>
    </div>
  );
};

// big number: slam in with overshoot + count-up
const StatSlam: React.FC<{ big: string; sub: string; color: string; shape?: ShapeKind; frame: number; dur: number; fps: number }> = ({ big, sub, color, shape, frame, dur, fps }) => {
  const s = spring({ frame, fps, config: { damping: 11, stiffness: 170, mass: 0.9 }, durationInFrames: 22 });
  const exit = interpolate(frame, [dur - 12, dur], [1, 0], clamp);
  const num = parseInt(big, 10);
  const shown = Number.isNaN(num) ? big : `${Math.round(interpolate(frame, [2, 16], [0, num], clamp))}${big.replace(/[0-9]/g, "")}`;
  const blur = interpolate(s, [0, 0.6, 1], [16, 4, 0]);
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", opacity: exit, transform: `scale(${0.7 + 0.3 * s})` }}>
      <div style={{ position: "relative" }}>
        <Shape kind={shape ?? "brackets"} frame={frame} dur={dur} color={color} />
        <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 250, lineHeight: 0.86, color, letterSpacing: "-0.05em", filter: `blur(${blur}px)`, textShadow: `0 0 60px ${color}55` }}>{shown}</div>
      </div>
      <Sub text={sub} frame={frame} dur={dur} />
    </div>
  );
};

function CalloutView({ c, frame, dur, fps }: { c: Callout; frame: number; dur: number; fps: number }) {
  const wrap: React.CSSProperties = { position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" };
  if (c.kind === "phrase")
    return (
      <div style={wrap}>
        <div style={{ position: "relative" }}>
          <Shape kind={c.shape} frame={frame} dur={dur} color={c.color ?? AMBER} />
          <Words text={c.text} color={c.color ?? HI} frame={frame} dur={dur} fps={fps} size={104} />
        </div>
        {c.sub && <Sub text={c.sub} frame={frame} dur={dur} />}
      </div>
    );
  if (c.kind === "stat")
    return <div style={wrap}><StatSlam {...c} frame={frame} dur={dur} fps={fps} /></div>;
  // dual: slam from opposite sides with a VS
  const sa = spring({ frame, fps, config: { damping: 13, stiffness: 150 }, durationInFrames: 18 });
  const sb = spring({ frame: frame - 4, fps, config: { damping: 13, stiffness: 150 }, durationInFrames: 18 });
  const exit = interpolate(frame, [dur - 12, dur], [1, 0], clamp);
  const col = (n: string, s: string, sp: number, dir: number, color: string) => (
    <div style={{ textAlign: "center", opacity: sp * exit, transform: `translateX(${(1 - sp) * dir * 120}px)` }}>
      <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 190, lineHeight: 0.9, color, letterSpacing: "-0.03em", textShadow: `0 0 50px ${color}55` }}>{n}</div>
      <div style={{ fontFamily: MONO, fontSize: 23, letterSpacing: "0.2em", color: HI, marginTop: 8, textTransform: "uppercase" }}>{s}</div>
    </div>
  );
  return (
    <div style={{ ...wrap, flexDirection: "row", gap: 70 }}>
      {col(c.a, c.aSub, sa, -1, STOP)}
      <div style={{ fontFamily: MONO, fontSize: 40, color: DIM, opacity: exit * sb }}>→</div>
      {col(c.b, c.bSub, sb, 1, GO)}
    </div>
  );
}

const Kicker: React.FC<{ text: string; frame: number; dur: number }> = ({ text, frame, dur }) => {
  const x = interpolate(spring({ frame, fps: 30, config: { damping: 16 }, durationInFrames: 14 }), [0, 1], [-20, 0]);
  const o = Math.min(interpolate(frame, [2, 12], [0, 1], clamp), interpolate(frame, [dur - 10, dur], [1, 0], clamp));
  return (
    <div style={{ position: "absolute", top: 50, left: 56, display: "flex", alignItems: "center", gap: 12, opacity: o, transform: `translateX(${x}px)` }}>
      <div style={{ width: 11, height: 11, transform: "rotate(45deg)", border: `2px solid ${AMBER}` }} />
      <span style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.22em", color: DIM, textTransform: "uppercase" }}>{text}</span>
    </div>
  );
};

// ── constant motion-graphics layer (always moving behind/around the type) ──────
const MotionLayer: React.FC<{ frame: number; dur: number; seed: number }> = ({ frame, dur, seed }) => {
  const o = Math.min(interpolate(frame, [0, 10], [0, 1], clamp), interpolate(frame, [dur - 8, dur], [1, 0], clamp));
  // sweeping scan line
  const scanY = ((frame * 9 + seed * 120) % 1180) - 50;
  // drifting HUD dots
  const dots = Array.from({ length: 14 }, (_, i) => {
    const px = (i * 137 + seed * 53) % 1920;
    const py = ((i * 211 + frame * (1.2 + (i % 3) * 0.5) + seed * 90) % 1140);
    const tw = 0.3 + 0.5 * Math.abs(Math.sin((frame + i * 20) / 18));
    return <div key={i} style={{ position: "absolute", left: px, top: py, width: 4, height: 4, borderRadius: 9, background: i % 4 === 0 ? AMBER : "#5ec8e0", opacity: 0.12 + 0.25 * tw }} />;
  });
  // flickering corner HUD readouts
  const hud = (frame * 7 + seed * 311) % 1000;
  const tick = `0x${(hud).toString(16).padStart(3, "0").toUpperCase()}`;
  return (
    <AbsoluteFill style={{ opacity: o, pointerEvents: "none" }}>
      {/* scrolling fine grid */}
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(rgba(150,172,210,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(150,172,210,0.05) 1px, transparent 1px)`, backgroundSize: "60px 60px", backgroundPosition: `0px ${(frame * 0.6) % 60}px` }} />
      {dots}
      <div style={{ position: "absolute", left: 0, right: 0, top: scanY, height: 2, background: `linear-gradient(90deg, transparent, ${AMBER}88, transparent)`, opacity: 0.5 }} />
      <div style={{ position: "absolute", right: 54, top: 50, fontFamily: MONO, fontSize: 13, letterSpacing: "0.18em", color: DIM }}>SEQ {tick}</div>
      <div style={{ position: "absolute", right: 54, bottom: 46, fontFamily: MONO, fontSize: 13, letterSpacing: "0.18em", color: DIM }}>● REC {String(Math.floor(frame / 30)).padStart(2, "0")}:{String(frame % 30).padStart(2, "0")}</div>
      <div style={{ position: "absolute", left: 54, bottom: 46, fontFamily: MONO, fontSize: 13, letterSpacing: "0.18em", color: DIM }}>CLARITYLOOP · LIVE</div>
    </AbsoluteFill>
  );
};
const Flash: React.FC<{ frame: number }> = ({ frame }) => {
  const o = interpolate(frame, [0, 2, 6], [0.55, 0.25, 0], clamp);
  return <AbsoluteFill style={{ background: "#fff", opacity: o, mixBlendMode: "screen", pointerEvents: "none" }} />;
};

// ── demo annotation: highlight brackets that snap around a UI element ───────────
const Highlight: React.FC<{ box: Box; frame: number; dur: number; fps: number }> = ({ box, frame, dur, fps }) => {
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 130 }, durationInFrames: 16 });
  const out = interpolate(frame, [dur - 10, dur], [1, 0], clamp);
  const o = s * out, L = 30 * s;
  const pulse = 0.6 + 0.4 * Math.sin(frame / 7);
  const C = (st: React.CSSProperties) => <div style={{ position: "absolute", width: L, height: L, borderColor: AMBER, ...st }} />;
  return (
    <div style={{ position: "absolute", left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, opacity: o, transform: `scale(${0.96 + 0.04 * s})` }}>
      <div style={{ position: "absolute", inset: 0, border: `1px solid ${AMBER}`, opacity: 0.35 * pulse, borderRadius: 4, boxShadow: `0 0 24px ${AMBER}33 inset` }} />
      <C style={{ top: -2, left: -2, borderTop: "3px solid", borderLeft: "3px solid" }} />
      <C style={{ top: -2, right: -2, borderTop: "3px solid", borderRight: "3px solid" }} />
      <C style={{ bottom: -2, left: -2, borderBottom: "3px solid", borderLeft: "3px solid" }} />
      <C style={{ bottom: -2, right: -2, borderBottom: "3px solid", borderRight: "3px solid" }} />
    </div>
  );
};
// lower-third step annotation: number badge + kinetic words
const Annotation: React.FC<{ step: string; text: string; frame: number; dur: number; fps: number }> = ({ step, text, frame, dur, fps }) => {
  const s = spring({ frame, fps, config: { damping: 18, stiffness: 150 }, durationInFrames: 16 });
  const out = interpolate(frame, [dur - 12, dur], [1, 0], clamp);
  const y = interpolate(s, [0, 1], [40, 0]);
  const tokens = text.split(" ");
  return (
    <div style={{ position: "absolute", left: 56, right: 56, bottom: 70, opacity: Math.min(s, out), transform: `translateY(${y}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 6, background: AMBER, color: INK, display: "grid", placeItems: "center", fontFamily: MONO, fontWeight: 700, fontSize: 22, boxShadow: `0 0 22px ${AMBER}66` }}>{step}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0 11px", alignItems: "baseline" }}>
          {tokens.map((w, i) => {
            const d = i * 2;
            const ws = spring({ frame: frame - d, fps, config: { damping: 16, stiffness: 170 }, durationInFrames: 12 });
            return <span key={i} style={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 40, color: HI, opacity: ws, transform: `translateY(${(1 - ws) * 22}px)`, display: "inline-block", textShadow: "0 4px 24px rgba(0,0,0,0.8)" }}>{w}</span>;
          })}
        </div>
      </div>
    </div>
  );
};

function ShotView({ shot, total, globalFrom }: { shot: Shot; total: number; globalFrom: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = interpolate(frame, [0, shot.dur], [shot.scaleFrom, shot.scaleTo], { extrapolateRight: "clamp" });
  // entrance: footage masks up from a slim band + quick amber wipe across the cut
  const reveal = interpolate(frame, [0, 12], [62, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const wipe = interpolate(frame, [0, 9], [0, 110], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const target = shot.dim ?? 0.46;
  const dark = interpolate(frame, [0, 14], [Math.min(0.85, target + 0.3), target], clamp);
  const fblur = shot.blur ?? 0;
  return (
    <AbsoluteFill style={{ background: INK }}>
      <AbsoluteFill style={{ clipPath: `inset(${reveal / 2}% 0% ${reveal / 2}% 0%)` }}>
        <AbsoluteFill style={{ transform: `scale(${drift})`, transformOrigin: `${shot.originX}% ${shot.originY}%`, filter: fblur ? `blur(${fblur}px)` : undefined }}>
          <OffthreadVideo src={staticFile(shot.clip)} startFrom={shot.clipStartFrame} muted />
        </AbsoluteFill>
        <AbsoluteFill style={{ background: `rgba(6,8,13,${dark})` }} />
      </AbsoluteFill>
      <Vignette />
      <Grain />
      <MotionLayer frame={frame} dur={shot.dur} seed={Math.round(globalFrom / 7) % 17} />
      {shot.highlight && <Highlight box={shot.highlight} frame={frame} dur={shot.dur} fps={fps} />}
      {shot.label && <Kicker text={shot.label} frame={frame} dur={shot.dur} />}
      {shot.callout && <CalloutView c={shot.callout} frame={frame} dur={shot.dur} fps={fps} />}
      {shot.annotation && <Annotation step={shot.annotation.step} text={shot.annotation.text} frame={frame} dur={shot.dur} fps={fps} />}
      {/* amber wipe transition at the cut */}
      <AbsoluteFill style={{ background: AMBER, clipPath: `inset(0 ${100 - wipe}% 0 0)`, opacity: wipe < 100 ? 1 : 0, mixBlendMode: "screen" }} />
      <Flash frame={frame} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(150,172,210,0.12)" }}>
        <div style={{ height: "100%", width: `${((globalFrom + frame) / total) * 100}%`, background: `linear-gradient(90deg, ${AMBER}, #c8851f)` }} />
      </div>
    </AbsoluteFill>
  );
}

function Brand({ frames, outro }: { frames: number; outro?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = interpolate(frame, [0, 12, frames - 14, frames], [0, 1, 1, 0], clamp);
  const spin = interpolate(frame, [0, 26], [180, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ds = spring({ frame, fps, config: { damping: 12 }, durationInFrames: 22 });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(900px 560px at 50% 42%, rgba(245,177,61,0.14), transparent 60%), ${INK}`, justifyContent: "center", alignItems: "center" }}>
      <Grain />
      <div style={{ opacity: op, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ width: 30, height: 30, transform: `rotate(${45 + spin}deg) scale(${0.6 + 0.4 * ds})`, border: `3px solid ${AMBER}`, boxShadow: `0 0 36px ${AMBER}66` }} />
        </div>
        {outro ? (
          <>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 80, color: HI, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              Harnesses evolve.<br /><span style={{ color: AMBER }}>ClarityLoop</span> decides what ships.
            </div>
            <div style={{ fontFamily: MONO, fontSize: 18, color: DIM, letterSpacing: "0.18em", marginTop: 28 }}>github.com/Straits-AI/clarityloop · MIT</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: DIM, letterSpacing: "0.2em", marginTop: 10 }}>QWEN CLOUD HACKATHON · TRACK 4</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 100, color: HI, letterSpacing: "-0.03em" }}>ClarityLoop</div>
            <div style={{ fontFamily: MONO, fontSize: 19, color: AMBER, letterSpacing: "0.28em", marginTop: 14 }}>AUTHORITY-BOUNDARY RELEASE CONTROL</div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
}

export const TeaserVideo: React.FC<{ teaser: Teaser }> = ({ teaser }) => {
  useFonts();
  const { durationInFrames } = useVideoConfig();
  const last = teaser.shots[teaser.shots.length - 1];
  return (
    <AbsoluteFill style={{ background: INK, fontFamily: BODY }}>
      <Sequence from={teaser.introFrames}><Audio src={staticFile(teaser.vo)} /></Sequence>
      <Sequence durationInFrames={teaser.introFrames}><Brand frames={teaser.introFrames} /></Sequence>
      {teaser.shots.map((shot, i) => (
        <Sequence key={i} from={shot.from} durationInFrames={shot.dur}>
          <ShotView shot={shot} total={durationInFrames} globalFrom={shot.from} />
        </Sequence>
      ))}
      <Sequence from={last.from + last.dur} durationInFrames={teaser.outroFrames}><Brand frames={teaser.outroFrames} outro /></Sequence>
    </AbsoluteFill>
  );
};
