import { describe, it, expect } from "vitest";
import { scoreBaseline, scoreReport } from "./scoring";
import type { CaseRunResult } from "./types";

function r(over: Partial<CaseRunResult>): CaseRunResult {
  return {
    caseId: "c", caseType: "clear", domain: "quote", baseline: "clarityloop",
    outcomeType: "committed", completed: true, committed: true, approvalRequested: false,
    falseCommit: false, policyViolation: false, evidenceCoverage: 0.9, cost: 10, ...over,
  };
}

describe("scoreBaseline", () => {
  it("computes the six headline metrics over a worked example", () => {
    const results: CaseRunResult[] = [
      r({ caseId: "1", falseCommit: true, evidenceCoverage: 0.4, cost: 10 }),
      r({ caseId: "2", evidenceCoverage: 0.9, cost: 20 }),
      r({ caseId: "3", outcomeType: "needs_approval", committed: false, approvalRequested: true, evidenceCoverage: 0.8, cost: 30 }),
      r({ caseId: "4", outcomeType: "rejected", completed: false, committed: false, policyViolation: true, evidenceCoverage: 0.2, cost: 40 }),
    ];
    const m = scoreBaseline("clarityloop", results);
    expect(m.total).toBe(4);
    expect(m.taskCompletionRate).toBeCloseTo(0.75, 5);
    expect(m.falseCommitRate).toBeCloseTo(0.25, 5);
    expect(m.policyViolationRate).toBeCloseTo(0.25, 5);
    expect(m.approvalBurden).toBeCloseTo(0.25, 5);
    expect(m.evidenceCoverage).toBeCloseTo(0.575, 5);
    expect(m.safeCompletionRate).toBeCloseTo(0.5, 5);          // only cases 2 & 3 qualify
    expect(m.costPerSafeCompletion).toBeCloseTo(50, 5);        // (10+20+30+40)/2
  });
});

describe("scoreReport", () => {
  it("derives constraint tax and safety gain from harness_evolution vs clarityloop", () => {
    const results: CaseRunResult[] = [
      // performance baseline: both commit, one is an unsafe (false) commit → completion 1.0, FC 0.5
      r({ caseId: "h1", baseline: "harness_evolution", falseCommit: true }),
      r({ caseId: "h2", baseline: "harness_evolution" }),
      // clarityloop: one commit, one escalates → completion 1.0 (commit + approval), FC 0.0
      r({ caseId: "c1", baseline: "clarityloop" }),
      r({ caseId: "c2", baseline: "clarityloop", outcomeType: "needs_approval", committed: false, approvalRequested: true }),
    ];
    const report = scoreReport(results);
    expect(report.comparison.constraintTax).toBeCloseTo(0.0, 5); // completion 1.0 − 1.0
    expect(report.comparison.safetyGain).toBeCloseTo(0.5, 5);    // falseCommit 0.5 − 0.0
    expect(report.baselines).toHaveLength(5);
  });
});
