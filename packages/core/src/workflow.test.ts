import { describe, it, expect } from "vitest";
import { WorkflowSpecSchema, WorkflowStepActionSchema } from "./workflow";

const cannedSpec = {
  id: "wf_quote_v1",
  name: "Customer Quote",
  goal: "Produce a defensible customer quote",
  version: "v1",
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote for", "price for"] },
  steps: [
    {
      id: "s1", name: "Recall preferences", purpose: "load known customer prefs",
      action: { type: "tool", toolName: "retrieve_memory", args: {} },
      expectedOutputs: ["customerPreferences"], evidenceProduced: ["approved_memory"],
      entropyTarget: "memoryEntropy",
    },
    {
      id: "s2", name: "Price lookup", purpose: "fetch catalog price",
      action: { type: "tool", toolName: "lookup_catalog", args: {} },
      expectedOutputs: ["unitPrice"], evidenceProduced: ["catalog"], entropyTarget: "evidenceEntropy",
    },
    {
      id: "s3", name: "Draft", purpose: "draft the quote",
      action: { type: "tool", toolName: "draft_quote", args: {} },
      expectedOutputs: ["draftArtifactKey"], evidenceProduced: null, entropyTarget: "commitEntropy",
    },
    {
      id: "s4", name: "Reconcile", purpose: "verify totals",
      action: { type: "verifier", verifierName: "numeric_reconciliation" },
      expectedOutputs: ["checks"], evidenceProduced: null, entropyTarget: null,
    },
  ],
  allowedTools: [
    { toolName: "retrieve_memory", defaultArgs: null },
    { toolName: "lookup_catalog", defaultArgs: null },
    { toolName: "draft_quote", defaultArgs: null },
  ],
  evidencePolicy: {
    requiredForClaims: {
      price: "catalog_or_supplier_quote",
      discount: "pricing_policy",
      delivery: "stock_or_logistics_source",
      customerPreference: "approved_memory_or_prior_order",
      supplierComparison: "uploaded_supplier_quote",
    },
    minimumCoverageForCommit: 0.8,
  },
  commitPolicy: {
    autoCommitAllowed: true,
    requireApprovalIf: {
      quoteValueAbove: 10000, discountAbovePct: 15, evidenceCoverageBelow: 0.8,
      deliveryUnconfirmed: true, externalSend: true, policyException: true,
    },
    forbiddenActions: ["send_without_review"],
    // commitEntropyThreshold intentionally omitted to exercise the default
  },
  memoryPolicy: {
    writeEnabled: true,
    allowedTypes: ["CustomerPreference", "EvidenceSource"],
    minMemoryValueToWrite: 0.5,
    defaultTtlDays: 90,
    maxEntriesPerScope: 100,
    conflictResolution: "prefer_higher_confidence",
  },
  budgetPolicy: {
    maxLoopIterations: 8, maxTokens: 20000, maxToolCalls: 12, maxHumanAsks: 2, maxLatencyMs: 60000,
  },
};

describe("WorkflowSpecSchema", () => {
  it("parses a full, valid quote WorkflowSpec", () => {
    const spec = WorkflowSpecSchema.parse(cannedSpec);
    expect(spec.trigger.domain).toBe("quote");
    expect(spec.steps).toHaveLength(4);
    expect(spec.allowedTools.map((t) => t.toolName)).toContain("draft_quote");
  });

  it("applies the commitEntropyThreshold default of 0.3 when omitted", () => {
    const spec = WorkflowSpecSchema.parse(cannedSpec);
    expect(spec.commitPolicy.commitEntropyThreshold).toBe(0.3);
  });

  it("rejects a tool step that references a tool outside the ToolName enum", () => {
    expect(() =>
      WorkflowStepActionSchema.parse({ type: "tool", toolName: "delete_database", args: {} }),
    ).toThrow();
  });
});
