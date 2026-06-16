import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import { InMemoryRunRepository } from "@clarityloop/storage";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeProvider: ModelProvider = { async complete() { return "ok"; } };

const makeApp = () =>
  createApp({
    provider: fakeProvider,
    runs: new InMemoryRunRepository(),
    allowedTools: ["retrieve_memory", "lookup_catalog", "check_stock", "parse_supplier_quote", "compare_quote", "draft_quote"],
  });

describe("api app", () => {
  it("GET /health returns ok", async () => {
    const res = await makeApp().request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("POST /score computes commit entropy deterministically", async () => {
    const res = await makeApp().request("/score", {
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
});
