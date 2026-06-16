import { describe, it, expect } from "vitest";
import { makeCompareQuoteTool, CompareQuoteArgsSchema } from "./compare-quote";

const supplier = {
  lineItems: [{ sku: "CTN-COFFEE-1KG", description: "Coffee", quantity: 120, unitPrice: 41.0 }],
  total: 4920,
  currency: "MYR",
};

describe("compare_quote tool", () => {
  it("flags within-policy when supplier matches catalog closely", async () => {
    const tool = makeCompareQuoteTool();
    const res = await tool.run(CompareQuoteArgsSchema.parse({ supplier, catalog: [{ sku: "CTN-COFFEE-1KG", unitPrice: 42.5 }] }));
    expect(res.ok).toBe(true);
    expect(res.data?.withinPolicy).toBe(true);
    expect(res.data?.deltas[0].deltaPct).toBeCloseTo((41.0 - 42.5) / 42.5, 5);
    expect((res as unknown as Record<string, unknown>).permission).toBeUndefined(); // ToolResult carries no permission field
    expect(tool.permission).toBe("draft");
  });

  it("flags out-of-policy when supplier deviates beyond maxDeltaPct", async () => {
    const tool = makeCompareQuoteTool();
    const res = await tool.run(CompareQuoteArgsSchema.parse({ supplier, catalog: [{ sku: "CTN-COFFEE-1KG", unitPrice: 30.0 }] }));
    expect(res.data?.withinPolicy).toBe(false);
    expect(res.evidence[0].kind).toBe("pricing_policy");
  });

  it("treats a missing catalog match as out-of-policy", async () => {
    const tool = makeCompareQuoteTool();
    const res = await tool.run(CompareQuoteArgsSchema.parse({ supplier, catalog: [] }));
    expect(res.data?.deltas[0].catalogUnitPrice).toBeNull();
    expect(res.data?.withinPolicy).toBe(false);
  });
});
