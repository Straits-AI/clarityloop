import { describe, it, expect } from "vitest";
import {
  PgRunRepository, PgTraceRepository, PgProcedureVersionRepository, type PgQueryable,
} from "./pg-repository";
import { INIT_SQL } from "./schema-sql";
import type { RunRecord } from "./repository";
import type { BusinessProcedureVersion, TraceStep } from "@clarityloop/core";

class FakePg implements PgQueryable {
  public calls: Array<{ text: string; params: unknown[] }> = [];
  private callIndex = 0;
  constructor(private readonly rowsByCall: Array<Array<Record<string, unknown>>> = []) {}
  async query(text: string, params: unknown[] = []): Promise<{ rows: Array<Record<string, unknown>> }> {
    this.calls.push({ text, params });
    const rows = this.rowsByCall[this.callIndex] ?? [];
    this.callIndex += 1;
    return { rows };
  }
}

describe("PgRunRepository", () => {
  it("INSERTs a run with serialized params", async () => {
    const db = new FakePg();
    const run: RunRecord = {
      id: "run1", procedureVersionId: null, domain: "quote", inputRequest: "quote 120 cartons",
      workflowSpec: null, traceId: null, outcome: null, createdAt: "2026-06-16T00:00:00Z",
    };
    await new PgRunRepository(db).create(run);
    expect(db.calls[0].text).toContain("INSERT INTO runs");
    expect(db.calls[0].params[0]).toBe("run1");
    expect(db.calls[0].params[2]).toBe("quote");
  });

  it("maps a returned jsonb row back into a RunRecord", async () => {
    const db = new FakePg([[
      {
        id: "run1", procedure_version_id: null, domain: "quote", input_request: "x",
        workflow_spec: null, trace_id: null, outcome: null, created_at: "2026-06-16T00:00:00Z",
      },
    ]]);
    const got = await new PgRunRepository(db).get("run1");
    expect(got?.id).toBe("run1");
    expect(got?.domain).toBe("quote");
  });

  it("returns null when no row is found", async () => {
    expect(await new PgRunRepository(new FakePg([[]])).get("missing")).toBeNull();
  });
});

describe("PgTraceRepository.append", () => {
  it("appends a step via jsonb array concatenation", async () => {
    const db = new FakePg();
    const step: TraceStep = {
      index: 0, at: "2026-06-16T00:00:00Z", input: null,
      action: {
        id: "a1", actionType: "lookup_catalog", verifierName: null, targetField: null, rationale: "r",
        expectedEntropyReduction: 0.1, expectedRiskReduction: 0, tokenCost: 0.01,
        latencyCost: 0.01, humanBurdenCost: 0, toolCost: 0.01, score: 0.07,
      },
      toolOutput: null,
      entropyBefore: { taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0, policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0 },
      entropyAfter: { taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0, policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0 },
    };
    await new PgTraceRepository(db).append("t1", step);
    expect(db.calls[0].text).toContain("steps = steps || $2::jsonb");
    expect(db.calls[0].params[0]).toBe("t1");
    expect(JSON.parse(db.calls[0].params[1] as string)).toHaveLength(1);
  });
});

describe("PgProcedureVersionRepository.put", () => {
  it("promotes the domain from the workflow spec into the indexed column", async () => {
    const db = new FakePg();
    // Partial cast: put only reads id/parentVersion/name/workflowSpec.trigger.domain/createdAt/promotedAt.
    const version = {
      id: "pv1", parentVersion: null, name: "Customer Quote",
      workflowSpec: { trigger: { domain: "quote" } },
      createdAt: "2026-06-16T00:00:00Z", promotedAt: null,
    } as unknown as BusinessProcedureVersion;
    await new PgProcedureVersionRepository(db).put(version);
    expect(db.calls[0].text).toContain("INSERT INTO procedure_versions");
    expect(db.calls[0].params[3]).toBe("quote");
  });
});

describe("INIT_SQL", () => {
  it("defines the three Plan 2 tables", () => {
    expect(INIT_SQL).toContain("CREATE TABLE IF NOT EXISTS runs");
    expect(INIT_SQL).toContain("CREATE TABLE IF NOT EXISTS traces");
    expect(INIT_SQL).toContain("CREATE TABLE IF NOT EXISTS procedure_versions");
  });
});
