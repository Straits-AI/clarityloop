import type { ModelProvider } from "@clarityloop/qwen";
import { BASELINE_RUNNERS } from "./runners";
import { scoreReport } from "./scoring";
import type { BenchmarkCase, CaseRunResult, ScoringReport } from "./types";

/** Run every baseline over every case (offline, deterministic). */
export async function runBench(cases: BenchmarkCase[], provider: ModelProvider): Promise<CaseRunResult[]> {
  const results: CaseRunResult[] = [];
  for (const c of cases) {
    for (const runner of BASELINE_RUNNERS) {
      results.push(await runner(c, provider));
    }
  }
  return results;
}

/** Run the bench and score it in one call. */
export async function runBenchAndScore(
  cases: BenchmarkCase[],
  provider: ModelProvider,
): Promise<{ results: CaseRunResult[]; report: ScoringReport }> {
  const results = await runBench(cases, provider);
  const report = scoreReport(results, { caseCount: cases.length });
  return { results, report };
}
