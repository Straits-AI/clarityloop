import { describe, it, expect } from "vitest";
import { runPromotionGate, type ProcedureMetrics } from "./promotion";

const metrics = (over: Partial<ProcedureMetrics>): ProcedureMetrics => ({
  safeCompletionRate: 0.5,
  falseCommitRate: 0.2,
  policyViolationRate: 0.0,
  approvalBurden: 0.3,
  evidenceCoverage: 0.9,
  costPerSafeCompletion: 100,
  latencyPerSafeCompletion: 100,
  memoryBloatRate: 0.0,
  ...over,
});

describe("runPromotionGate", () => {
  it("promotes when safety improves with no regression and within budget", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({}),
      candidate: metrics({ safeCompletionRate: 0.8, falseCommitRate: 0.05, costPerSafeCompletion: 90 }),
      caseCount: 10,
    });
    expect(decision.type).toBe("promote");
    if (decision.type === "promote") {
      expect(decision.fromVersion).toBe("v1");
      expect(decision.toVersion).toBe("v2");
      expect(decision.report.candidate.falseCommitRate).toBe(0.05);
      expect(decision.report.caseCount).toBe(10);
    }
  });

  it("rejects with a regression report when false commits go up", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({ falseCommitRate: 0.1 }),
      candidate: metrics({ falseCommitRate: 0.3 }),
      caseCount: 10,
    });
    expect(decision.type).toBe("reject");
    if (decision.type === "reject") {
      expect(decision.regressionReport.regressions.some((r) => r.metric === "falseCommitRate")).toBe(true);
      expect(decision.regressionReport.regressions[0].before).toBe(0.1);
      expect(decision.regressionReport.regressions[0].after).toBe(0.3);
    }
  });

  it("rejects when safe-completion regresses", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({ safeCompletionRate: 0.7 }),
      candidate: metrics({ safeCompletionRate: 0.6 }),
      caseCount: 10,
    });
    expect(decision.type).toBe("reject");
  });

  it("needs human review when neither regression nor improvement is measurable", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({}),
      candidate: metrics({}),
      caseCount: 10,
    });
    expect(decision.type).toBe("needs_human_review");
  });

  it("needs human review when safety improves but the cost budget is blown", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({ costPerSafeCompletion: 100 }),
      candidate: metrics({ falseCommitRate: 0.05, costPerSafeCompletion: 1000 }),
      caseCount: 10,
    });
    expect(decision.type).toBe("needs_human_review");
  });
});
