import { Composition, staticFile } from "remotion";
import { Demo, type Scenes } from "./Demo";
import { TeaserVideo, type Teaser } from "./Teaser";

const FPS = 30;
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ClarityLoopDemo"
      component={Demo}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ scenes: { fps: FPS, introFrames: 66, outroFrames: 90, items: [] } as Scenes }}
      calculateMetadata={async () => {
        const res = await fetch(staticFile("scenes.json"));
        const scenes: Scenes = await res.json();
        const total = scenes.introFrames + scenes.outroFrames + scenes.items.reduce((a, s) => a + s.durationFrames, 0);
        return { durationInFrames: total, props: { scenes } };
      }}
    />
    <Composition
      id="ClarityLoopTeaser"
      component={TeaserVideo}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ teaser: { fps: FPS, introFrames: 30, outroFrames: 90, vo: "audio/teaser.wav", shots: [] } as Teaser }}
      calculateMetadata={async () => {
        const teaser: Teaser = await (await fetch(staticFile("teaser.json"))).json();
        const last = teaser.shots[teaser.shots.length - 1];
        return { durationInFrames: last.from + last.dur + teaser.outroFrames, props: { teaser } };
      }}
    />
  </>
);
