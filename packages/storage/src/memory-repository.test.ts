import { describe, it, expect } from "vitest";
import { InMemoryMemoryRepository } from "./memory-repository";
import type { OperationalMemory } from "@clarityloop/core";

const pref: OperationalMemory = {
  type: "CustomerPreference",
  entity: "Customer ABC",
  fact: "Reorders CTN-COFFEE-1KG x120",
  id: "m1",
  scope: "quote_workflows",
  source: "trace_001",
  confidence: 0.86,
  ttlDays: 180,
  createdAt: "2026-05-02T00:00:00Z",
  lastUsedAt: null,
  value: 0.31,
};

const evid: OperationalMemory = {
  type: "EvidenceSource",
  claimCategory: "price",
  sourceTool: "lookup_catalog",
  id: "m2",
  scope: "other_scope",
  source: "trace_002",
  confidence: 0.9,
  ttlDays: 90,
  createdAt: "2026-06-11T00:00:00Z",
  lastUsedAt: null,
  value: 0.2,
};

describe("InMemoryMemoryRepository", () => {
  it("puts and gets by id, null for misses", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    expect((await repo.get("m1"))?.id).toBe("m1");
    expect(await repo.get("missing")).toBeNull();
  });

  it("queries by scope", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    await repo.put(evid);
    expect((await repo.query({ scope: "quote_workflows" })).map((m) => m.id)).toEqual(["m1"]);
  });

  it("queries by type", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    await repo.put(evid);
    expect((await repo.query({ type: "EvidenceSource" })).map((m) => m.id)).toEqual(["m2"]);
  });

  it("queries by entity (only CustomerPreference carries one)", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    await repo.put(evid);
    expect((await repo.query({ entity: "Customer ABC" })).map((m) => m.id)).toEqual(["m1"]);
    expect(await repo.query({ entity: "Nobody" })).toEqual([]);
  });

  it("invalidate removes the entry", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    await repo.invalidate("m1");
    expect(await repo.get("m1")).toBeNull();
  });
});
