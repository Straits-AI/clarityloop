import { describe, it, expect } from "vitest";
import { commitDecisionView } from "./commit-view";

describe("commitDecisionView", () => {
  it("commit -> success tone, not requiring approval", () => {
    const v = commitDecisionView({ type: "commit", reason: "ok" });
    expect(v).toMatchObject({ tone: "success", requiresApproval: false });
  });
  it("needs_approval -> warning tone, requires approval, surfaces the risk class", () => {
    const v = commitDecisionView({
      type: "needs_approval",
      reason: "high value",
      approvalPayload: {
        runId: "r",
        riskClass: "L3",
        reason: "high value",
        summary: "",
        evidence: [],
        proposedArtifactId: null,
        failedChecks: [],
      },
    });
    expect(v.tone).toBe("warning");
    expect(v.requiresApproval).toBe(true);
    expect(v.lines.join(" ")).toContain("L3");
  });
  it("needs_more_info -> info tone, lists missing fields", () => {
    const v = commitDecisionView({ type: "needs_more_info", missingFields: ["delivery_date"] });
    expect(v.tone).toBe("info");
    expect(v.lines[0]).toContain("delivery_date");
  });
  it("reject -> danger tone, lists failed checks", () => {
    const v = commitDecisionView({
      type: "reject",
      failedChecks: [{ name: "x", verifier: "policy", passed: false, severity: "blocking", detail: "forbidden" }],
    });
    expect(v.tone).toBe("danger");
    expect(v.lines[0]).toContain("forbidden");
  });
  it("sandbox_only -> info tone", () => {
    expect(commitDecisionView({ type: "sandbox_only", reason: "structural" }).tone).toBe("info");
  });
});
