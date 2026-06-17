import type { PromotionReport } from "@clarityloop/core";
import type { BaselineMetrics, ScoringReport } from "@clarityloop/evals";

export type DemoRow = { label: string; value: string };
export type DemoColumn = { title: string; subtitle: string; rows: DemoRow[] };
export type DemoViewModel = { baseline: DemoColumn; clarityloop: DemoColumn; promotion: DemoColumn };

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

function metricsFor(report: ScoringReport, baseline: BaselineMetrics["baseline"]): BaselineMetrics {
  const m = report.baselines.find((b) => b.baseline === baseline);
  if (!m) throw new Error(`missing baseline metrics: ${baseline}`);
  return m;
}

/** Map a scoring report + promotion report into the three demo columns (design spec §10). */
export function buildDemoViewModel(report: ScoringReport, promotion: PromotionReport): DemoViewModel {
  const dynamic = metricsFor(report, "dynamic_qwen");
  const clarity = metricsFor(report, "clarityloop");

  const baseline: DemoColumn = {
    title: "Baseline (Dynamic Qwen)",
    subtitle: "Generates and runs a workflow, commits without governance",
    rows: [
      { label: "Task completion", value: pct(dynamic.taskCompletionRate) },
      { label: "False commit rate", value: pct(dynamic.falseCommitRate) },
      { label: "Policy violation rate", value: pct(dynamic.policyViolationRate) },
      { label: "Evidence coverage", value: pct(dynamic.evidenceCoverage) },
      { label: "Approval burden", value: pct(dynamic.approvalBurden) },
    ],
  };

  const clarityloop: DemoColumn = {
    title: "ClarityLoop",
    subtitle: "Entropy-aware evidence loop + risk-tiered commit gate",
    rows: [
      { label: "Task completion", value: pct(clarity.taskCompletionRate) },
      { label: "False commit rate", value: pct(clarity.falseCommitRate) },
      { label: "Safe completion rate", value: pct(clarity.safeCompletionRate) },
      { label: "Evidence coverage", value: pct(clarity.evidenceCoverage) },
      { label: "Approval burden", value: pct(clarity.approvalBurden) },
      { label: "Constraint tax vs dynamic", value: pct(report.comparison.constraintTax) },
      { label: "Safety gain vs dynamic", value: pct(report.comparison.safetyGain) },
    ],
  };

  const promotionCol: DemoColumn = {
    title: "Promotion benchmark",
    subtitle: `${promotion.fromVersion} → ${promotion.toVersion}`,
    rows: [
      { label: "Safe completion (before)", value: pct(promotion.baseline.safeCompletionRate) },
      { label: "Safe completion (after)", value: pct(promotion.candidate.safeCompletionRate) },
      { label: "False commit (before)", value: pct(promotion.baseline.falseCommitRate) },
      { label: "False commit (after)", value: pct(promotion.candidate.falseCommitRate) },
      { label: "Cases replayed", value: String(promotion.caseCount) },
    ],
  };

  return { baseline, clarityloop, promotion: promotionCol };
}
