import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore } from "@clarityloop/storage";
import type { ModelProvider } from "@clarityloop/qwen";
import { makeParseSupplierQuoteTool, ParseSupplierQuoteArgsSchema } from "./parse-supplier-quote";

const fakeProvider = (reply: string): ModelProvider => ({ async complete() { return reply; } });

const VALID = JSON.stringify({
  lineItems: [{ sku: "CTN-COFFEE-1KG", description: "Coffee 1kg", quantity: 120, unitPrice: 41.0 }],
  total: 4920,
  currency: "MYR",
});

describe("parse_supplier_quote tool", () => {
  it("parses an uploaded quote via the model and emits supplier_quote evidence", async () => {
    const store = new InMemoryArtifactStore();
    await store.put("uploads/q1.txt", "Supplier ACME: 120 x CTN-COFFEE-1KG @ 41.00 MYR, total 4920 MYR");
    const tool = makeParseSupplierQuoteTool({ provider: fakeProvider("```json\n" + VALID + "\n```"), store });
    const res = await tool.run(ParseSupplierQuoteArgsSchema.parse({ artifactKey: "uploads/q1.txt" }));
    expect(res.ok).toBe(true);
    expect(res.data?.total).toBe(4920);
    expect(res.evidence[0].kind).toBe("supplier_quote");
  });

  it("returns ok:false when the artifact is missing", async () => {
    const store = new InMemoryArtifactStore();
    const tool = makeParseSupplierQuoteTool({ provider: fakeProvider(VALID), store });
    const res = await tool.run(ParseSupplierQuoteArgsSchema.parse({ artifactKey: "uploads/missing.txt" }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not found");
  });

  it("returns ok:false when the model output fails schema validation", async () => {
    const store = new InMemoryArtifactStore();
    await store.put("uploads/q2.txt", "garbled");
    const tool = makeParseSupplierQuoteTool({ provider: fakeProvider('{"lineItems":[]}'), store });
    const res = await tool.run(ParseSupplierQuoteArgsSchema.parse({ artifactKey: "uploads/q2.txt" }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("parse failed");
  });
});
