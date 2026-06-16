import { describe, it, expect } from "vitest";
import { EntropyScoreSchema, TraceStepSchema, TraceSchema, TraceReferenceSchema } from "./trace";

const ent = {
  taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0,
  policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0,
};

const action = {
  id: "a1", actionType: "lookup_catalog", verifierName: null, targetField: null, rationale: "r",
  expectedEntropyReduction: 0.1, expectedRiskReduction: 0, tokenCost: 0.01,
  latencyCost: 0.01, humanBurdenCost: 0, toolCost: 0.01, score: 0.07,
};

describe("trace schemas", () => {
  it("parses an EntropyScore snapshot", () => {
    expect(EntropyScoreSchema.parse(ent).commitEntropy).toBe(0);
  });

  it("parses a full TraceStep with a CandidateAction and entropy snapshots", () => {
    const step = TraceStepSchema.parse({
      index: 0, at: "2026-06-16T00:00:00Z", input: { goal: "g" },
      action, toolOutput: null, entropyBefore: ent, entropyAfter: ent,
    });
    expect(step.index).toBe(0);
  });

  it("parses a head Trace with empty steps and a null outcome, plus a TraceReference", () => {
    const trace = TraceSchema.parse({
      id: "t1", runId: "run1", procedureVersionId: null, workflowVersion: "v1",
      domain: "quote", createdAt: "2026-06-16T00:00:00Z", steps: [], outcome: null,
    });
    expect(trace.steps).toHaveLength(0);
    const ref = TraceReferenceSchema.parse({
      traceId: "t1", runId: "run1", createdAt: "2026-06-16T00:00:00Z",
      outcomeType: "committed", artifactKey: "traces/t1.json",
    });
    expect(ref.outcomeType).toBe("committed");
  });
});
