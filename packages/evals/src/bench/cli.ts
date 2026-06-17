import { fileURLToPath } from "node:url";
import { runBenchAndScore } from "./harness";
import { runPromotionComparison } from "./promotion";
import { writeReport } from "./report";
import { DeterministicProvider } from "./provider";
import { ALL_CASES } from "./cases";

/** `pnpm --filter @clarityloop/evals bench` — runs offline with the deterministic provider. */
async function main(): Promise<void> {
  const provider = new DeterministicProvider();
  const { report } = await runBenchAndScore(ALL_CASES, provider);
  const promotion = await runPromotionComparison(ALL_CASES, provider);
  const reportsDir = fileURLToPath(new URL("../../reports/", import.meta.url));
  const { jsonPath, mdPath } = await writeReport(report, reportsDir);
  // Promotion report sits alongside the main report for the demo's third column.
  const { writeFile } = await import("node:fs/promises");
  await writeFile(fileURLToPath(new URL("../../reports/promotion.json", import.meta.url)), JSON.stringify(promotion, null, 2), "utf8");
  console.log(`ClarityLoopBench: ${ALL_CASES.length} cases scored.`);
  console.log(`  report:    ${jsonPath}`);
  console.log(`  markdown:  ${mdPath}`);
  for (const b of report.baselines) {
    console.log(`  ${b.baseline.padEnd(13)} completion=${(b.taskCompletionRate * 100).toFixed(0)}% falseCommit=${(b.falseCommitRate * 100).toFixed(0)}% approval=${(b.approvalBurden * 100).toFixed(0)}%`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
