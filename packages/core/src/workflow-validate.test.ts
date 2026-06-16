import { describe, it, expect } from "vitest";
import { AuthorityBoundarySchema } from "./governance";
import { assertWorkflowToolsAuthorized, UnauthorizedToolError } from "./workflow-validate";
import { WorkflowSpecSchema, type WorkflowSpec } from "./workflow";

const spec: WorkflowSpec = WorkflowSpecSchema.parse({
  id: "wf_quote_v1", name: "Customer Quote", goal: "g", version: "v1",
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote for"] },
  steps: [
    {
      id: "s1", name: "Price", purpose: "p",
      action: { type: "tool", toolName: "lookup_catalog", args: {} },
      expectedOutputs: ["unitPrice"], evidenceProduced: ["catalog"], entropyTarget: "evidenceEntropy",
    },
    {
      id: "s2", name: "Draft", purpose: "p",
      action: { type: "tool", toolName: "draft_quote", args: {} },
      expectedOutputs: ["artifactKey"], evidenceProduced: null, entropyTarget: "commitEntropy",
    },
  ],
  allowedTools: [
    { toolName: "retrieve_memory", defaultArgs: null },
    { toolName: "lookup_catalog", defaultArgs: null },
    { toolName: "draft_quote", defaultArgs: null },
  ],
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
});

describe("AuthorityBoundarySchema", () => {
  it("parses a governed authority boundary", () => {
    const ab = AuthorityBoundarySchema.parse({
      autoCommitMaxRiskClass: "L1",
      approvalRequiredFor: ["external_send", "high_value_quote"],
      forbiddenActions: ["wire_funds"],
      allowedTools: [{ toolName: "lookup_catalog", level: "read_only", maxRiskClass: "L0", constraints: null }],
    });
    expect(ab.autoCommitMaxRiskClass).toBe("L1");
  });
});

describe("assertWorkflowToolsAuthorized", () => {
  it("accepts a spec whose declared + step tools are all in the allow-list", () => {
    expect(() =>
      assertWorkflowToolsAuthorized(spec, ["retrieve_memory", "lookup_catalog", "draft_quote"]),
    ).not.toThrow();
  });

  it("throws UnauthorizedToolError naming the offending tool", () => {
    try {
      assertWorkflowToolsAuthorized(spec, ["retrieve_memory", "lookup_catalog"]);
      throw new Error("expected assertWorkflowToolsAuthorized to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(UnauthorizedToolError);
      expect((e as UnauthorizedToolError).unauthorizedTools).toContain("draft_quote");
    }
  });
});
