import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import { InMemoryRunRepository } from "@clarityloop/storage";
import type { ModelProvider } from "@clarityloop/qwen";

// Qwen now returns a forgiving OUTLINE; deterministic code assembles the full WorkflowSpec.
const cannedOutline = {
  name: "Customer Quote",
  goal: "Produce a defensible customer quote",
  naturalLanguagePatterns: ["quote for", "price for"],
  steps: [
    { name: "Price lookup", purpose: "fetch catalog price", tool: "lookup_catalog" },
    { name: "Draft", purpose: "draft the quote", tool: "draft_quote" },
  ],
  toolsToUse: ["lookup_catalog", "draft_quote"],
};

const fakeProvider: ModelProvider = {
  async complete() { return JSON.stringify(cannedOutline); },
};

// A deliberately malformed reply (no JSON object) to exercise the robust fallback path.
const junkProvider: ModelProvider = {
  async complete() { return "Sorry, I can only help with quotes."; },
};

describe("POST /workflow", () => {
  it("generates, validates, and persists a WorkflowSpec when all tools are authorized", async () => {
    const runs = new InMemoryRunRepository();
    const app = createApp({
      provider: fakeProvider, runs,
      allowedTools: ["retrieve_memory", "lookup_catalog", "check_stock", "parse_supplier_quote", "compare_quote", "draft_quote"],
      newId: () => "run_test_1",
    });
    const res = await app.request("/workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "quote 120 cartons for ABC", domain: "quote" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runId).toBe("run_test_1");
    expect(body.workflowSpec.name).toBe("Customer Quote");
    expect(body.workflowSpec.trigger.domain).toBe("quote");
    expect(body.workflowSpec.steps).toHaveLength(2);
    expect(body.workflowSpec.allowedTools.map((t: { toolName: string }) => t.toolName)).toEqual([
      "lookup_catalog",
      "draft_quote",
    ]);
    const persisted = await runs.get("run_test_1");
    expect(persisted?.workflowSpec?.trigger.domain).toBe("quote");
    expect(persisted?.inputRequest).toBe("quote 120 cartons for ABC");
  });

  it("falls back to a valid WorkflowSpec when the model output is malformed (no 500)", async () => {
    const runs = new InMemoryRunRepository();
    const app = createApp({
      provider: junkProvider, runs,
      allowedTools: ["retrieve_memory", "lookup_catalog", "check_stock", "parse_supplier_quote", "compare_quote", "draft_quote"],
      newId: () => "run_test_3",
    });
    const res = await app.request("/workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "quote 120 cartons", domain: "quote" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workflowSpec.trigger.domain).toBe("quote");
    expect(body.workflowSpec.version).toBe("v1");
  });

  it("rejects with 422 when the generated workflow requests an unauthorized tool", async () => {
    const runs = new InMemoryRunRepository();
    const app = createApp({
      provider: fakeProvider, runs,
      allowedTools: ["retrieve_memory", "lookup_catalog"], // draft_quote intentionally omitted
      newId: () => "run_test_2",
    });
    const res = await app.request("/workflow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "quote 120 cartons", domain: "quote" }),
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("unauthorized_tool");
    expect(body.unauthorizedTools).toContain("draft_quote");
    expect(await runs.get("run_test_2")).toBeNull();
  });
});
