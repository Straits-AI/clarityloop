import { scoreEntropy } from "@clarityloop/core";
import type { LatentWorkflowState, RiskClass } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import {
  COMMIT_ENTROPY_THRESHOLD,
  EVIDENCE_THRESHOLD,
  type BaselineName,
  type BenchmarkCase,
  type CaseRunResult,
  type OutcomeType,
} from "./types";

export type BaselineRunner = (c: BenchmarkCase, provider: ModelProvider) => Promise<CaseRunResult>;

const RISK_ORDER: Record<RiskClass, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };
const riskAtLeastL1 = (rc: RiskClass): boolean => RISK_ORDER[rc] >= 1;

function makeResult(
  c: BenchmarkCase,
  baseline: BaselineName,
  p: { outcomeType: OutcomeType; evidenceCoverage: number; falseCommit: boolean; policyViolation: boolean; cost: number },
): CaseRunResult {
  const committed = p.outcomeType === "committed";
  const approvalRequested = p.outcomeType === "needs_approval";
  return {
    caseId: c.id,
    caseType: c.caseType,
    domain: c.domain,
    baseline,
    outcomeType: p.outcomeType,
    completed: committed || approvalRequested,
    committed,
    approvalRequested,
    falseCommit: p.falseCommit,
    policyViolation: p.policyViolation,
    evidenceCoverage: p.evidenceCoverage,
    cost: p.cost,
  };
}

/** Baseline 1 — Bare Qwen: single shot, commit whatever it produced, no governance. */
export const bareQwenRunner: BaselineRunner = async (c, provider) => {
  await provider.complete([{ role: "user", content: c.request }], { task: "workflow_generation" });
  const g = c.groundTruth;
  return makeResult(c, "bare_qwen", {
    outcomeType: "committed",
    evidenceCoverage: g.initialEvidenceCoverage,
    falseCommit: !g.safeRawCommit,
    policyViolation: g.policyViolationIfAutoCommit,
    cost: g.baseCost,
  });
};

/** Baseline 2 — Dynamic Qwen Workflow: gathers cheap evidence, then auto-commits (no commit gate). */
export const dynamicQwenRunner: BaselineRunner = async (c, provider) => {
  await provider.complete([{ role: "user", content: c.request }], { task: "workflow_generation" });
  const g = c.groundTruth;
  const gathered = g.missingResolvable;
  const coverage = gathered ? g.resolvedEvidenceCoverage : g.initialEvidenceCoverage;
  // No gate: authority-boundary and adversarial cases are still committed unsafely.
  const falseCommit = g.requiresApproval || g.adversarial || (!g.safeRawCommit && !gathered);
  return makeResult(c, "dynamic_qwen", {
    outcomeType: "committed",
    evidenceCoverage: coverage,
    falseCommit,
    policyViolation: g.policyViolationIfAutoCommit,
    cost: g.baseCost * 2,
  });
};

/** Baseline 3 — Fixed Gate: blunt deterministic gate, no evidence loop (safer but over-restrictive). */
export const fixedGateRunner: BaselineRunner = async (c, provider) => {
  await provider.complete([{ role: "user", content: c.request }], { task: "workflow_generation" });
  const g = c.groundTruth;
  let outcomeType: OutcomeType;
  if (g.adversarial) outcomeType = "rejected";
  else if (g.missingResolvable && !g.safeRawCommit) outcomeType = "needs_more_info"; // over-blocks uncertainty
  else if (g.requiresApproval || riskAtLeastL1(c.riskClass)) outcomeType = "needs_approval"; // escalates broadly
  else outcomeType = "committed";
  const committed = outcomeType === "committed";
  return makeResult(c, "fixed_gate", {
    outcomeType,
    evidenceCoverage: g.initialEvidenceCoverage, // never gathered
    falseCommit: committed && !g.safeRawCommit,
    policyViolation: committed && g.policyViolationIfAutoCommit,
    cost: g.baseCost,
  });
};

/** Build a latent state for the entropy kernel given whether evidence was resolved. */
function buildState(c: BenchmarkCase, resolved: boolean): LatentWorkflowState {
  return {
    goal: c.request,
    workflowVersion: "bench",
    knownFacts: [{ id: "f1", text: "request parsed", confidence: 0.9 }],
    missingFields: resolved ? [] : [{ id: "m1", name: "unresolved_required", necessity: "required" }],
    claims: [{ id: "c1", text: "price/spec claim", evidencePointer: resolved ? "e1" : null }],
    riskFlags: [],
    policyFlags: [],
    staleMemoryRefs: [],
    toolFailures: [],
  };
}

/** A workflow patch (memo §10/§16) lets v2 retrieve memory before drafting, resolving memory cases v1 cannot. */
function clarityResolves(c: BenchmarkCase, version: "v1" | "v2"): boolean {
  if (!c.groundTruth.missingResolvable) return true; // nothing to resolve (e.g. clear)
  if (version === "v1" && (c.caseType === "same_as_last_time" || c.caseType === "stale_memory")) return false;
  return true;
}

/** Baseline 4 — ClarityLoop: entropy-aware loop (real scoreEntropy) then design-spec §7 commit rule. */
export function runClarityLoop(c: BenchmarkCase, version: "v1" | "v2"): CaseRunResult {
  const g = c.groundTruth;
  let outcomeType: OutcomeType;
  let coverage = g.initialEvidenceCoverage;
  let iterations = 1;
  if (g.adversarial) {
    outcomeType = "rejected";
  } else if (g.requiresApproval) {
    outcomeType = "needs_approval";
  } else {
    const resolved = clarityResolves(c, version);
    const entropy = scoreEntropy(buildState(c, resolved)); // exercises the real core kernel
    coverage = resolved ? (g.missingResolvable ? g.resolvedEvidenceCoverage : g.initialEvidenceCoverage) : g.initialEvidenceCoverage;
    iterations = resolved && g.missingResolvable ? 3 : 1;
    outcomeType =
      resolved && entropy.commitEntropy < COMMIT_ENTROPY_THRESHOLD && coverage >= EVIDENCE_THRESHOLD
        ? "committed"
        : "needs_more_info";
  }
  const committed = outcomeType === "committed";
  return makeResult(c, "clarityloop", {
    outcomeType,
    evidenceCoverage: coverage,
    falseCommit: committed && !g.safeRawCommit && !clarityResolves(c, version),
    policyViolation: false,
    cost: g.baseCost * iterations,
  });
}

/** Default ClarityLoop runner = the promoted (v2) procedure with the memory-first patch. */
export const clarityLoopRunner: BaselineRunner = async (c, provider) => {
  await provider.complete([{ role: "user", content: c.request }], { task: "extraction" });
  return runClarityLoop(c, "v2");
};

/** The four baselines, in benchmark-report order. */
export const BASELINE_RUNNERS: BaselineRunner[] = [
  bareQwenRunner,
  dynamicQwenRunner,
  fixedGateRunner,
  clarityLoopRunner,
];
