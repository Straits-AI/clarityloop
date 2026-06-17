import type { ApprovalPayload, CommitDecision, RunOutcome } from "./gates";

export type RunIds = { runId: string; traceId: string; artifactId: string | null };

/** CommitDecision (verb) → RunOutcome (past-tense + IDs), shared-contracts §7 mapping. */
export function commitDecisionToOutcome(decision: CommitDecision, ids: RunIds): RunOutcome {
  switch (decision.type) {
    case "commit":
      return { type: "committed", runId: ids.runId, traceId: ids.traceId, artifactId: ids.artifactId ?? "" };
    case "needs_approval":
      return {
        type: "needs_approval",
        runId: ids.runId,
        traceId: ids.traceId,
        approvalPayload: { ...decision.approvalPayload, runId: ids.runId },
      };
    case "needs_more_info":
      return { type: "needs_more_info", runId: ids.runId, traceId: ids.traceId, missingFields: decision.missingFields };
    case "reject":
      return { type: "rejected", runId: ids.runId, traceId: ids.traceId, failedChecks: decision.failedChecks };
    case "sandbox_only":
      return { type: "sandbox_only", runId: ids.runId, traceId: ids.traceId };
  }
}

/** Resolve a human approval into a terminal RunOutcome (memo §17 authority-boundary path). */
export function applyApprovalDecision(
  decision: "approved" | "rejected",
  payload: ApprovalPayload,
  ids: RunIds,
): RunOutcome {
  if (decision === "approved") {
    return { type: "committed", runId: ids.runId, traceId: ids.traceId, artifactId: ids.artifactId ?? "" };
  }
  return { type: "rejected", runId: ids.runId, traceId: ids.traceId, failedChecks: payload.failedChecks };
}
