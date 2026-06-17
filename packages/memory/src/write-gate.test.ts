import { describe, it, expect } from "vitest";
import type { MemoryPolicy, OperationalMemory } from "@clarityloop/core";
import { InMemoryMemoryRepository } from "@clarityloop/storage";
import { memoryWriteGate, isExpired, commitMemory, type MemoryWriteCandidate } from "./write-gate";

const policy: MemoryPolicy = {
  writeEnabled: true,
  allowedTypes: ["CustomerPreference"],
  minMemoryValueToWrite: 0.5,
  defaultTtlDays: 180,
  maxEntriesPerScope: 50,
  conflictResolution: "prefer_higher_confidence",
};

const pref = (over: Partial<OperationalMemory> = {}): OperationalMemory =>
  ({
    type: "CustomerPreference",
    entity: "Customer ABC",
    fact: "Prefers delivery before Thursday noon",
    id: "mem-1",
    scope: "logistics",
    source: "approved_quote_2026_06_10",
    confidence: 0.86,
    ttlDays: 180,
    createdAt: "2026-06-10T00:00:00Z",
    lastUsedAt: null,
    value: 1.4,
    ...over,
  }) as OperationalMemory;

const candidate = (over: Partial<MemoryWriteCandidate> = {}): MemoryWriteCandidate => ({
  memory: pref(),
  value: 1.4,
  evidenceSupported: true,
  reusable: true,
  ...over,
});

describe("memoryWriteGate", () => {
  it("writes a validated, high-value, reusable memory with no conflict", () => {
    const d = memoryWriteGate(candidate(), policy, []);
    expect(d.type).toBe("write");
  });

  it("rejects a memory unsupported by evidence", () => {
    const d = memoryWriteGate(candidate({ evidenceSupported: false }), policy, []);
    expect(d).toEqual({ type: "reject", reason: "unsupported by evidence" });
  });

  it("rejects one-off trivia that does not change future action selection", () => {
    const d = memoryWriteGate(candidate({ reusable: false }), policy, []);
    expect(d.type).toBe("reject");
  });

  it("rejects a memory below the value threshold", () => {
    const d = memoryWriteGate(candidate({ value: 0.1, memory: pref({ value: 0.1 }) }), policy, []);
    expect(d.type).toBe("reject");
  });

  it("rejects a type the policy does not allow", () => {
    const wf = pref({
      type: "WorkflowFailurePatch",
      trigger: "x",
      patch: "y",
      validatedByReplay: true,
      expectedEntropyReduction: 0.3,
    } as Partial<OperationalMemory>);
    const d = memoryWriteGate(candidate({ memory: wf }), policy, []);
    expect(d.type).toBe("reject");
  });

  it("rejects on conflict under reject_on_conflict policy", () => {
    const d = memoryWriteGate(candidate(), { ...policy, conflictResolution: "reject_on_conflict" }, [pref({ id: "old" })]);
    expect(d.type).toBe("reject");
  });

  it("supersedes a weaker conflicting memory under prefer_higher_confidence", () => {
    const d = memoryWriteGate(
      candidate({ memory: pref({ confidence: 0.95 }) }),
      policy,
      [pref({ id: "old", confidence: 0.6 })],
    );
    expect(d.type).toBe("supersede");
    if (d.type === "supersede") expect(d.replacedId).toBe("old");
  });
});

describe("isExpired", () => {
  it("is true once now exceeds createdAt + ttlDays", () => {
    expect(isExpired(pref({ createdAt: "2026-01-01T00:00:00Z", ttlDays: 30 }), new Date("2026-03-01T00:00:00Z"))).toBe(true);
  });
  it("is false within the TTL window", () => {
    expect(isExpired(pref({ createdAt: "2026-06-01T00:00:00Z", ttlDays: 30 }), new Date("2026-06-10T00:00:00Z"))).toBe(false);
  });
});

describe("commitMemory", () => {
  it("persists a validated memory via the repository", async () => {
    const repo = new InMemoryMemoryRepository();
    const d = await commitMemory(repo, candidate(), policy);
    expect(d.type).toBe("write");
    expect(await repo.get("mem-1")).not.toBeNull();
  });

  it("does not persist a rejected (junk) memory", async () => {
    const repo = new InMemoryMemoryRepository();
    const d = await commitMemory(repo, candidate({ evidenceSupported: false }), policy);
    expect(d.type).toBe("reject");
    expect(await repo.get("mem-1")).toBeNull();
  });
});
