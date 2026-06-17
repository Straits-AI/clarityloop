import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import { InMemoryRunRepository, InMemoryProcedureVersionRepository } from "@clarityloop/storage";
import { SEED_CASES } from "@clarityloop/evals";
import type { ModelProvider } from "@clarityloop/qwen";
import type { BusinessProcedureVersion, ToolName, WorkflowSpec, WorkflowStep } from "@clarityloop/core";

const fakeProvider: ModelProvider = { async complete() { return "ok"; } };
const fakeProviderReplying = (reply: string): ModelProvider => ({ async complete() { return reply; } });

const apiToolStep = (id: string, toolName: ToolName): WorkflowStep => ({
  id,
  name: id,
  purpose: `run ${toolName}`,
  action: { type: "tool", toolName, args: {} },
  expectedOutputs: ["out"],
  evidenceProduced: null,
  entropyTarget: "evidenceEntropy",
});

const apiSpec = (version: string, tools: ToolName[]): WorkflowSpec => ({
  id: `spec-${version}`,
  name: "customer-quote",
  goal: "produce a safe quote",
  version,
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote"] },
  steps: [
    { id: "s_parse", name: "parse", purpose: "parse", action: { type: "model", promptTemplate: "p" }, expectedOutputs: ["facts"], evidenceProduced: null, entropyTarget: "taskEntropy" },
    ...tools.map((t) => apiToolStep(`s_${t}`, t)),
  ],
  allowedTools: tools.map((toolName) => ({ toolName, defaultArgs: null })),
  evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
  commitPolicy: { autoCommitAllowed: true, requireApprovalIf: { quoteValueAbove: null, discountAbovePct: null, evidenceCoverageBelow: null, deliveryUnconfirmed: null, externalSend: null, policyException: null }, forbiddenActions: [], commitEntropyThreshold: 0.3 },
  memoryPolicy: { writeEnabled: true, allowedTypes: ["CustomerPreference"], minMemoryValueToWrite: 0.1, defaultTtlDays: 180, maxEntriesPerScope: 50, conflictResolution: "prefer_higher_confidence" },
  budgetPolicy: { maxLoopIterations: 8, maxTokens: 20000, maxToolCalls: 12, maxHumanAsks: 2, maxLatencyMs: 60000 },
});

const apiVersion = (id: string, version: string): BusinessProcedureVersion =>
  ({
    id,
    parentVersion: null,
    name: "customer-quote",
    goal: "produce a safe quote",
    workflowSpec: apiSpec(version, ["draft_quote"]),
    allowedTools: [{ toolName: "draft_quote", level: "draft", maxRiskClass: "L1", constraints: null }],
    authorityBoundary: { autoCommitMaxRiskClass: "L1", approvalRequiredFor: [], forbiddenActions: [], allowedTools: [] },
    evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
    riskClass: "L1",
    commitPolicy: apiSpec(version, ["draft_quote"]).commitPolicy,
    memoryPolicy: apiSpec(version, ["draft_quote"]).memoryPolicy,
    evalResults: [],
    approvalRecord: null,
    rollbackPointer: null,
    runTraces: [],
    createdAt: "2026-06-16T00:00:00Z",
    promotedAt: null,
  }) as unknown as BusinessProcedureVersion;

const apiPatchJson = JSON.stringify({
  id: "patch-1",
  rationale: "add evidence tools",
  triggerCondition: "same as last time",
  sourceTraceId: "trace_001",
  expectedEntropyReduction: 0.31,
  ops: [
    { op: "insert_step", afterStepId: "s_parse", step: { id: "s_retrieve_memory", name: "retrieve", purpose: "m", action: { type: "tool", toolName: "retrieve_memory", args: {} }, expectedOutputs: ["mem"], evidenceProduced: null, entropyTarget: "memoryEntropy" } },
    { op: "insert_step", afterStepId: "s_retrieve_memory", step: { id: "s_lookup_catalog", name: "catalog", purpose: "p", action: { type: "tool", toolName: "lookup_catalog", args: {} }, expectedOutputs: ["price"], evidenceProduced: null, entropyTarget: "evidenceEntropy" } },
    { op: "insert_step", afterStepId: "s_lookup_catalog", step: { id: "s_compare_quote", name: "compare", purpose: "r", action: { type: "tool", toolName: "compare_quote", args: {} }, expectedOutputs: ["deltas"], evidenceProduced: null, entropyTarget: "evidenceEntropy" } },
  ],
});

