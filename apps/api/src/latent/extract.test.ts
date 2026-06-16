import { describe, it, expect } from "vitest";
import { extractLatentState } from "./extract";
import type { ModelProvider } from "@clarityloop/qwen";

describe("extractLatentState", () => {
  it("returns a validated LatentWorkflowState with code-authoritative goal/version", async () => {
    const provider: ModelProvider = {
      async complete() {
        // Model TRIES to set goal/version + emits structure. goal/version must be overridden.
        return "```json\n" + JSON.stringify({
          goal: "MODEL TRIED TO SET THIS",
          workflowVersion: "model-version",
          knownFacts: [{ id: "f1", text: "customer ABC", confidence: 0.8 }],
          missingFields: [{ id: "m1", name: "exact_sku", necessity: "required" }],
          claims: [{ id: "c1", text: "unit price 100", evidencePointer: null }],
          riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
        }) + "\n```";
      },
    };
    const state = await extractLatentState(provider, {
      request: "same as last time, 120 cartons",
      workflowVersion: "v1",
      goal: "draft a customer quote",
    });
    expect(state.goal).toBe("draft a customer quote");   // code-set, not model
    expect(state.workflowVersion).toBe("v1");            // code-set, not model
    expect(state.missingFields[0].name).toBe("exact_sku");
    expect(state.claims[0].evidencePointer).toBeNull();
  });

  it("throws when the model omits required structure", async () => {
    const provider: ModelProvider = { async complete() { return '{"knownFacts":[]}'; } };
    await expect(
      extractLatentState(provider, { request: "r", workflowVersion: "v1", goal: "g" }),
    ).rejects.toThrow();
  });
});
