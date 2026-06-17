import { describe, it, expect } from "vitest";
import { makeLookupCatalogTool, LookupCatalogArgsSchema } from "./lookup-catalog";

describe("lookup_catalog tool", () => {
  it("finds an entry by sku and emits catalog evidence", async () => {
    const tool = makeLookupCatalogTool();
    const res = await tool.run(LookupCatalogArgsSchema.parse({ sku: "CTN-COFFEE-1KG" }));
    expect(res.ok).toBe(true);
    expect(res.data?.unitPrice).toBe(42.5);
    expect(res.evidence[0].kind).toBe("catalog");
    expect(res.evidence[0].sourceTool).toBe("lookup_catalog");
  });

  it("finds an entry by fuzzy query", async () => {
    const tool = makeLookupCatalogTool();
    const res = await tool.run(LookupCatalogArgsSchema.parse({ query: "coffee" }));
    expect(res.data?.sku).toBe("CTN-COFFEE-1KG");
  });

  it("returns ok:false for an unknown sku", async () => {
    const tool = makeLookupCatalogTool();
    const res = await tool.run(LookupCatalogArgsSchema.parse({ sku: "NOPE" }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("NOPE");
  });
});
