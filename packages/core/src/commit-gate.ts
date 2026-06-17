import type { ApprovalPayload, Check, CommitDecision } from "./gates";
import type { AuthorityBoundary } from "./governance";
import type { CommitPolicy } from "./workflow";
import type { RiskClass } from "./primitives";
import type { EntropyScore, LatentWorkflowState } from "./types";

/** Commit gate inputs (shared-contracts §7, verbatim). */
export type CommitGateInput = {
  state: LatentWorkflowState;
  entropy: EntropyScore;
  checks: Check[];
  evidenceCoverage: number; // 0..1, from the evidence_coverage verifier
  commitPolicy: CommitPolicy;
  authorityBoundary: AuthorityBoundary;
  riskClass: RiskClass;
};

const RISK_ORDER: Record<RiskClass, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

/** Blocking failures from these verifiers are HARD rejections — no approval can rescue them. */
const HARD_REJECT_VERIFIERS = new Set(["policy", "hallucinated_tool", "numeric_reconciliation", "schema"]);

/**
 * Partial approval payload the gate can build from its pure inputs. The orchestrator
 * (apps/api) fills runId / summary / evidence / proposedArtifactId before persisting.
 */
function gateApprovalPayload(input: CommitGateInput, reason: string): ApprovalPayload {
  return {
    runId: "",
    riskClass: input.riskClass,
    reason,
    summary: "",
    evidence: [],
    proposedArtifactId: null,
    failedChecks: input.checks.filter((c) => !c.passed),
  };
}

/**
 * Deterministic commit gate (design spec §7, memo §18). First matching branch wins.
 * Invariant: the model may PROPOSE a commit; this code DECIDES whether it is allowed.
 */
export function runCommitGate(input: CommitGateInput): CommitDecision {
  const { state, entropy, checks, commitPolicy, authorityBoundary, riskClass } = input;
  const blocking = checks.filter((c) => !c.passed && c.severity === "blocking");

  // 1. Hard reject — blocking schema / numeric / policy / hallucinated-tool failures.
  const hardFailures = blocking.filter((c) => HARD_REJECT_VERIFIERS.has(c.verifier));
  if (hardFailures.length > 0) {
    return { type: "reject", failedChecks: hardFailures };
  }

  // 2. Needs more info — any unresolved required field (or a blocking missing_info check).
  const missingRequired = state.missingFields.filter((m) => m.necessity === "required");
  const missingInfoBlocked = blocking.some((c) => c.verifier === "missing_info");
  if (missingRequired.length > 0 || missingInfoBlocked) {
    return { type: "needs_more_info", missingFields: missingRequired.map((m) => m.name) };
  }

  // 3. Sandbox only — L4 structural actions are governed by the promotion gate, not the
  //    commit gate; the commit gate can only sandbox-simulate them (never auto-commit).
  if (riskClass === "L4") {
    return {
      type: "sandbox_only",
      reason: "L4 structural change is governed by the promotion gate; commit gate runs sandbox only",
    };
  }

  // 4. Needs approval — risk above the auto-commit ceiling, an approval-trigger 'warn',
  //    residual commit entropy at/above threshold, or auto-commit disabled by policy.
  const reasons: string[] = [];
  if (RISK_ORDER[riskClass] > RISK_ORDER[authorityBoundary.autoCommitMaxRiskClass]) {
    reasons.push(`risk ${riskClass} exceeds auto-commit ceiling ${authorityBoundary.autoCommitMaxRiskClass}`);
  }
  for (const c of checks) {
    if (!c.passed && c.severity === "warn" && c.verifier === "policy") reasons.push(c.detail);
  }
  if (entropy.commitEntropy >= commitPolicy.commitEntropyThreshold) {
    reasons.push(`commit entropy ${entropy.commitEntropy.toFixed(2)} >= threshold ${commitPolicy.commitEntropyThreshold}`);
  }
  if (!commitPolicy.autoCommitAllowed) {
    reasons.push("auto-commit disabled by commit policy");
  }
  if (reasons.length > 0) {
    const reason = reasons.join("; ");
    return { type: "needs_approval", reason, approvalPayload: gateApprovalPayload(input, reason) };
  }

  // 5. Commit — low entropy, verifiers pass, risk within the authority boundary.
  return {
    type: "commit",
    reason: "commit entropy below threshold, verifiers passed, risk within authority boundary",
  };
}
