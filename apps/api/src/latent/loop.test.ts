import { describe, it, expect } from "vitest";
import { runLatentLoop, demoEntropySequence } from "./loop";
import { EntropyUpdateSchema } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeState = {
  knownFacts: [{ id: "f1", text: "customer ABC", confidence: 0.9 }],
  missingFields: [{ id: "m1", name: "exact_sku", necessity: "required" }],
  claims: [{ id: "c1", text: "unit price 100", evidencePointer: null }],
  riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
};
const fakeProvider: ModelProvider = { async complete() { return JSON.stringify(fakeState); } };

describe("runLatentLoop", () => {
  it("extracts, scores, and emits entropy updates (fake provider)", async () => {
    const updates = [];
    for await (const u of runLatentLoop(fakeProvider, {
      request: "quote 120 cartons", workflowVersion: "v1", goal: "draft a customer quote",
    })) {
      updates.push(u);
    }
    expect(updates.length).toBe(2);
    expect(updates[0].state.goal).toBe("draft a customer quote"); // code-set
    expect(updates[0].state.workflowVersion).toBe("v1");
    // missing required (0.25) + 1/1 unsupported claim (0.25) = 0.5
    expect(updates[0].entropy.commitEntropy).toBeCloseTo(0.5, 5);
    expect(updates[0].phase).toBe("scored");
    expect(updates[updates.length - 1].phase).toBe("done");
    for (const u of updates) expect(EntropyUpdateSchema.safeParse(u).success).toBe(true);
  });
});

describe("demoEntropySequence", () => {
  it("emits a strictly decreasing commit-entropy sequence ending in done", () => {
    const seq = demoEntropySequence();
    expect(seq.length).toBe(4);
    for (const u of seq) expect(EntropyUpdateSchema.safeParse(u).success).toBe(true);
    const commits = seq.map((u) => u.entropy.commitEntropy);
    expect(commits[0]).toBeCloseTo(0.81875, 5); // ≈0.82
    expect(commits[1]).toBeCloseTo(0.44375, 5); // ≈0.44
    expect(commits[2]).toBeCloseTo(0.18125, 5); // ≈0.18
    expect(commits[0]).toBeGreaterThan(commits[1]);
    expect(commits[1]).toBeGreaterThan(commits[2]);
    expect(seq[3].phase).toBe("done");
    expect(seq[0].nextBestAction).toBe("retrieve_memory");
  });
});
