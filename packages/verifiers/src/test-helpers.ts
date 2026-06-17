import type { LatentWorkflowState, WorkflowSpec } from "@clarityloop/core";

export function makeState(overrides: Partial<LatentWorkflowState> = {}): LatentWorkflowState {
  const base: LatentWorkflowState = {
    goal: "quote 120 cartons",
    workflowVersion: "v1",
    knownFacts: [],
    missingFields: [],
    claims: [],
    riskFlags: [],
    policyFlags: [],
    staleMemoryRefs: [],
    toolFailures: [],
  };
  return { ...base, ...overrides };
}

export function makeWorkflowSpec(overrides: Partial<WorkflowSpec> = {}): WorkflowSpec {
  const base: WorkflowSpec = {
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
    evidencePolicy: {
      requiredForClaims: { price: "catalog_or_supplier_quote" },
      minimumCoverageForCommit: 1,
    },
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
    budgetPolicy: {
      maxLoopIterations: 12,
      maxTokens: 100000,
      maxToolCalls: 20,
      maxHumanAsks: 2,
      maxLatencyMs: 60000,
    },
  };
  return { ...base, ...overrides };
}
