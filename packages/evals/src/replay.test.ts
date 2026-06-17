import { describe, it, expect } from "vitest";
import { runPromotionGate } from "@clarityloop/core";
import type { ToolName, WorkflowSpec, WorkflowStep } from "@clarityloop/core";
import { runReplay, computeProcedureMetrics, runCase } from "./replay";
import { SEED_CASES } from "./cases";

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

// Old: only drafts. New: drafts AND can retrieve memory / look up catalog / compare.
const oldSpec = makeSpec("v1", ["draft_quote"]);
const newSpec = makeSpec("v2", ["draft_quote", "retrieve_memory", "lookup_catalog", "compare_quote"]);

describe("runCase (deterministic)", () => {
  it("old spec false-commits on the stale-memory case", () => {
    const stale = SEED_CASES.find((c) => c.id === "case-stale-price")!;
    const r = runCase(oldSpec, stale);
    expect(r.committed).toBe(true);
    expect(r.falseCommit).toBe(true);
    expect(r.safeCompletion).toBe(false);
  });

  it("new spec safely completes the stale-memory case", () => {
    const stale = SEED_CASES.find((c) => c.id === "case-stale-price")!;
    const r = runCase(newSpec, stale);
    expect(r.falseCommit).toBe(false);
    expect(r.safeCompletion).toBe(true);
  });

  it("old spec asks for missing info on same-as-last-time; new spec completes", () => {
    const c = SEED_CASES.find((x) => x.id === "case-same-as-last-time")!;
    expect(runCase(oldSpec, c).outcome).toBe("needs_more_info");
    expect(runCase(newSpec, c).safeCompletion).toBe(true);
  });
});

describe("runReplay + computeProcedureMetrics", () => {
  it("computes deterministic baseline vs candidate metrics over the seed set", () => {
    const report = runReplay({ fromVersion: "v1", toVersion: "v2", oldSpec, newSpec, cases: SEED_CASES });
    expect(report.caseCount).toBe(4);
    // baseline: only the clear case is safely completed (1/4); stale case is a false commit (1/4)
    expect(report.baseline.safeCompletionRate).toBeCloseTo(0.25, 5);
    expect(report.baseline.falseCommitRate).toBeCloseTo(0.25, 5);
    // candidate: all four safely completed, zero false commits
    expect(report.candidate.safeCompletionRate).toBeCloseTo(1, 5);
    expect(report.candidate.falseCommitRate).toBeCloseTo(0, 5);
  });

  it("is reproducible: identical inputs yield identical metrics", () => {
    const a = runReplay({ fromVersion: "v1", toVersion: "v2", oldSpec, newSpec, cases: SEED_CASES });
    const b = runReplay({ fromVersion: "v1", toVersion: "v2", oldSpec, newSpec, cases: SEED_CASES });
    expect(a).toEqual(b);
  });

  it("feeds runPromotionGate to a promote decision", () => {
    const report = runReplay({ fromVersion: "v1", toVersion: "v2", oldSpec, newSpec, cases: SEED_CASES });
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: report.baseline,
      candidate: report.candidate,
      caseCount: report.caseCount,
    });
    expect(decision.type).toBe("promote");
  });

  it("empty case set yields zeroed rates", () => {
    expect(computeProcedureMetrics([]).safeCompletionRate).toBe(0);
  });
});
