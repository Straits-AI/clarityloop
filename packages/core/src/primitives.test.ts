import { describe, it, expect } from "vitest";
import {
  EvidenceRefSchema, ToolNameSchema, WorkflowDomainSchema,
  VerifierNameSchema, RiskClassSchema, ClaimCategorySchema,
  EvidenceRequirementSchema, OperationalMemoryTypeSchema,
} from "./primitives";

describe("core primitives", () => {
  it("parses a valid EvidenceRef", () => {
    const e = EvidenceRefSchema.parse({
      id: "e1", kind: "catalog", sourceTool: "lookup_catalog",
      uri: null, snippet: "SKU A1 = $100", confidence: 0.9,
    });
    expect(e.kind).toBe("catalog");
  });

  it("rejects an EvidenceRef with confidence above 1", () => {
    expect(() =>
      EvidenceRefSchema.parse({
        id: "e1", kind: "catalog", sourceTool: null, uri: null, snippet: null, confidence: 1.5,
      }),
    ).toThrow();
  });

  it("enumerates the six tool names and six verifier names", () => {
    expect(ToolNameSchema.options).toContain("draft_quote");
    expect(ToolNameSchema.options).toHaveLength(6);
    expect(VerifierNameSchema.options).toContain("evidence_coverage");
    expect(VerifierNameSchema.options).toHaveLength(6);
  });

  it("rejects an unknown workflow domain", () => {
    expect(() => WorkflowDomainSchema.parse("logistics")).toThrow();
  });

  it("knows the risk-class order and the claim/evidence/memory vocabularies", () => {
    expect(RiskClassSchema.options).toEqual(["L0", "L1", "L2", "L3", "L4"]);
    expect(ClaimCategorySchema.options).toContain("price");
    expect(EvidenceRequirementSchema.options).toContain("pricing_policy");
    expect(OperationalMemoryTypeSchema.options).toContain("CustomerPreference");
  });
});
