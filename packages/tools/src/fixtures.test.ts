import { describe, it, expect } from "vitest";
import { InMemoryMemoryRepository } from "@clarityloop/storage";
import { SEED_CATALOG, SEED_STOCK, SEED_MEMORIES, seedMemoryRepository } from "./fixtures";

describe("tool fixtures", () => {
  it("seeds a coffee SKU in catalog + stock", () => {
    expect(SEED_CATALOG.find((c) => c.sku === "CTN-COFFEE-1KG")?.unitPrice).toBe(42.5);
    expect(SEED_STOCK.find((s) => s.sku === "CTN-COFFEE-1KG")?.available).toBe(500);
  });

  it("seeds an approved CustomerPreference memory and loads it into a repo", async () => {
    expect(SEED_MEMORIES[0].type).toBe("CustomerPreference");
    const repo = new InMemoryMemoryRepository();
    await seedMemoryRepository(repo);
    const got = await repo.query({ scope: "quote_workflows", entity: "Customer ABC" });
    expect(got).toHaveLength(1);
  });
});
