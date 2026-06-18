import { Composition, staticFile } from "remotion";
import { Demo, type Scenes } from "./Demo";

const FPS = 30;
export const RemotionRoot: React.FC = () => (
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
      const total =
        scenes.introFrames +
        scenes.outroFrames +
        scenes.items.reduce((a, s) => a + s.durationFrames, 0);
      return { durationInFrames: total, props: { scenes } };
    }}
  />
);
