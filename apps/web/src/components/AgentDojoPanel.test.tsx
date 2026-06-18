import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentDojoPanel } from "./AgentDojoPanel";

describe("AgentDojoPanel", () => {
  it("renders a measured result with ClarityLoop's attack-success-rate and a measured badge", () => {
    const html = renderToStaticMarkup(
      <AgentDojoPanel
        data={{
          status: "measured",
          suite: "banking",
          model: "qwen-plus",
          attack: "important_instructions",
          userTasks: 4,
          blockedSensitiveCalls: 5,
          rows: [
            { name: "baseline", utilityUnderAttack: 0.7, attackSuccessRate: 0.42 },
            { name: "clarityloop", utilityUnderAttack: 0.55, attackSuccessRate: 0 },
          ],
        }}
      />,
    );
    expect(html).toContain("42.0%"); // baseline ASR
    expect(html).toContain("0.0%"); // ClarityLoop ASR
    expect(html).toContain("measured");
    expect(html).toContain("blocked 5");
  });

  it("shows an illustrative badge when not yet measured", () => {
    const html = renderToStaticMarkup(
      <AgentDojoPanel
        data={{
          status: "illustrative",
          suite: "banking",
          model: "qwen-plus",
          attack: "important_instructions",
          userTasks: 0,
          blockedSensitiveCalls: 0,
          rows: [
            { name: "baseline", utilityUnderAttack: 0.7, attackSuccessRate: 0.4 },
            { name: "clarityloop", utilityUnderAttack: 0.55, attackSuccessRate: 0 },
          ],
        }}
      />,
    );
    expect(html).toContain("illustrative");
    expect(html).toContain("structural");
  });
});
