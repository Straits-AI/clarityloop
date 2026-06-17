import { describe, it, expect } from "vitest";
import { BenchmarkCaseSchema, SEED_CASES } from "./cases";

describe("SEED_CASES", () => {
  it("every seed case parses against the schema", () => {
    for (const c of SEED_CASES) expect(() => BenchmarkCaseSchema.parse(c)).not.toThrow();
  });

  it("covers the core promotion-demo case types", () => {
    const types = new Set(SEED_CASES.map((c) => c.caseType));
    expect(types.has("clear")).toBe(true);
    expect(types.has("same_as_last_time")).toBe(true);
    expect(types.has("stale_memory")).toBe(true);
    expect(types.has("unsupported_claim")).toBe(true);
  });

  it("has unique case ids", () => {
    const ids = SEED_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
