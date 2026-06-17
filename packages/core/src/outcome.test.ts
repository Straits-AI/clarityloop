import { describe, it, expect } from "vitest";
import { applyApprovalDecision, commitDecisionToOutcome } from "./outcome";
import type { ApprovalPayload, CommitDecision } from "./gates";

const ids = { runId: "run_1", traceId: "trace_1", artifactId: "art_1" };
const payload: ApprovalPayload = {
  runId: "",
  riskClass: "L3",
  reason: "high value",
  summary: "",
  evidence: [],
  proposedArtifactId: "art_1",
  failedChecks: [],
};

describe("commitDecisionToOutcome (shared-contracts §7 mapping)", () => {
  it("commit -> committed with the artifact id", () => {
    const out = commitDecisionToOutcome({ type: "commit", reason: "ok" }, ids);
    expect(out).toEqual({ type: "committed", runId: "run_1", traceId: "trace_1", artifactId: "art_1" });
  });
  it("reject -> rejected carrying the failed checks", () => {
    const decision: CommitDecision = {
      type: "reject",
      failedChecks: [{ name: "x", verifier: "policy", passed: false, severity: "blocking", detail: "d" }],
    };
    expect(commitDecisionToOutcome(decision, ids).type).toBe("rejected");
  });
  it("needs_approval -> needs_approval and stamps the runId onto the payload", () => {
    const out = commitDecisionToOutcome({ type: "needs_approval", reason: "r", approvalPayload: payload }, ids);
    expect(out.type).toBe("needs_approval");
    if (out.type === "needs_approval") expect(out.approvalPayload.runId).toBe("run_1");
  });
  it("needs_more_info -> needs_more_info with the missing fields", () => {
    const out = commitDecisionToOutcome({ type: "needs_more_info", missingFields: ["sku"] }, ids);
    expect(out.type).toBe("needs_more_info");
    if (out.type === "needs_more_info") expect(out.missingFields).toEqual(["sku"]);
  });
  it("sandbox_only -> sandbox_only", () => {
    expect(commitDecisionToOutcome({ type: "sandbox_only", reason: "x" }, ids).type).toBe("sandbox_only");
  });
});

describe("applyApprovalDecision (the approval-required path)", () => {
  it("approved -> committed", () => {
    expect(applyApprovalDecision("approved", payload, ids).type).toBe("committed");
  });
  it("rejected -> rejected carrying the payload's failed checks", () => {
    expect(applyApprovalDecision("rejected", payload, ids).type).toBe("rejected");
  });
});
