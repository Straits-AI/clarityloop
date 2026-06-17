import { describe, it, expect } from "vitest";
import { BenchmarkCaseSchema, CaseTypeSchema } from "./types";
import { ALL_CASES } from "./cases";

describe("ClarityLoopBench seed corpus", () => {
  it("has 30–50 cases", () => {
    expect(ALL_CASES.length).toBeGreaterThanOrEqual(30);
    expect(ALL_CASES.length).toBeLessThanOrEqual(50);
  });

  it("every case is schema-valid and has a unique id", () => {
    const ids = new Set<string>();
    for (const c of ALL_CASES) {
      expect(() => BenchmarkCaseSchema.parse(c)).not.toThrow();
      expect(ids.has(c.id)).toBe(false);
      ids.add(c.id);
    }
  });

  it("covers all twelve case types", () => {
    const present = new Set(ALL_CASES.map((c) => c.caseType));
    for (const t of CaseTypeSchema.options) expect(present.has(t)).toBe(true);
  });

  it("covers both domains", () => {
    const domains = new Set(ALL_CASES.map((c) => c.domain));
    expect(domains.has("quote")).toBe(true);
    expect(domains.has("supplier_comparison")).toBe(true);
  });
});
