import { describe, it, expect } from "vitest";
import { runCommitGate, type CommitGateInput } from "./commit-gate";
import { scoreEntropy } from "./entropy";
import type { Check } from "./gates";
import type { AuthorityBoundary } from "./governance";
import type { CommitPolicy } from "./workflow";
import type { LatentWorkflowState } from "./types";

const commitPolicy: CommitPolicy = {
  autoCommitAllowed: true,
  requireApprovalIf: {
    quoteValueAbove: 10000,
    discountAbovePct: 20,
    evidenceCoverageBelow: 0.8,
    deliveryUnconfirmed: true,
    externalSend: true,
    policyException: true,
  },
  forbiddenActions: ["bypass_credit_check"],
  commitEntropyThreshold: 0.3,
};

const authority: AuthorityBoundary = {
  autoCommitMaxRiskClass: "L2",
  approvalRequiredFor: ["external_send", "high_value_quote"],
  forbiddenActions: ["bypass_credit_check"],
  allowedTools: [],
};

const cleanState: LatentWorkflowState = {
  goal: "quote",
  workflowVersion: "v1",
  knownFacts: [{ id: "f1", text: "customer ABC", confidence: 0.9 }],
  missingFields: [],
  claims: [{ id: "c1", text: "price 10", evidencePointer: "e1" }],
  riskFlags: [],
  policyFlags: [],
  staleMemoryRefs: [],
  toolFailures: [],
};

const passingChecks: Check[] = [
  { name: "artifact_schema_valid", verifier: "schema", passed: true, severity: "info", detail: "" },
  { name: "evidence_coverage_threshold", verifier: "evidence_coverage", passed: true, severity: "info", detail: "" },
];

function input(overrides: Partial<CommitGateInput> = {}): CommitGateInput {
  return {
    state: cleanState,
    entropy: scoreEntropy(cleanState),
    checks: passingChecks,
    evidenceCoverage: 1,
    commitPolicy,
    authorityBoundary: authority,
    riskClass: "L1",
    ...overrides,
  };
}

describe("runCommitGate", () => {
  it("commits when entropy is low, verifiers pass, and risk is within the ceiling", () => {
    expect(runCommitGate(input()).type).toBe("commit");
  });

  it("needs_approval for an L3 commit above the auto-commit ceiling", () => {
    const d = runCommitGate(input({ riskClass: "L3" }));
    expect(d.type).toBe("needs_approval");
    if (d.type === "needs_approval") {
      expect(d.approvalPayload.riskClass).toBe("L3");
      expect(d.approvalPayload.failedChecks).toEqual([]);
      expect(d.approvalPayload.runId).toBe(""); // orchestrator fills it later
    }
  });

  it("needs_more_info when a required field is unresolved", () => {
    const state = { ...cleanState, missingFields: [{ id: "m1", name: "delivery_date", necessity: "required" as const }] };
    const d = runCommitGate(input({ state, entropy: scoreEntropy(state) }));
    expect(d.type).toBe("needs_more_info");
    if (d.type === "needs_more_info") expect(d.missingFields).toEqual(["delivery_date"]);
  });

  it("rejects on a blocking policy violation", () => {
    const checks: Check[] = [
      ...passingChecks,
      { name: "forbidden_action:bypass_credit_check", verifier: "policy", passed: false, severity: "blocking", detail: "forbidden" },
    ];
    const d = runCommitGate(input({ checks }));
    expect(d.type).toBe("reject");
    if (d.type === "reject") expect(d.failedChecks).toHaveLength(1);
  });

  it("sandbox_only for an L4 structural action", () => {
    expect(runCommitGate(input({ riskClass: "L4" })).type).toBe("sandbox_only");
  });

  it("needs_approval when residual commit entropy is at/above threshold", () => {
    const noisy: LatentWorkflowState = {
      ...cleanState,
      claims: [{ id: "c1", text: "price 10", evidencePointer: null }],
      policyFlags: [{ id: "p1", rule: "discount_tier", ambiguous: true }],
    };
    const d = runCommitGate(input({ state: noisy, entropy: scoreEntropy(noisy), riskClass: "L1" }));
    expect(d.type).toBe("needs_approval");
  });

  it("needs_approval when a blocking evidence_coverage_threshold check fails (coverage below minimum)", () => {
    const checks: Check[] = [
      { name: "artifact_schema_valid", verifier: "schema", passed: true, severity: "info", detail: "" },
      { name: "evidence_coverage_threshold", verifier: "evidence_coverage", passed: false, severity: "blocking", detail: "coverage 0.50 < required 1" },
    ];
    // entropy/risk within the auto-commit ceiling: only the failed coverage gate forces approval.
    const d = runCommitGate(input({ checks, evidenceCoverage: 0.5 }));
    expect(d.type).toBe("needs_approval");
    if (d.type === "needs_approval") expect(d.reason).toContain("evidence coverage");
  });

  it("needs_approval when numeric coverage is below the policy approval threshold", () => {
    const d = runCommitGate(input({ evidenceCoverage: 0.5 })); // 0.5 < requireApprovalIf.evidenceCoverageBelow (0.8)
    expect(d.type).toBe("needs_approval");
  });

  it("authority boundary forces approval for an always-approval category within the risk ceiling", () => {
    // An L2 external-send action is within the L2 ceiling, but external_send is in approvalRequiredFor.
    const externalSend: Check[] = [
      ...passingChecks,
      { name: "external_send", verifier: "policy", passed: false, severity: "info", detail: "commit performs an external send" },
    ];
    const gated = runCommitGate(input({ checks: externalSend, riskClass: "L2" }));
    expect(gated.type).toBe("needs_approval");
    if (gated.type === "needs_approval") expect(gated.reason).toContain("external_send");

    // The same action commits when the category is NOT in the authority boundary's approval set.
    const lenient: AuthorityBoundary = { ...authority, approvalRequiredFor: [] };
    expect(runCommitGate(input({ checks: externalSend, riskClass: "L2", authorityBoundary: lenient })).type).toBe("commit");
  });

  it("reject takes precedence over needs_approval when both a hard failure and high risk exist", () => {
    const checks: Check[] = [
      { name: "artifact_schema_invalid", verifier: "schema", passed: false, severity: "blocking", detail: "bad shape" },
    ];
    const d = runCommitGate(input({ checks, riskClass: "L3" }));
    expect(d.type).toBe("reject");
  });
});
