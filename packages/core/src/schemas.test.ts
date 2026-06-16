import { describe, it, expect } from "vitest";
import { LatentWorkflowStateSchema } from "./schemas";

describe("LatentWorkflowStateSchema", () => {
  it("parses a minimal valid latent state", () => {
    const parsed = LatentWorkflowStateSchema.parse({
      goal: "quote 120 cartons",
      workflowVersion: "v1",
      knownFacts: [{ id: "f1", text: "customer is ABC", confidence: 0.9 }],
      missingFields: [{ id: "m1", name: "exact_sku", necessity: "required" }],
      claims: [{ id: "c1", text: "price is 100", evidencePointer: null }],
      riskFlags: [],
      policyFlags: [],
      staleMemoryRefs: [],
      toolFailures: [],
    });
    expect(parsed.missingFields[0].name).toBe("exact_sku");
  });

  it("rejects a claim missing the evidencePointer key", () => {
    expect(() =>
      LatentWorkflowStateSchema.parse({
        goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [],
        claims: [{ id: "c1", text: "x" }], riskFlags: [], policyFlags: [],
        staleMemoryRefs: [], toolFailures: [],
      })
    ).toThrow();
  });
});
