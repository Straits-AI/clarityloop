import { describe, it, expect } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBenchAndScore } from "./harness";
import { runPromotionComparison } from "./promotion";
import { writeReport } from "./report";
import { DeterministicProvider } from "./provider";
import { ALL_CASES } from "./cases";
import { PromotionReportSchema } from "@clarityloop/core";

describe("ClarityLoopBench end-to-end", () => {
  it("runs all four baselines on the corpus and reproduces the headline story", async () => {
    const { results, report } = await runBenchAndScore(ALL_CASES, new DeterministicProvider());
    expect(results).toHaveLength(ALL_CASES.length * 4);
    const by = (b: string) => report.baselines.find((x) => x.baseline === b)!;

    const dynamic = by("dynamic_qwen");
    const fixed = by("fixed_gate");
    const clarity = by("clarityloop");

    // ClarityLoop is as safe as the fixed gate...
    expect(clarity.falseCommitRate).toBeLessThanOrEqual(fixed.falseCommitRate + 1e-9);
    expect(clarity.falseCommitRate).toBeLessThanOrEqual(dynamic.falseCommitRate);
    // ...but with lower constraint tax (higher completion) and lower approval burden than the fixed gate.
    expect(clarity.taskCompletionRate).toBeGreaterThan(fixed.taskCompletionRate);
    expect(clarity.approvalBurden).toBeLessThan(fixed.approvalBurden);
    // Safety gain over the ungoverned dynamic baseline is positive.
    expect(report.comparison.safetyGain).toBeGreaterThan(0);
    expect(report.comparison.constraintTax).toBeGreaterThanOrEqual(0);
  });

  it("writes a report.json that round-trips through the schema", async () => {
    const { report } = await runBenchAndScore(ALL_CASES, new DeterministicProvider());
    const dir = await mkdtemp(join(tmpdir(), "clbench-e2e-"));
    const { jsonPath } = await writeReport(report, dir);
    const json = JSON.parse(await readFile(jsonPath, "utf8"));
    expect(json.baselines).toHaveLength(4);
  });

  it("produces a promotion report where the patched (v2) procedure improves safe completion", async () => {
    const promo = await runPromotionComparison(ALL_CASES, new DeterministicProvider());
    expect(() => PromotionReportSchema.parse(promo)).not.toThrow();
    expect(promo.candidate.safeCompletionRate).toBeGreaterThanOrEqual(promo.baseline.safeCompletionRate);
    expect(promo.candidate.falseCommitRate).toBeLessThanOrEqual(promo.baseline.falseCommitRate + 1e-9);
    expect(promo.caseCount).toBe(ALL_CASES.length);
  });
});
