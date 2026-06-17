import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ScoringReport } from "./types";

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

/** Render the scoring report as a human-readable markdown document. */
export function renderReportMarkdown(report: ScoringReport): string {
  const head = [
    "# ClarityLoopBench Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Cases: ${report.caseCount} · Evidence threshold: ${report.evidenceThreshold}`,
    "",
    "| Baseline | Completion | False Commit | Policy Viol | Safe Completion | Approval Burden | Evidence Cov | Cost / Safe |",
    "|---|---|---|---|---|---|---|---|",
  ];
  const rows = report.baselines.map(
    (b) =>
      `| ${b.baseline} | ${pct(b.taskCompletionRate)} | ${pct(b.falseCommitRate)} | ${pct(b.policyViolationRate)} | ${pct(b.safeCompletionRate)} | ${pct(b.approvalBurden)} | ${pct(b.evidenceCoverage)} | ${b.costPerSafeCompletion.toFixed(1)} |`,
  );
  const comparison = [
    "",
    "## Headline comparison (ClarityLoop vs Dynamic Qwen)",
    "",
    `- Constraint tax: ${pct(report.comparison.constraintTax)}`,
    `- Safety gain: ${pct(report.comparison.safetyGain)}`,
    "",
    "_Claim (design spec §9): ClarityLoop matches a fixed gate's low false-commit rate with lower constraint tax, because it loops for missing signal before blocking._",
    "",
  ];
  return [...head, ...rows, ...comparison].join("\n");
}

/** Write report.json + report.md into `dir`; returns the two paths. */
export async function writeReport(report: ScoringReport, dir: string): Promise<{ jsonPath: string; mdPath: string }> {
  await mkdir(dir, { recursive: true });
  const jsonPath = join(dir, "report.json");
  const mdPath = join(dir, "report.md");
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(mdPath, renderReportMarkdown(report), "utf8");
  return { jsonPath, mdPath };
}
