import { describe, it, expect } from "vitest";
import { ProposedActionSchema, CandidateActionSchema } from "./actions";
import { CommitDecisionSchema, RunOutcomeSchema } from "./gates";

describe("action schemas", () => {
  it("parses a ProposedAction (no scores)", () => {
    const p = ProposedActionSchema.parse({
      id: "a1", actionType: "lookup_catalog", verifierName: null, targetField: "m1", rationale: "need price",
    });
    expect(p.actionType).toBe("lookup_catalog");
  });

  it("rejects a CandidateAction missing the code-computed score", () => {
    expect(() =>
      CandidateActionSchema.parse({
        id: "a1", actionType: "lookup_catalog", verifierName: null, targetField: null, rationale: "r",
        expectedEntropyReduction: 0.1, expectedRiskReduction: 0, tokenCost: 0.01,
        latencyCost: 0.01, humanBurdenCost: 0, toolCost: 0.01,
      }),
    ).toThrow();
  });
});

describe("gate schemas", () => {
  it("discriminates a needs_approval CommitDecision requiring an approvalPayload", () => {
    const d = CommitDecisionSchema.parse({
      type: "needs_approval", reason: "high value",
      approvalPayload: {
        runId: "run1", riskClass: "L3", reason: "value above 10000", summary: "draft quote",
        evidence: [], proposedArtifactId: "art1", failedChecks: [],
      },
    });
    expect(d.type).toBe("needs_approval");
  });

  it("discriminates a committed RunOutcome requiring runId/traceId/artifactId", () => {
    const o = RunOutcomeSchema.parse({
      type: "committed", runId: "run1", traceId: "t1", artifactId: "art1",
    });
    expect(o.type).toBe("committed");
    expect(() => RunOutcomeSchema.parse({ type: "committed", runId: "run1", traceId: "t1" })).toThrow();
  });
});
