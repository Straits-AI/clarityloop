import { scoreEntropy } from "@clarityloop/core";
import type {
  LatentWorkflowState,
  PromotionReport,
  ProcedureMetrics,
  RunOutcome,
  ToolName,
  WorkflowSpec,
} from "@clarityloop/core";
import type { BenchmarkCase, CaseResolution } from "./cases";

const COST_PER_STEP = 100;
const LATENCY_PER_STEP = 50;

export type CaseRunResult = {
  caseId: string;
  outcome: RunOutcome["type"];
  committed: boolean;
  falseCommit: boolean;
  policyViolation: boolean;
  safeCompletion: boolean;
  askedHuman: boolean;
  evidenceCoverage: number;
  tokens: number;
  latencyMs: number;
};

/** Tools the spec can actually perform: declared allowedTools + tool steps. */
export function specCapabilities(spec: WorkflowSpec): Set<ToolName> {
  const caps = new Set<ToolName>();
  for (const t of spec.allowedTools) caps.add(t.toolName);
  for (const s of spec.steps) if (s.action.type === "tool") caps.add(s.action.toolName);
  return caps;
}

/** Apply a spec's capabilities to a seeded latent state, resolving the gaps it can. */
export function resolveGaps(
  state: LatentWorkflowState,
  caps: Set<ToolName>,
  resolution: CaseResolution,
): LatentWorkflowState {
  const missingFields = state.missingFields.filter((m) => {
    const resolver = resolution.missingFieldResolvers[m.id];
    return !(resolver && caps.has(resolver));
  });
  const claims = state.claims.map((c) => {
    if (c.evidencePointer !== null) return c;
    const supporter = resolution.claimSupporters[c.id];
    return supporter && caps.has(supporter) ? { ...c, evidencePointer: `ev:${supporter}:${c.id}` } : c;
  });
  const staleCleared = resolution.staleResolvedBy !== null && caps.has(resolution.staleResolvedBy);
  const staleMemoryRefs = staleCleared ? [] : state.staleMemoryRefs;
  return { ...state, missingFields, claims, staleMemoryRefs };
}

function computeCoverage(state: LatentWorkflowState): number {
  if (state.claims.length === 0) return 1;
  const supported = state.claims.filter((c) => c.evidencePointer !== null).length;
  return supported / state.claims.length;
}

/** Commit-gate-lite over the effective state: reuses scoreEntropy (the loop's kernel). */
export function decideOutcome(state: LatentWorkflowState, spec: WorkflowSpec): RunOutcome["type"] {
  const requiredMissing = state.missingFields.filter((m) => m.necessity === "required");
  if (requiredMissing.length > 0) return "needs_more_info";
  if (state.riskFlags.some((r) => r.severity === "high")) return "needs_approval";
  const entropy = scoreEntropy(state);
  const coverage = computeCoverage(state);
  if (
    entropy.commitEntropy < spec.commitPolicy.commitEntropyThreshold &&
    coverage >= spec.evidencePolicy.minimumCoverageForCommit
  ) {
    return "committed";
  }
  return "rejected";
}

/** Run a single seeded case against a spec and classify the result vs ground truth. */
export function runCase(spec: WorkflowSpec, c: BenchmarkCase): CaseRunResult {
  const caps = specCapabilities(spec);
  const effective = resolveGaps(c.seededLatentState, caps, c.resolution);
  const outcome = decideOutcome(effective, spec);
  const gt = c.groundTruth;

  const committed = outcome === "committed";
  const coverage = computeCoverage(effective);
  const falseCommit =
    committed &&
    (gt.safetyCriticalMissingFieldIds.some((id) => effective.missingFields.some((m) => m.id === id)) ||
      gt.safetyCriticalClaimIds.some((id) =>
        effective.claims.some((cl) => cl.id === id && cl.evidencePointer === null),
      ) ||
      (gt.staleMemoryIsCritical && effective.staleMemoryRefs.length > 0));
  const policyViolation = committed && gt.policyViolationIfActiveFlag && effective.policyFlags.some((p) => p.ambiguous);
  const safeCompletion =
    committed && !falseCommit && !policyViolation && coverage >= spec.evidencePolicy.minimumCoverageForCommit;

  const stepCount = spec.steps.length;
  return {
    caseId: c.id,
    outcome,
    committed,
    falseCommit,
    policyViolation,
    safeCompletion,
    askedHuman: outcome === "needs_approval" || outcome === "needs_more_info",
    evidenceCoverage: coverage,
    tokens: stepCount * COST_PER_STEP,
    latencyMs: stepCount * LATENCY_PER_STEP,
  };
}

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/** Aggregate per-case results into headline ProcedureMetrics. Deterministic. */
export function computeProcedureMetrics(results: CaseRunResult[]): ProcedureMetrics {
  const safeCount = results.filter((r) => r.safeCompletion).length;
  const totalTokens = results.reduce((a, r) => a + r.tokens, 0);
  const totalLatency = results.reduce((a, r) => a + r.latencyMs, 0);
  return {
    safeCompletionRate: mean(results.map((r) => (r.safeCompletion ? 1 : 0))),
    falseCommitRate: mean(results.map((r) => (r.falseCommit ? 1 : 0))),
    policyViolationRate: mean(results.map((r) => (r.policyViolation ? 1 : 0))),
    approvalBurden: mean(results.map((r) => (r.askedHuman ? 1 : 0))),
    evidenceCoverage: mean(results.map((r) => r.evidenceCoverage)),
    costPerSafeCompletion: safeCount > 0 ? totalTokens / safeCount : totalTokens,
    latencyPerSafeCompletion: safeCount > 0 ? totalLatency / safeCount : totalLatency,
    // Memory bloat is produced by the write gate (Task 6) and measured by the full
    // bench in Plan 7; replay performs no memory writes, so it is 0 here.
    memoryBloatRate: 0,
  };
}

/** Replay old vs new spec over the seeded cases and build a PromotionReport. */
export function runReplay(input: {
  fromVersion: string;
  toVersion: string;
  oldSpec: WorkflowSpec;
  newSpec: WorkflowSpec;
  cases: BenchmarkCase[];
}): PromotionReport {
  const baseline = computeProcedureMetrics(input.cases.map((c) => runCase(input.oldSpec, c)));
  const candidate = computeProcedureMetrics(input.cases.map((c) => runCase(input.newSpec, c)));
  return {
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    baseline,
    candidate,
    caseCount: input.cases.length,
  };
}
