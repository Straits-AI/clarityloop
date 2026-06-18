import { describe, it, expect } from "vitest";
import { buildDemoViewModel } from "./demoViewModel";
import type { ScoringReport } from "@clarityloop/evals";
import type { PromotionReport } from "@clarityloop/core";

const report: ScoringReport = {
  generatedAt: "2026-06-16T00:00:00.000Z",
  caseCount: 36,
  evidenceThreshold: 0.7,
  baselines: [
    { baseline: "bare_qwen", total: 36, taskCompletionRate: 1, falseCommitRate: 0.92, policyViolationRate: 0.14, safeCompletionRate: 0.06, approvalBurden: 0, evidenceCoverage: 0.5, costPerSafeCompletion: 360 },
    { baseline: "dynamic_qwen", total: 36, taskCompletionRate: 1, falseCommitRate: 0.56, policyViolationRate: 0.14, safeCompletionRate: 0.4, approvalBurden: 0, evidenceCoverage: 0.7, costPerSafeCompletion: 100 },
    { baseline: "harness_evolution", total: 36, taskCompletionRate: 1, falseCommitRate: 0.36, policyViolationRate: 0.14, safeCompletionRate: 0.6, approvalBurden: 0, evidenceCoverage: 0.74, costPerSafeCompletion: 80 },
    { baseline: "fixed_gate", total: 36, taskCompletionRate: 0.31, falseCommitRate: 0, policyViolationRate: 0, safeCompletionRate: 0.31, approvalBurden: 0.22, evidenceCoverage: 0.5, costPerSafeCompletion: 110 },
    { baseline: "clarityloop", total: 36, taskCompletionRate: 0.86, falseCommitRate: 0, policyViolationRate: 0, safeCompletionRate: 0.86, approvalBurden: 0.22, evidenceCoverage: 0.82, costPerSafeCompletion: 90 },
  ],
  comparison: { constraintTax: 0.14, safetyGain: 0.36 },
};

const promotion: PromotionReport = {
  fromVersion: "quote-procedure-v1",
  toVersion: "quote-procedure-v2",
  baseline: { safeCompletionRate: 0.75, falseCommitRate: 0, policyViolationRate: 0, approvalBurden: 0.25, evidenceCoverage: 0.78, costPerSafeCompletion: 95, latencyPerSafeCompletion: 0, memoryBloatRate: 0 },
  candidate: { safeCompletionRate: 0.92, falseCommitRate: 0, policyViolationRate: 0, approvalBurden: 0.25, evidenceCoverage: 0.85, costPerSafeCompletion: 90, latencyPerSafeCompletion: 0, memoryBloatRate: 0 },
  caseCount: 36,
};

describe("buildDemoViewModel", () => {
  it("builds three columns from the report and promotion report", () => {
    const vm = buildDemoViewModel(report, promotion);
    expect(vm.baseline.title).toContain("Harness Evolution");
    expect(vm.clarityloop.title).toContain("ClarityLoop");
    expect(vm.promotion.title).toContain("Promotion");
  });

  it("surfaces false-commit and safety-gain figures as percentages", () => {
    const vm = buildDemoViewModel(report, promotion);
    const baselineFalseCommit = vm.baseline.rows.find((r) => r.label === "False commit rate");
    const claritySafetyGain = vm.clarityloop.rows.find((r) => r.label === "Safety gain vs harness");
    expect(baselineFalseCommit?.value).toBe("36.0%"); // harness_evolution false-commit
    expect(claritySafetyGain?.value).toBe("36.0%");
  });
});
