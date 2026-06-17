import { describe, it, expect } from "vitest";
import { makeCheckStockTool, CheckStockArgsSchema } from "./check-stock";

describe("check_stock tool", () => {
  it("reports availability when on-hand covers the quantity", async () => {
    const tool = makeCheckStockTool();
    const res = await tool.run(CheckStockArgsSchema.parse({ sku: "CTN-COFFEE-1KG", quantity: 120 }));
    expect(res.ok).toBe(true);
    expect(res.data?.available).toBe(true);
    expect(res.data?.leadTimeDays).toBe(3);
    expect(res.evidence[0].kind).toBe("stock");
  });

  it("reports unavailable when quantity exceeds on-hand", async () => {
    const tool = makeCheckStockTool();
    const res = await tool.run(CheckStockArgsSchema.parse({ sku: "CTN-TEA-500G", quantity: 120 }));
    expect(res.data?.available).toBe(false);
  });

  it("returns ok:false for an unknown sku", async () => {
    const tool = makeCheckStockTool();
    const res = await tool.run(CheckStockArgsSchema.parse({ sku: "NOPE", quantity: 1 }));
    expect(res.ok).toBe(false);
  });
});
