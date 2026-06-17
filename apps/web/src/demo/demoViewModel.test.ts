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
    { baseline: "dynamic_qwen", total: 36, taskCompletionRate: 1, falseCommitRate: 0.33, policyViolationRate: 0.14, safeCompletionRate: 0.6, approvalBurden: 0, evidenceCoverage: 0.74, costPerSafeCompletion: 80 },
    { baseline: "fixed_gate", total: 36, taskCompletionRate: 0.33, falseCommitRate: 0, policyViolationRate: 0, safeCompletionRate: 0.33, approvalBurden: 0.33, evidenceCoverage: 0.5, costPerSafeCompletion: 110 },
    { baseline: "clarityloop", total: 36, taskCompletionRate: 0.92, falseCommitRate: 0, policyViolationRate: 0, safeCompletionRate: 0.92, approvalBurden: 0.25, evidenceCoverage: 0.85, costPerSafeCompletion: 90 },
  ],
  comparison: { constraintTax: 0.08, safetyGain: 0.33 },
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
    expect(vm.baseline.title).toContain("Dynamic Qwen");
    expect(vm.clarityloop.title).toContain("ClarityLoop");
    expect(vm.promotion.title).toContain("Promotion");
  });

  it("surfaces false-commit and safety-gain figures as percentages", () => {
    const vm = buildDemoViewModel(report, promotion);
    const baselineFalseCommit = vm.baseline.rows.find((r) => r.label === "False commit rate");
    const claritySafetyGain = vm.clarityloop.rows.find((r) => r.label === "Safety gain vs dynamic");
    expect(baselineFalseCommit?.value).toBe("33.0%");
    expect(claritySafetyGain?.value).toBe("33.0%");
  });
});
