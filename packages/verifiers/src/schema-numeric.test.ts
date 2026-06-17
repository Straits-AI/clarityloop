import { describe, it, expect } from "vitest";
import { schemaVerifier } from "./schema";
import { numericReconciliationVerifier } from "./numeric-reconciliation";
import { makeState, makeWorkflowSpec } from "./test-helpers";

const validQuote = {
  customer: "ABC",
  currency: "MYR",
  lineItems: [{ sku: "A1", description: "carton", quantity: 120, unitPrice: 10, lineTotal: 1200 }],
  total: 1200,
  deliveryDate: "2026-06-20",
};

describe("schemaVerifier", () => {
  it("passes (info) when there is no draft artifact", () => {
    const checks = schemaVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks[0]).toMatchObject({ passed: true, severity: "info", verifier: "schema" });
  });
  it("passes a valid quote artifact", () => {
    const checks = schemaVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: validQuote });
    expect(checks[0].passed).toBe(true);
  });
  it("blocks an artifact missing required keys", () => {
    const checks = schemaVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: { customer: "ABC" } });
    expect(checks[0]).toMatchObject({ passed: false, severity: "blocking" });
  });
});

describe("numericReconciliationVerifier", () => {
  it("passes when line totals and quote total reconcile", () => {
    const checks = numericReconciliationVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: validQuote });
    expect(checks.every((c) => c.passed)).toBe(true);
  });
  it("blocks when the quote total != sum of line items", () => {
    const checks = numericReconciliationVerifier.run({
      state: makeState(),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: { ...validQuote, total: 999 },
    });
    expect(checks.some((c) => c.name === "quote_total" && !c.passed && c.severity === "blocking")).toBe(true);
  });
  it("blocks when a line total != quantity x unitPrice", () => {
    const checks = numericReconciliationVerifier.run({
      state: makeState(),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: {
        ...validQuote,
        lineItems: [{ sku: "A1", description: "c", quantity: 120, unitPrice: 10, lineTotal: 1300 }],
        total: 1300,
      },
    });
    expect(checks.some((c) => c.name === "line_total:A1" && !c.passed)).toBe(true);
  });
  it("skips (info) when there is no valid quote artifact", () => {
    const checks = numericReconciliationVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks[0]).toMatchObject({ passed: true, severity: "info" });
  });
});
