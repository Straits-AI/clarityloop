import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeProvider: ModelProvider = {
  async complete() {
    return "Audit: approval required because the quote is high-value relative to policy.";
  },
};

const workflowSpec = {
  id: "wf_quote",
  name: "Customer Quote",
  goal: "Produce a customer quote",
  version: "v1",
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote for"] },
  steps: [
    {
      id: "s1",
      name: "lookup",
      purpose: "price",
      action: { type: "tool", toolName: "lookup_catalog", args: {} },
      expectedOutputs: ["price"],
      evidenceProduced: ["catalog"],
      entropyTarget: "evidenceEntropy",
    },
    {
      id: "s2",
      name: "draft",
      purpose: "draft quote",
      action: { type: "tool", toolName: "draft_quote", args: {} },
      expectedOutputs: ["artifact"],
      evidenceProduced: null,
      entropyTarget: "commitEntropy",
    },
  ],
  allowedTools: [
    { toolName: "lookup_catalog", defaultArgs: null },
    { toolName: "draft_quote", defaultArgs: null },
  ],
  evidencePolicy: { requiredForClaims: { price: "catalog_or_supplier_quote" }, minimumCoverageForCommit: 1 },
  commitPolicy: {
    autoCommitAllowed: true,
    requireApprovalIf: {
      quoteValueAbove: 10000,
      discountAbovePct: 20,
      evidenceCoverageBelow: 0.8,
      deliveryUnconfirmed: true,
      externalSend: true,
      policyException: true,
    },
    forbiddenActions: ["bypass_credit_check"],
    commitEntropyThreshold: 0.3,
  },
  memoryPolicy: {
    writeEnabled: true,
    allowedTypes: ["CustomerPreference"],
    minMemoryValueToWrite: 0.5,
    defaultTtlDays: 180,
    maxEntriesPerScope: 100,
    conflictResolution: "prefer_higher_confidence",
  },
  budgetPolicy: { maxLoopIterations: 12, maxTokens: 100000, maxToolCalls: 20, maxHumanAsks: 2, maxLatencyMs: 60000 },
};

const authorityBoundary = {
  autoCommitMaxRiskClass: "L2",
  approvalRequiredFor: ["external_send", "high_value_quote"],
  forbiddenActions: ["bypass_credit_check"],
  allowedTools: [],
};

const cleanBody = {
  runId: "run_1",
  traceId: "trace_1",
  state: {
    goal: "quote 120 cartons",
    workflowVersion: "v1",
    knownFacts: [{ id: "f1", text: "customer ABC", confidence: 0.9 }],
    missingFields: [],
    claims: [{ id: "c1", text: "price 10", evidencePointer: "e1" }],
    riskFlags: [],
    policyFlags: [],
    staleMemoryRefs: [],
    toolFailures: [],
  },
  evidence: [{ id: "e1", kind: "catalog", sourceTool: "lookup_catalog", uri: null, snippet: "unit price 10", confidence: 0.9 }],
  workflowSpec,
  authorityBoundary,
  riskSignals: {
    structuralChange: false,
    legalSensitive: false,
    policyException: false,
    quoteValue: null,
    discountPct: null,
    externalSend: false,
    producesArtifact: true,
    reversible: true,
  },
  draftArtifact: {
    customer: "ABC",
    currency: "MYR",
    lineItems: [{ sku: "A1", description: "carton", quantity: 120, unitPrice: 10, lineTotal: 1200 }],
    total: 1200,
    deliveryDate: "2026-06-20",
  },
  proposedArtifactId: "art_1",
};

describe("POST /commit", () => {
  it("commits a clean, low-risk request", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cleanBody),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.type).toBe("commit");
    expect(body.outcome.type).toBe("committed");
    expect(body.riskClass).toBe("L1");
  });

  it("returns needs_approval with a Qwen-generated summary for a high-value commit", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...cleanBody, riskSignals: { ...cleanBody.riskSignals, quoteValue: 50000 } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.type).toBe("needs_approval");
    expect(body.riskClass).toBe("L3");
    expect(body.decision.approvalPayload.summary).toContain("Audit:");
    expect(body.decision.approvalPayload.runId).toBe("run_1");
    expect(body.decision.approvalPayload.evidence).toHaveLength(1);
  });

  it("400s on a malformed body", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: "x" }),
    });
    expect(res.status).toBe(400);
  });
});
