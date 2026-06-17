import type { ProcedureMetrics, PromotionReport } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import { runClarityLoop } from "./runners";
import { scoreBaseline } from "./scoring";
import type { BaselineMetrics, BenchmarkCase, CaseRunResult } from "./types";

/** Adapt our BaselineMetrics to core's ProcedureMetrics (Plan 6) for the promotion report. */
export function toProcedureMetrics(m: BaselineMetrics): ProcedureMetrics {
  return {
    safeCompletionRate: m.safeCompletionRate,
    falseCommitRate: m.falseCommitRate,
    policyViolationRate: m.policyViolationRate,
    approvalBurden: m.approvalBurden,
    evidenceCoverage: m.evidenceCoverage,
    costPerSafeCompletion: m.costPerSafeCompletion,
    latencyPerSafeCompletion: 0,
    memoryBloatRate: 0,
  };
}

async function runClarityVersion(
  cases: BenchmarkCase[],
  provider: ModelProvider,
  version: "v1" | "v2",
): Promise<CaseRunResult[]> {
  const out: CaseRunResult[] = [];
  for (const c of cases) {
    await provider.complete([{ role: "user", content: c.request }], { task: "extraction" });
    out.push(runClarityLoop(c, version));
  }
  return out;
}

/**
 * Replay the ClarityLoop procedure before (v1) and after (v2) the "retrieve_memory before
 * draft" patch (memo §10/§16), producing a core PromotionReport for the demo's third column.
 */
export async function runPromotionComparison(
  cases: BenchmarkCase[],
  provider: ModelProvider,
): Promise<PromotionReport> {
  const v1 = await runClarityVersion(cases, provider, "v1");
  const v2 = await runClarityVersion(cases, provider, "v2");
  return {
    fromVersion: "quote-procedure-v1",
    toVersion: "quote-procedure-v2",
    baseline: toProcedureMetrics(scoreBaseline("clarityloop", v1)),
    candidate: toProcedureMetrics(scoreBaseline("clarityloop", v2)),
    caseCount: cases.length,
  };
}
