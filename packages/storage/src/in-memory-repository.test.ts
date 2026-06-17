import { describe, it, expect } from "vitest";
import {
  InMemoryRunRepository, InMemoryTraceRepository, InMemoryProcedureVersionRepository,
} from "./in-memory-repository";
import type { RunRecord } from "./repository";
import type { BusinessProcedureVersion, Trace, TraceStep, WorkflowDomain } from "@clarityloop/core";

const baseRun = (over: Partial<RunRecord>): RunRecord => ({
  id: "run1", procedureVersionId: null, domain: "quote", inputRequest: "quote 120 cartons",
  workflowSpec: null, traceId: null, outcome: null, createdAt: "2026-06-16T00:00:00Z", ...over,
});

// Partial cast used only to exercise repository indexing; full-schema validity is
// covered by procedure.test.ts in @clarityloop/core.
const makeVersion = (p: { id: string; name: string; domain: WorkflowDomain; createdAt: string }): BusinessProcedureVersion =>
  ({ id: p.id, name: p.name, createdAt: p.createdAt, workflowSpec: { trigger: { domain: p.domain } } } as unknown as BusinessProcedureVersion);

describe("InMemoryRunRepository", () => {
  it("round-trips create/get and applies setOutcome", async () => {
    const repo = new InMemoryRunRepository();
    await repo.create(baseRun({ id: "run1" }));
    expect((await repo.get("run1"))?.inputRequest).toBe("quote 120 cartons");
    await repo.setOutcome("run1", { type: "committed", runId: "run1", traceId: "t1", artifactId: "art1" });
    expect((await repo.get("run1"))?.outcome?.type).toBe("committed");
  });

  it("listByProcedure filters by procedure version id", async () => {
    const repo = new InMemoryRunRepository();
    await repo.create(baseRun({ id: "run1", procedureVersionId: "pv1" }));
    await repo.create(baseRun({ id: "run2", procedureVersionId: "pv2" }));
    const got = await repo.listByProcedure("pv1");
    expect(got.map((r) => r.id)).toEqual(["run1"]);
  });
});

describe("InMemoryTraceRepository", () => {
  it("creates a head trace then appends a step", async () => {
    const repo = new InMemoryTraceRepository();
    const trace: Trace = {
      id: "t1", runId: "run1", procedureVersionId: null, workflowVersion: "v1",
      domain: "quote", createdAt: "2026-06-16T00:00:00Z", steps: [], outcome: null,
    };
    await repo.create(trace);
    const step: TraceStep = {
      index: 0, at: "2026-06-16T00:00:01Z", input: null,
      action: {
        id: "a1", actionType: "lookup_catalog", verifierName: null, targetField: null, rationale: "r",
        expectedEntropyReduction: 0.1, expectedRiskReduction: 0, tokenCost: 0.01,
        latencyCost: 0.01, humanBurdenCost: 0, toolCost: 0.01, score: 0.07,
      },
      toolOutput: null,
      entropyBefore: { taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0, policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0 },
      entropyAfter: { taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0, policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0 },
    };
    await repo.append("t1", step);
    expect((await repo.get("t1"))?.steps).toHaveLength(1);
  });
});

describe("InMemoryProcedureVersionRepository", () => {
  it("getLatest returns the newest version for a domain", async () => {
    const repo = new InMemoryProcedureVersionRepository();
    await repo.put(makeVersion({ id: "pv1", name: "Customer Quote", domain: "quote", createdAt: "2026-06-16T00:00:00Z" }));
    await repo.put(makeVersion({ id: "pv2", name: "Customer Quote", domain: "quote", createdAt: "2026-06-16T01:00:00Z" }));
    expect((await repo.getLatest("quote"))?.id).toBe("pv2");
    expect(await repo.getLatest("hr_policy")).toBeNull();
  });
});
