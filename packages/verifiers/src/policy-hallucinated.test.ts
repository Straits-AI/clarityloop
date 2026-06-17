import { describe, it, expect } from "vitest";
import { policyVerifier } from "./policy";
import { hallucinatedToolVerifier } from "./hallucinated-tool";
import { makeState, makeWorkflowSpec } from "./test-helpers";

describe("policyVerifier", () => {
  it("is clear (info) when there are no policy flags", () => {
    const checks = policyVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks[0]).toMatchObject({ name: "policy_clear", passed: true, severity: "info" });
  });
  it("blocks a forbidden action present as a policy flag", () => {
    const state = makeState({ policyFlags: [{ id: "p1", rule: "bypass_credit_check", ambiguous: false }] });
    const checks = policyVerifier.run({ state, evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks.some((c) => !c.passed && c.severity === "blocking")).toBe(true);
  });
  it("warns on an ambiguous policy", () => {
    const state = makeState({ policyFlags: [{ id: "p1", rule: "discount_tier", ambiguous: true }] });
    const checks = policyVerifier.run({ state, evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks.some((c) => c.severity === "warn")).toBe(true);
  });
  it("warns when a quote total exceeds the approval value threshold", () => {
    const checks = policyVerifier.run({
      state: makeState(),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: {
        customer: "ABC",
        currency: "MYR",
        lineItems: [{ sku: "A1", description: "c", quantity: 1, unitPrice: 20000, lineTotal: 20000 }],
        total: 20000,
        deliveryDate: null,
      },
    });
    expect(checks.some((c) => c.name === "high_value_quote" && c.severity === "warn")).toBe(true);
  });
});

describe("hallucinatedToolVerifier", () => {
  it("passes when every tool step is declared", () => {
    const checks = hallucinatedToolVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks[0]).toMatchObject({ name: "all_tools_declared", passed: true });
  });
  it("blocks a step that calls an undeclared tool", () => {
    const spec = makeWorkflowSpec({ allowedTools: [{ toolName: "lookup_catalog", defaultArgs: null }] });
    const checks = hallucinatedToolVerifier.run({ state: makeState(), evidence: [], workflowSpec: spec, draftArtifact: null });
    expect(checks.some((c) => !c.passed && c.name.includes("draft_quote"))).toBe(true);
  });
});
