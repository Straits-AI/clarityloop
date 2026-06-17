import { describe, it, expect } from "vitest";
import { scoreMemoryValue } from "./value";

describe("scoreMemoryValue", () => {
  it("computes the memo §16 value formula deterministically", () => {
    const v = scoreMemoryValue({
      expectedFutureEntropyReduction: 0.5,
      expectedReuseFrequency: 4,
      evidenceConfidence: 0.9,
      retrievalNoiseCost: 0.2,
      stalenessRisk: 0.1,
      storageCost: 0.05,
    });
    // 0.5 * 4 * 0.9 - 0.2 - 0.1 - 0.05 = 1.8 - 0.35 = 1.45
    expect(v).toBeCloseTo(1.45, 5);
  });

  it("can be negative for low-value memories", () => {
    const v = scoreMemoryValue({
      expectedFutureEntropyReduction: 0.01,
      expectedReuseFrequency: 1,
      evidenceConfidence: 0.5,
      retrievalNoiseCost: 0.3,
      stalenessRisk: 0.3,
      storageCost: 0.1,
    });
    expect(v).toBeLessThan(0);
  });
});
