import { describe, it, expect } from "vitest";
import { toReplayRows, toLineageRows } from "./promotion-view";
import type { BusinessProcedureVersion, PromotionReport } from "@clarityloop/core";

const report: PromotionReport = {
  fromVersion: "v1",
  toVersion: "v2",
  caseCount: 4,
  baseline: {
    safeCompletionRate: 0.25,
    falseCommitRate: 0.25,
    policyViolationRate: 0,
    approvalBurden: 0.25,
    evidenceCoverage: 0.9,
    costPerSafeCompletion: 800,
    latencyPerSafeCompletion: 400,
    memoryBloatRate: 0,
  },
  candidate: {
    safeCompletionRate: 1,
    falseCommitRate: 0,
    policyViolationRate: 0,
    approvalBurden: 0,
    evidenceCoverage: 1,
    costPerSafeCompletion: 500,
    latencyPerSafeCompletion: 250,
    memoryBloatRate: 0,
  },
};

describe("toReplayRows", () => {
  it("produces one row per metric with baseline, candidate, and signed delta", () => {
    const rows = toReplayRows(report);
    const safe = rows.find((r) => r.metric === "safeCompletionRate")!;
    expect(safe.baseline).toBe(0.25);
    expect(safe.candidate).toBe(1);
    expect(safe.delta).toBeCloseTo(0.75, 5);
    // higher-is-better metric improving -> "better"
    expect(safe.direction).toBe("better");
    const fc = rows.find((r) => r.metric === "falseCommitRate")!;
    // lower-is-better metric decreasing -> "better"
    expect(fc.direction).toBe("better");
  });
});

describe("toLineageRows", () => {
  it("orders versions parent-first and marks the promoted head", () => {
    const v1 = { id: "pv-1", parentVersion: null, name: "customer-quote", workflowSpec: { version: "v1" }, promotedAt: null, createdAt: "2026-06-16T00:00:00Z" } as unknown as BusinessProcedureVersion;
    const v2 = { id: "pv-1-v2", parentVersion: "pv-1", name: "customer-quote", workflowSpec: { version: "v2" }, promotedAt: "2026-06-17T00:00:00Z", createdAt: "2026-06-17T00:00:00Z" } as unknown as BusinessProcedureVersion;
    const rows = toLineageRows([v2, v1]);
    expect(rows.map((r) => r.id)).toEqual(["pv-1", "pv-1-v2"]);
    expect(rows[0].depth).toBe(0);
    expect(rows[1].depth).toBe(1);
    expect(rows[1].promoted).toBe(true);
  });
});
