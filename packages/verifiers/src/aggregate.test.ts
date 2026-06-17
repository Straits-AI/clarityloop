import { describe, it, expect } from "vitest";
import { allVerifiers, runAllVerifiers } from "./aggregate";
import { makeState, makeWorkflowSpec } from "./test-helpers";

describe("verifier registry", () => {
  it("registers all six verifiers by name", () => {
    expect(allVerifiers.map((v) => v.name).sort()).toEqual([
      "evidence_coverage",
      "hallucinated_tool",
      "missing_info",
      "numeric_reconciliation",
      "policy",
      "schema",
    ]);
  });

  it("runAllVerifiers concatenates checks from every verifier", () => {
    const checks = runAllVerifiers({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    const verifiers = new Set(checks.map((c) => c.verifier));
    expect(verifiers).toEqual(
      new Set(["schema", "numeric_reconciliation", "evidence_coverage", "policy", "hallucinated_tool", "missing_info"]),
    );
  });
});
