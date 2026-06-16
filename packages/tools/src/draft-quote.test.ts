import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore } from "@clarityloop/storage";
import { makeDraftQuoteTool, DraftQuoteArgsSchema } from "./draft-quote";

describe("draft_quote tool", () => {
  it("writes a draft quote artifact and returns its key + total", async () => {
    const store = new InMemoryArtifactStore();
    const tool = makeDraftQuoteTool(store);
    expect(tool.permission).toBe("draft");
    const res = await tool.run(
      DraftQuoteArgsSchema.parse({
        customer: "Customer ABC",
        lineItems: [{ sku: "CTN-COFFEE-1KG", quantity: 120, unitPrice: 42.5 }],
        deliveryDate: "2026-06-22",
      }),
    );
    expect(res.ok).toBe(true);
    expect(res.data?.artifactKey).toBe("quotes/customer-abc.json");
    expect(res.data?.total).toBe(5100);
    const stored = await store.get("quotes/customer-abc.json");
    expect(JSON.parse(stored!).total).toBe(5100);
  });
});
