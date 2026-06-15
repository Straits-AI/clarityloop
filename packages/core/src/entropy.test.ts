import { describe, it, expect } from "vitest";
import { scoreEntropy } from "./entropy";
import type { LatentWorkflowState } from "./types";

const empty: LatentWorkflowState = {
  goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [],
  claims: [], riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
};

describe("scoreEntropy", () => {
  it("returns zero commit entropy for a fully-resolved state", () => {
    const s = scoreEntropy({
      ...empty,
      knownFacts: [{ id: "f1", text: "x", confidence: 1 }],
      claims: [{ id: "c1", text: "price 100", evidencePointer: "e1" }],
    });
    expect(s.commitEntropy).toBe(0);
  });

  it("raises commit entropy when a required field is missing", () => {
    const s = scoreEntropy({
      ...empty,
      missingFields: [{ id: "m1", name: "sku", necessity: "required" }],
    });
    expect(s.commitEntropy).toBeCloseTo(0.25, 5);
  });

  it("raises commit entropy when a claim is unsupported", () => {
    const s = scoreEntropy({
      ...empty,
      claims: [{ id: "c1", text: "price 100", evidencePointer: null }],
    });
    expect(s.commitEntropy).toBeCloseTo(0.25, 5);
  });

  it("never returns a value above 1", () => {
    const s = scoreEntropy({
      ...empty,
      missingFields: [{ id: "m1", name: "sku", necessity: "required" }],
      claims: [{ id: "c1", text: "x", evidencePointer: null }],
      policyFlags: [{ id: "p1", rule: "discount", ambiguous: true }],
      staleMemoryRefs: ["mem1"],
      toolFailures: ["tool1"],
    });
    expect(s.commitEntropy).toBeLessThanOrEqual(1);
  });
});
