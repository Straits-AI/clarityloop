import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import { InMemoryRunRepository } from "@clarityloop/storage";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeProvider: ModelProvider = { async complete() { return "ok"; } };

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
