import { describe, it, expect } from "vitest";
import type { ModelProvider } from "@clarityloop/qwen";
import type { BusinessProcedureVersion, ToolName, WorkflowSpec, WorkflowStep } from "@clarityloop/core";
import { proposeWorkflowPatch, improveAndEvaluate, type FailureContext } from "./improve";
import { SEED_CASES } from "./cases";

const fakeProvider = (reply: string): ModelProvider => ({ async complete() { return reply; } });

const toolStep = (id: string, toolName: ToolName): WorkflowStep => ({
  id,
  name: id,
  purpose: `run ${toolName}`,
  action: { type: "tool", toolName, args: {} },
  expectedOutputs: ["out"],
  evidenceProduced: null,
  entropyTarget: "evidenceEntropy",
});

const makeSpec = (version: string, tools: ToolName[]): WorkflowSpec => ({
  id: `spec-${version}`,
  name: "customer-quote",
  goal: "produce a safe quote",
  version,
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote"] },
  steps: [
    {
      id: "s_parse",
      name: "parse",
      purpose: "parse",
      action: { type: "model", promptTemplate: "parse" },
      expectedOutputs: ["facts"],
      evidenceProduced: null,
      entropyTarget: "taskEntropy",
    },
    ...tools.map((t) => toolStep(`s_${t}`, t)),
  ],
  allowedTools: tools.map((toolName) => ({ toolName, defaultArgs: null })),
  evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
  commitPolicy: {
    autoCommitAllowed: true,
    requireApprovalIf: {
      quoteValueAbove: null,
      discountAbovePct: null,
      evidenceCoverageBelow: null,
      deliveryUnconfirmed: null,
      externalSend: null,
      policyException: null,
    },
    forbiddenActions: [],
    commitEntropyThreshold: 0.3,
  },
  memoryPolicy: {
    writeEnabled: true,
    allowedTypes: ["CustomerPreference"],
    minMemoryValueToWrite: 0.1,
    defaultTtlDays: 180,
    maxEntriesPerScope: 50,
    conflictResolution: "prefer_higher_confidence",
  },
  budgetPolicy: { maxLoopIterations: 8, maxTokens: 20000, maxToolCalls: 12, maxHumanAsks: 2, maxLatencyMs: 60000 },
});

const patchJson = JSON.stringify({
  id: "patch-1",
  rationale: "add evidence-gathering tools before drafting",
  triggerCondition: "inquiry contains 'same as last time' or 'usual price'",
  sourceTraceId: "trace_001",
  expectedEntropyReduction: 0.31,
  ops: [
    { op: "insert_step", afterStepId: "s_parse", step: { id: "s_retrieve_memory", name: "retrieve", purpose: "memory", action: { type: "tool", toolName: "retrieve_memory", args: {} }, expectedOutputs: ["mem"], evidenceProduced: null, entropyTarget: "memoryEntropy" } },
    { op: "insert_step", afterStepId: "s_retrieve_memory", step: { id: "s_lookup_catalog", name: "catalog", purpose: "price", action: { type: "tool", toolName: "lookup_catalog", args: {} }, expectedOutputs: ["price"], evidenceProduced: null, entropyTarget: "evidenceEntropy" } },
    { op: "insert_step", afterStepId: "s_lookup_catalog", step: { id: "s_compare_quote", name: "compare", purpose: "reconcile", action: { type: "tool", toolName: "compare_quote", args: {} }, expectedOutputs: ["deltas"], evidenceProduced: null, entropyTarget: "evidenceEntropy" } },
  ],
});

const failureContext: FailureContext = {
  procedureVersionId: "pv-1",
  domain: "quote",
  traceId: "trace_001",
  failureSummary: "drafted a quote with stale price and assumed SKU",
  finalEntropy: { taskEntropy: 0.5, evidenceEntropy: 0.4, actionEntropy: 0.45, policyEntropy: 0, memoryEntropy: 1, commitEntropy: 0.4 },
  outcomeType: "committed",
  currentSteps: makeSpec("v1", ["draft_quote"]).steps,
};

describe("proposeWorkflowPatch", () => {
  it("parses and validates a fenced-JSON patch from the model", async () => {
    const provider = fakeProvider("```json\n" + patchJson + "\n```");
    const patch = await proposeWorkflowPatch(provider, failureContext);
    expect(patch.ops).toHaveLength(3);
    expect(patch.ops[0].op).toBe("insert_step");
  });

  it("throws on a structurally invalid patch", async () => {
    const provider = fakeProvider('{"id":"x","ops":[]}');
    await expect(proposeWorkflowPatch(provider, failureContext)).rejects.toThrow();
  });
});

describe("improveAndEvaluate", () => {
  it("ties patch -> applyPatch -> replay -> gate into a promote decision", async () => {
    const provider = fakeProvider(patchJson);
    const oldVersion = {
      id: "pv-1",
      parentVersion: null,
      name: "customer-quote",
      goal: "produce a safe quote",
      workflowSpec: makeSpec("v1", ["draft_quote"]),
      allowedTools: [{ toolName: "draft_quote", level: "draft", maxRiskClass: "L1", constraints: null }],
      authorityBoundary: { autoCommitMaxRiskClass: "L1", approvalRequiredFor: [], forbiddenActions: [], allowedTools: [] },
      evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
      riskClass: "L1",
      commitPolicy: makeSpec("v1", ["draft_quote"]).commitPolicy,
      memoryPolicy: makeSpec("v1", ["draft_quote"]).memoryPolicy,
      evalResults: [],
      approvalRecord: null,
      rollbackPointer: null,
      runTraces: [],
      createdAt: "2026-06-16T00:00:00Z",
      promotedAt: null,
    } as unknown as BusinessProcedureVersion;

    const result = await improveAndEvaluate({ provider, oldVersion, failureContext, cases: SEED_CASES });
    expect(result.patch.ops).toHaveLength(3);
    expect(result.newSpec.version).toBe("v2");
    expect(result.decision.type).toBe("promote");
  });
});
