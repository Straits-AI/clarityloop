import { describe, it, expect } from "vitest";
import { OperationalMemorySchema } from "./memory";

describe("OperationalMemorySchema", () => {
  it("parses a CustomerPreference memory", () => {
    const mem = OperationalMemorySchema.parse({
      type: "CustomerPreference",
      entity: "Customer ABC",
      fact: "Reorders CTN-COFFEE-1KG x120, delivery before Thursday noon",
      id: "m1",
      scope: "quote_workflows",
      source: "approved_quote_2026_05_02",
      confidence: 0.86,
      ttlDays: 180,
      createdAt: "2026-05-02T00:00:00Z",
      lastUsedAt: null,
      value: 0.31,
    });
    expect(mem.type).toBe("CustomerPreference");
    if (mem.type === "CustomerPreference") expect(mem.entity).toBe("Customer ABC");
  });

  it("parses an EvidenceSource memory referencing a tool + claim category", () => {
    const mem = OperationalMemorySchema.parse({
      type: "EvidenceSource",
      claimCategory: "price",
      sourceTool: "lookup_catalog",
      id: "m2",
      scope: "quote_workflows",
      source: "trace_002",
      confidence: 0.9,
      ttlDays: 90,
      createdAt: "2026-06-11T00:00:00Z",
      lastUsedAt: null,
      value: 0.2,
    });
    if (mem.type === "EvidenceSource") expect(mem.sourceTool).toBe("lookup_catalog");
  });

  it("rejects an unknown memory type", () => {
    expect(() => OperationalMemorySchema.parse({ type: "ChatLog", id: "m1" })).toThrow();
  });
});
