import {
  classifyRiskClass,
  runCommitGate,
  type AuthorityBoundary,
  type EntropyScore,
  type EvidenceRef,
  type LatentWorkflowState,
  type RiskSignals,
  type WorkflowSpec,
} from "@clarityloop/core";
import { computeEvidenceCoverage, runAllVerifiers } from "@clarityloop/verifiers";
import { authorityCategoryChecks } from "../authority-checks";

export type ApprovalGateDeps = {
  workflowSpec: WorkflowSpec;
  authorityBoundary: AuthorityBoundary;
  evidence: EvidenceRef[];
  draftArtifact?: unknown | null;
  /** Risk signals for the in-flight commit; may depend on the evolving latent state. */
  riskSignals: (state: LatentWorkflowState) => RiskSignals;
};

/**
 * Production `LoopDeps.approvalRequired` predicate (Plan 5 CRITICAL INTEGRATION NOTE): compose the
 * verifiers + entropy + risk classification + the deterministic commit gate so the next-best-action
 * loop short-circuits to a human the moment the gate would route the current state to
 * `needs_approval` (authority boundary / evidence coverage / policy / residual entropy) or to an L4
 * `sandbox_only`. The model proposes; this deterministic gate decides whether to stop for approval.
 *
 * `needs_more_info` / `reject` / `commit` do NOT trip the predicate: the loop keeps gathering
 * information (its other stop conditions and the terminal commit gate handle those).
 */
export function makeApprovalRequired(deps: ApprovalGateDeps) {
  const { workflowSpec, authorityBoundary, evidence, draftArtifact = null, riskSignals } = deps;
  return (state: LatentWorkflowState, entropy: EntropyScore): boolean => {
    const checks = [
      ...runAllVerifiers({ state, evidence, workflowSpec, draftArtifact }),
      ...authorityCategoryChecks(riskSignals(state), workflowSpec.commitPolicy),
    ];
    const decision = runCommitGate({
      state,
      entropy,
      checks,
      evidenceCoverage: computeEvidenceCoverage(state, evidence),
      commitPolicy: workflowSpec.commitPolicy,
      authorityBoundary,
      riskClass: classifyRiskClass(riskSignals(state), workflowSpec.commitPolicy),
    });
    return decision.type === "needs_approval" || decision.type === "sandbox_only";
  };
}