const failureCtxBody = {
  procedureVersionId: "pv-1",
  domain: "quote",
  traceId: "trace_001",
  failureSummary: "stale price, assumed SKU",
  finalEntropy: { taskEntropy: 0.5, evidenceEntropy: 0.4, actionEntropy: 0.45, policyEntropy: 0, memoryEntropy: 1, commitEntropy: 0.4 },
  outcomeType: "committed",
  currentSteps: apiSpec("v1", ["draft_quote"]).steps,
};

describe("api app", () => {
  it("GET /health returns ok", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("POST /score computes commit entropy deterministically", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [],
        claims: [{ id: "c1", text: "x", evidencePointer: null }],
        riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commitEntropy).toBeCloseTo(0.25, 5);
  });

  it("POST /runs/stream streams entropy updates as SSE (fake provider)", async () => {
    const provider: ModelProvider = {
      async complete() {
        return JSON.stringify({
          knownFacts: [],
          missingFields: [{ id: "m1", name: "sku", necessity: "required" }],
          claims: [{ id: "c1", text: "price", evidencePointer: null }],
          riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
        });
      },
    };
    const app = createApp({ provider });
    const res = await app.request("/runs/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "quote 120 cartons", workflowVersion: "v1", goal: "draft a quote" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: entropy");
    expect(text).toContain('"commitEntropy":0.5'); // 0.25 missing + 0.25 unsupported
    expect(text).toContain('"phase":"done"');
  });

  it("GET /demo/entropy-stream streams the canonical 0.82->0.44->0.18 sequence", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/demo/entropy-stream?paceMs=0");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"commitEntropy":0.81875');
    expect(text).toContain('"commitEntropy":0.18125');
    expect(text).toContain('"phase":"done"');
  });
});

describe("promotion routes", () => {
  it("POST /procedures/:id/improve returns a validated patch", async () => {
    const procedureRepo = new InMemoryProcedureVersionRepository();
    await procedureRepo.put(apiVersion("pv-1", "v1"));
    const app = createApp({ provider: fakeProviderReplying(apiPatchJson), procedureRepo, replayCases: SEED_CASES });
    const res = await app.request("/procedures/pv-1/improve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failureContext: failureCtxBody }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patch.ops).toHaveLength(3);
  });

  it("POST /procedures/:id/promote replays, gates, and persists a child version", async () => {
    const procedureRepo = new InMemoryProcedureVersionRepository();
    await procedureRepo.put(apiVersion("pv-1", "v1"));
    const app = createApp({ provider: fakeProviderReplying(apiPatchJson), procedureRepo, replayCases: SEED_CASES });

    const improve = await app.request("/procedures/pv-1/improve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failureContext: failureCtxBody }),
    });
    const { patch } = await improve.json();

    const res = await app.request("/procedures/pv-1/promote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ patch }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.type).toBe("promote");
    expect(body.newVersionId).toBeTruthy();

    const versions = await procedureRepo.listVersions("customer-quote");
    expect(versions).toHaveLength(2);
    const child = versions.find((v: BusinessProcedureVersion) => v.id === body.newVersionId)!;
    expect(child.parentVersion).toBe("pv-1");
    expect(child.promotedAt).not.toBeNull();
  });

  it("GET /procedures/:name/versions returns the lineage", async () => {
    const procedureRepo = new InMemoryProcedureVersionRepository();
    await procedureRepo.put(apiVersion("pv-1", "v1"));
    const app = createApp({ provider: fakeProviderReplying(apiPatchJson), procedureRepo, replayCases: SEED_CASES });
    const res = await app.request("/procedures/customer-quote/versions");
    expect(res.status).toBe(200);
    expect((await res.json()).versions).toHaveLength(1);
  });
});
