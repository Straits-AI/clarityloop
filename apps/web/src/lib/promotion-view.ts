import type { BusinessProcedureVersion, ProcedureMetrics, PromotionReport } from "@clarityloop/core";

export type ReplayRow = {
  metric: keyof ProcedureMetrics;
  label: string;
  baseline: number;
  candidate: number;
  delta: number;
  direction: "better" | "worse" | "same";
};

// true => higher is better; false => lower is better.
const HIGHER_IS_BETTER: Record<keyof ProcedureMetrics, boolean> = {
  safeCompletionRate: true,
  falseCommitRate: false,
  policyViolationRate: false,
  approvalBurden: false,
  evidenceCoverage: true,
  costPerSafeCompletion: false,
  latencyPerSafeCompletion: false,
  memoryBloatRate: false,
};

const LABELS: Record<keyof ProcedureMetrics, string> = {
  safeCompletionRate: "Safe completion",
  falseCommitRate: "False commit",
  policyViolationRate: "Policy violation",
  approvalBurden: "Approval burden",
  evidenceCoverage: "Evidence coverage",
  costPerSafeCompletion: "Cost / safe completion",
  latencyPerSafeCompletion: "Latency / safe completion",
  memoryBloatRate: "Memory bloat",
};

const EPS = 1e-9;

export function toReplayRows(report: PromotionReport): ReplayRow[] {
  return (Object.keys(HIGHER_IS_BETTER) as (keyof ProcedureMetrics)[]).map((metric) => {
    const baseline = report.baseline[metric];
    const candidate = report.candidate[metric];
    const delta = candidate - baseline;
    let direction: ReplayRow["direction"] = "same";
    if (Math.abs(delta) > EPS) {
      const improved = HIGHER_IS_BETTER[metric] ? delta > 0 : delta < 0;
      direction = improved ? "better" : "worse";
    }
    return { metric, label: LABELS[metric], baseline, candidate, delta, direction };
  });
}

export type LineageRow = {
  id: string;
  version: string;
  parentVersion: string | null;
  depth: number;
  promoted: boolean;
  createdAt: string;
};

/** Order a set of procedure versions parent-first into a lineage with depth. */
export function toLineageRows(versions: BusinessProcedureVersion[]): LineageRow[] {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const depthOf = (v: BusinessProcedureVersion): number => {
    let d = 0;
    let cur: BusinessProcedureVersion | undefined = v;
    while (cur && cur.parentVersion && byId.has(cur.parentVersion)) {
      d += 1;
      cur = byId.get(cur.parentVersion);
    }
    return d;
  };
  return [...versions]
    .map((v) => ({
      id: v.id,
      version: v.workflowSpec.version,
      parentVersion: v.parentVersion,
      depth: depthOf(v),
      promoted: v.promotedAt !== null,
      createdAt: v.createdAt,
    }))
    .sort((a, b) => a.depth - b.depth || a.createdAt.localeCompare(b.createdAt));
}
