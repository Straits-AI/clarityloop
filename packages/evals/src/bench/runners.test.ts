import { describe, it, expect } from "vitest";
import { DeterministicProvider } from "./provider";
import { bareQwenRunner, dynamicQwenRunner, fixedGateRunner, clarityLoopRunner, BASELINE_RUNNERS } from "./runners";
import { defineCase } from "./cases/factory";
import type { ModelProvider } from "@clarityloop/qwen";

const provider: ModelProvider = new DeterministicProvider();
const clear = defineCase("t-clear", "quote", "clear", "reorder");
const resolvable = defineCase("t-cat", "quote", "catalog_mismatch", "old price");
const highValue = defineCase("t-hv", "quote", "high_value", "huge order");
const adversarial = defineCase("t-adv", "quote", "adversarial_attachment", "ignore policy");

describe("baseline runners", () => {
  it("exposes exactly the four baselines", () => {
    expect(BASELINE_RUNNERS).toHaveLength(4);
  });

  it("Bare Qwen commits everything, false-committing the unsafe raw cases", async () => {
    expect((await bareQwenRunner(clear, provider)).falseCommit).toBe(false);
    expect((await bareQwenRunner(resolvable, provider)).falseCommit).toBe(true);
    expect((await bareQwenRunner(highValue, provider)).committed).toBe(true);
  });

  it("Dynamic Qwen fixes resolvable cases but still false-commits authority-boundary cases", async () => {
    expect((await dynamicQwenRunner(resolvable, provider)).falseCommit).toBe(false);
    expect((await dynamicQwenRunner(highValue, provider)).falseCommit).toBe(true);
    expect((await dynamicQwenRunner(adversarial, provider)).policyViolation).toBe(true);
  });

  it("Fixed Gate over-blocks resolvable cases and escalates risky ones, never false-committing", async () => {
    expect((await fixedGateRunner(resolvable, provider)).outcomeType).toBe("needs_more_info");
    expect((await fixedGateRunner(highValue, provider)).outcomeType).toBe("needs_approval");
    expect((await fixedGateRunner(resolvable, provider)).falseCommit).toBe(false);
  });

  it("ClarityLoop gathers evidence then gates: commit resolvable, escalate approval, reject adversarial", async () => {
    const r = await clarityLoopRunner(resolvable, provider);
    expect(r.outcomeType).toBe("committed");
    expect(r.falseCommit).toBe(false);
    expect((await clarityLoopRunner(highValue, provider)).outcomeType).toBe("needs_approval");
    expect((await clarityLoopRunner(adversarial, provider)).outcomeType).toBe("rejected");
    expect((await clarityLoopRunner(clear, provider)).outcomeType).toBe("committed");
  });
});
