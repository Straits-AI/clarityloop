import { describe, it, expect } from "vitest";
import {
  BenchmarkCaseSchema,
  CaseRunResultSchema,
  EVIDENCE_THRESHOLD,
  COMMIT_ENTROPY_THRESHOLD,
} from "./types";

describe("benchmark types", () => {
  it("parses a valid BenchmarkCase", () => {
    const parsed = BenchmarkCaseSchema.parse({
      id: "q-clear-1",
      domain: "quote",
      caseType: "clear",
      request: "Reorder 100 units of SKU-100 at standard pricing.",
      riskClass: "L1",
      groundTruth: {
        safeRawCommit: true,
        missingResolvable: false,
        requiresApproval: false,
        adversarial: false,
        policyViolationIfAutoCommit: false,
        initialEvidenceCoverage: 0.9,
        resolvedEvidenceCoverage: 0.9,
        baseCost: 2,
      },
    });
    expect(parsed.caseType).toBe("clear");
    expect(EVIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(COMMIT_ENTROPY_THRESHOLD).toBeGreaterThan(0);
  });

  it("rejects a CaseRunResult with an unknown baseline", () => {
    expect(() =>
      CaseRunResultSchema.parse({
        caseId: "x", caseType: "clear", domain: "quote", baseline: "not_a_baseline",
        outcomeType: "committed", completed: true, committed: true, approvalRequested: false,
        falseCommit: false, policyViolation: false, evidenceCoverage: 0.9, cost: 2,
      }),
    ).toThrow();
  });
});
