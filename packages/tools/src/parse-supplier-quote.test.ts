import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore } from "@clarityloop/storage";
import type { ChatMessage, ModelProvider } from "@clarityloop/qwen";
import { makeParseSupplierQuoteTool, ParseSupplierQuoteArgsSchema } from "./parse-supplier-quote";

const fakeProvider = (reply: string): ModelProvider => ({ async complete() { return reply; } });

/** Captures the messages the tool sends, so we can prove a real image part is transmitted. */
function capturingProvider(reply: string): { provider: ModelProvider; seen: ChatMessage[][] } {
  const seen: ChatMessage[][] = [];
  return { seen, provider: { async complete(messages) { seen.push(messages); return reply; } } };
}

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

  it("sends the image as a real image_url part to qwen-vl-plus when the artifact is an image", async () => {
    const store = new InMemoryArtifactStore();
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
    await store.put("uploads/sheet.png", dataUrl);
    const { provider, seen } = capturingProvider("```json\n" + VALID + "\n```");
    const tool = makeParseSupplierQuoteTool({ provider, store });
    const res = await tool.run(ParseSupplierQuoteArgsSchema.parse({ artifactKey: "uploads/sheet.png" }));
    expect(res.ok).toBe(true);
    const userMsg = seen[0].find((m) => m.role === "user");
    expect(Array.isArray(userMsg?.content)).toBe(true);
    const parts = userMsg!.content as Array<{ type: string; image_url?: { url: string } }>;
    const imagePart = parts.find((p) => p.type === "image_url");
    expect(imagePart).toBeDefined();
    expect(imagePart!.image_url!.url).toBe(dataUrl); // the actual image bytes reach the vision model
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
