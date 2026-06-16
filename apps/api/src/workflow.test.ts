import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import { InMemoryRunRepository } from "@clarityloop/storage";
import type { ModelProvider } from "@clarityloop/qwen";

const cannedSpec = {
  id: "wf_quote_v1", name: "Customer Quote", goal: "Produce a defensible customer quote", version: "v1",
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote for", "price for"] },
  steps: [
    {
      id: "s1", name: "Price lookup", purpose: "fetch catalog price",
      action: { type: "tool", toolName: "lookup_catalog", args: {} },
      expectedOutputs: ["unitPrice"], evidenceProduced: ["catalog"], entropyTarget: "evidenceEntropy",
    },
    {
      id: "s2", name: "Draft", purpose: "draft the quote",
      action: { type: "tool", toolName: "draft_quote", args: {} },
      expectedOutputs: ["draftArtifactKey"], evidenceProduced: null, entropyTarget: "commitEntropy",
    },
  ],
  allowedTools: [
    { toolName: "lookup_catalog", defaultArgs: null },
    { toolName: "draft_quote", defaultArgs: null },
  ],
  evidencePolicy: { requiredForClaims: { price: "catalog_or_supplier_quote" }, minimumCoverageForCommit: 0.8 },
  commitPolicy: {
    autoCommitAllowed: true,
    requireApprovalIf: {
      quoteValueAbove: 10000, discountAbovePct: 15, evidenceCoverageBelow: 0.8,
      deliveryUnconfirmed: true, externalSend: true, policyException: true,
    },
    forbiddenActions: ["send_without_review"], commitEntropyThreshold: 0.3,
  },
  memoryPolicy: {
    writeEnabled: true, allowedTypes: ["CustomerPreference"], minMemoryValueToWrite: 0.5,
    defaultTtlDays: 90, maxEntriesPerScope: 100, conflictResolution: "prefer_higher_confidence",
  },
  budgetPolicy: { maxLoopIterations: 8, maxTokens: 20000, maxToolCalls: 12, maxHumanAsks: 2, maxLatencyMs: 60000 },
};

const fakeProvider: ModelProvider = {
  async complete() { return JSON.stringify(cannedSpec); },
};

describe("POST /workflow", () => {
  it("generates, validates, and persists a WorkflowSpec when all tools are authorized", async () => {
    const runs = new InMemoryRunRepository();
    const app = createApp({
      provider: fakeProvider, runs,
      allowedTools: ["retrieve_memory", "lookup_catalog", "check_stock", "parse_supplier_quote", "compare_quote", "draft_quote"],
      newId: () => "run_test_1",
    });
    const res = await app.request("/workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "quote 120 cartons for ABC", domain: "quote" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runId).toBe("run_test_1");
    expect(body.workflowSpec.id).toBe("wf_quote_v1");
    const persisted = await runs.get("run_test_1");
    expect(persisted?.workflowSpec?.trigger.domain).toBe("quote");
    expect(persisted?.inputRequest).toBe("quote 120 cartons for ABC");
  });

  it("rejects with 422 when the generated workflow requests an unauthorized tool", async () => {
    const runs = new InMemoryRunRepository();
    const app = createApp({
      provider: fakeProvider, runs,
      allowedTools: ["retrieve_memory", "lookup_catalog"], // draft_quote intentionally omitted
      newId: () => "run_test_2",
    });
    const res = await app.request("/workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "quote 120 cartons", domain: "quote" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("unauthorized_tool");
    expect(body.unauthorizedTools).toContain("draft_quote");
    expect(await runs.get("run_test_2")).toBeNull();
  });
});
