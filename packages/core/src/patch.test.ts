import { describe, it, expect } from "vitest";
import { WorkflowPatchSchema, applyPatch } from "./patch";
import type { WorkflowSpec, WorkflowStep } from "./types";

const toolStep = (id: string, toolName: string): WorkflowStep => ({
  id,
  name: id,
  purpose: `run ${toolName}`,
  action: { type: "tool", toolName: toolName as WorkflowStep["action"] extends { toolName: infer T } ? T : never, args: {} } as WorkflowStep["action"],
  expectedOutputs: ["out"],
  evidenceProduced: null,
  entropyTarget: "evidenceEntropy",
});

const baseSpec: WorkflowSpec = {
  id: "spec-1",
  name: "customer-quote",
  goal: "produce a safe quote",
  version: "v1",
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote"] },
  steps: [
    {
      id: "s_parse",
      name: "parse",
      purpose: "parse request",
      action: { type: "model", promptTemplate: "parse" },
      expectedOutputs: ["facts"],
      evidenceProduced: null,
      entropyTarget: "taskEntropy",
    },
    toolStep("s_draft", "draft_quote"),
  ],
  allowedTools: [{ toolName: "draft_quote", defaultArgs: null }],
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
  budgetPolicy: {
    maxLoopIterations: 8,
    maxTokens: 20000,
    maxToolCalls: 12,
    maxHumanAsks: 2,
    maxLatencyMs: 60000,
  },
};

describe("WorkflowPatchSchema", () => {
  it("rejects a patch with an empty ops array", () => {
    expect(() =>
      WorkflowPatchSchema.parse({
        id: "p1",
        rationale: "x",
        triggerCondition: "always",
        sourceTraceId: null,
        ops: [],
        expectedEntropyReduction: 0.1,
      }),
    ).toThrow();
  });
});

describe("applyPatch", () => {
  it("inserts a step after the named step and bumps the version immutably", () => {
    const patch = WorkflowPatchSchema.parse({
      id: "p1",
      rationale: "retrieve memory before drafting for 'same as last time'",
      triggerCondition: "inquiry contains 'same as last time'",
      sourceTraceId: "trace_001",
      ops: [
        {
          op: "insert_step",
          afterStepId: "s_parse",
          step: toolStep("s_retrieve", "retrieve_memory"),
        },
      ],
      expectedEntropyReduction: 0.31,
    });
    const next = applyPatch(baseSpec, patch);
    expect(next.steps.map((s) => s.id)).toEqual(["s_parse", "s_retrieve", "s_draft"]);
    expect(next.version).toBe("v2");
    // immutability: original untouched
    expect(baseSpec.steps.map((s) => s.id)).toEqual(["s_parse", "s_draft"]);
  });

  it("inserts at the front when afterStepId is null", () => {
    const patch = WorkflowPatchSchema.parse({
      id: "p2",
      rationale: "front insert",
      triggerCondition: "always",
      sourceTraceId: null,
      ops: [{ op: "insert_step", afterStepId: null, step: toolStep("s_first", "lookup_catalog") }],
      expectedEntropyReduction: 0.1,
    });
    expect(applyPatch(baseSpec, patch).steps[0].id).toBe("s_first");
  });

  it("sets the commit threshold via set_commit_threshold", () => {
    const patch = WorkflowPatchSchema.parse({
      id: "p3",
      rationale: "tighten",
      triggerCondition: "always",
      sourceTraceId: null,
      ops: [{ op: "set_commit_threshold", commitEntropyThreshold: 0.2 }],
      expectedEntropyReduction: 0.0,
    });
    expect(applyPatch(baseSpec, patch).commitPolicy.commitEntropyThreshold).toBe(0.2);
  });

  it("throws when removing a step that does not exist", () => {
    const patch = WorkflowPatchSchema.parse({
      id: "p4",
      rationale: "bad",
      triggerCondition: "always",
      sourceTraceId: null,
      ops: [{ op: "remove_step", stepId: "nope" }],
      expectedEntropyReduction: 0.0,
    });
    expect(() => applyPatch(baseSpec, patch)).toThrow(/not found/);
  });
});
