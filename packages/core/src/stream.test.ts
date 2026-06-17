import { describe, it, expect } from "vitest";
import { EntropyUpdateSchema, EntropyScoreSchema } from "./index";

const okState = {
  goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [],
  claims: [], riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
};
const okEntropy = {
  taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0,
  policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0.5,
};

describe("EntropyScoreSchema", () => {
  it("parses the six entropy components", () => {
    const e = EntropyScoreSchema.parse(okEntropy);
    expect(Object.keys(e).length).toBe(6);
    expect(e.commitEntropy).toBe(0.5);
  });
});

describe("EntropyUpdateSchema", () => {
  it("validates a well-formed entropy update", () => {
    const u = EntropyUpdateSchema.parse({
      step: 0, phase: "scored", state: okState, entropy: okEntropy,
      nextBestAction: "retrieve_memory", note: null,
    });
    expect(u.entropy.commitEntropy).toBe(0.5);
    expect(u.phase).toBe("scored");
    expect(u.nextBestAction).toBe("retrieve_memory");
  });

  it("rejects an unknown phase", () => {
    expect(() =>
      EntropyUpdateSchema.parse({
        step: 0, phase: "bogus", state: okState, entropy: okEntropy,
        nextBestAction: null, note: null,
      }),
    ).toThrow();
  });

  it("rejects a missing nextBestAction key (must be present, may be null)", () => {
    expect(() =>
      EntropyUpdateSchema.parse({
        step: 0, phase: "done", state: okState, entropy: okEntropy, note: null,
      }),
    ).toThrow();
  });
});
