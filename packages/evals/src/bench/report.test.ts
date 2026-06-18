import { describe, it, expect } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderReportMarkdown, writeReport } from "./report";
import { ScoringReportSchema, type ScoringReport } from "./types";

const sample: ScoringReport = {
  generatedAt: "2026-06-16T00:00:00.000Z",
  caseCount: 36,
  evidenceThreshold: 0.7,
  baselines: [
    { baseline: "bare_qwen", total: 36, taskCompletionRate: 1.0, falseCommitRate: 0.92, policyViolationRate: 0.14, safeCompletionRate: 0.06, approvalBurden: 0, evidenceCoverage: 0.5, costPerSafeCompletion: 360, attackSuccessRate: 1 },
    { baseline: "dynamic_qwen", total: 36, taskCompletionRate: 1.0, falseCommitRate: 0.33, policyViolationRate: 0.14, safeCompletionRate: 0.6, approvalBurden: 0, evidenceCoverage: 0.74, costPerSafeCompletion: 80, attackSuccessRate: 1 },
    { baseline: "fixed_gate", total: 36, taskCompletionRate: 0.33, falseCommitRate: 0, policyViolationRate: 0, safeCompletionRate: 0.33, approvalBurden: 0.33, evidenceCoverage: 0.5, costPerSafeCompletion: 110, attackSuccessRate: 0 },
    { baseline: "clarityloop", total: 36, taskCompletionRate: 0.92, falseCommitRate: 0, policyViolationRate: 0, safeCompletionRate: 0.92, approvalBurden: 0.25, evidenceCoverage: 0.85, costPerSafeCompletion: 90, attackSuccessRate: 0 },
  ],
  comparison: { constraintTax: 0.08, safetyGain: 0.33 },
};

describe("report rendering", () => {
  it("renders a markdown table with every baseline and the headline comparison", () => {
    const md = renderReportMarkdown(sample);
    expect(md).toContain("# ClarityLoopBench Report");
    expect(md).toContain("clarityloop");
    expect(md).toContain("Constraint tax");
    expect(md).toContain("Safety gain");
    expect(md).toContain("33.0%"); // safety gain rendered as a percentage
  });

  it("writes report.json and report.md to disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "clbench-"));
    const { jsonPath, mdPath } = await writeReport(sample, dir);
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    expect(() => ScoringReportSchema.parse(json)).not.toThrow();
    const md = await readFile(mdPath, "utf8");
    expect(md).toContain("ClarityLoopBench Report");
  });
});
