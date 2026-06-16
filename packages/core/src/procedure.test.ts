import { describe, it, expect } from "vitest";
import { EvaluationResultSchema, BusinessProcedureVersionSchema } from "./procedure";

const cannedSpec = {
  id: "wf_quote_v1", name: "Customer Quote", goal: "g", version: "v1",
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote for"] },
  steps: [
    {
      id: "s1", name: "Price", purpose: "p",
      action: { type: "tool", toolName: "lookup_catalog", args: {} },
      expectedOutputs: ["unitPrice"], evidenceProduced: ["catalog"], entropyTarget: "evidenceEntropy",
    },
  ],
  allowedTools: [{ toolName: "lookup_catalog", defaultArgs: null }],
  evidencePolicy: { requiredForClaims: { price: "catalog_or_supplier_quote" }, minimumCoverageForCommit: 0.8 },
  commitPolicy: {
    autoCommitAllowed: true,
    requireApprovalIf: {
      quoteValueAbove: null, discountAbovePct: null, evidenceCoverageBelow: null,
      deliveryUnconfirmed: null, externalSend: null, policyException: null,
    },
    forbiddenActions: [], commitEntropyThreshold: 0.3,
  },
  memoryPolicy: {
    writeEnabled: false, allowedTypes: [], minMemoryValueToWrite: 0.5,
    defaultTtlDays: 30, maxEntriesPerScope: 50, conflictResolution: "prefer_newer",
  },
  budgetPolicy: { maxLoopIterations: 5, maxTokens: 1000, maxToolCalls: 5, maxHumanAsks: 1, maxLatencyMs: 1000 },
};

describe("procedure schemas", () => {
  it("parses an EvaluationResult", () => {
    expect(EvaluationResultSchema.parse({ caseId: "c1", metric: "false_commit_rate", value: 0 }).value).toBe(0);
  });

  it("parses a full BusinessProcedureVersion built from a WorkflowSpec", () => {
    const v = BusinessProcedureVersionSchema.parse({
      id: "pv_quote_v1", parentVersion: null, name: "Customer Quote", goal: "g",
      workflowSpec: cannedSpec,
      allowedTools: [{ toolName: "lookup_catalog", level: "read_only", maxRiskClass: "L0", constraints: null }],
      authorityBoundary: {
        autoCommitMaxRiskClass: "L1", approvalRequiredFor: ["external_send"],
        forbiddenActions: ["wire_funds"],
        allowedTools: [{ toolName: "lookup_catalog", level: "read_only", maxRiskClass: "L0", constraints: null }],
      },
      evidencePolicy: cannedSpec.evidencePolicy,
      riskClass: "L1",
      commitPolicy: cannedSpec.commitPolicy,
      memoryPolicy: cannedSpec.memoryPolicy,
      evalResults: [],
      approvalRecord: null,
      rollbackPointer: null,
      runTraces: [],
      createdAt: "2026-06-16T00:00:00Z",
      promotedAt: null,
    });
    expect(v.workflowSpec.trigger.domain).toBe("quote");
    expect(v.riskClass).toBe("L1");
  });
});
