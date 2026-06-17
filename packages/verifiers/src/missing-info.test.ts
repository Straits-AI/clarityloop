import { describe, it, expect } from "vitest";
import { missingInfoVerifier } from "./missing-info";
import { makeState, makeWorkflowSpec } from "./test-helpers";

describe("missingInfoVerifier", () => {
  it("passes (info) when no required field is outstanding", () => {
    const checks = missingInfoVerifier.run({
      state: makeState({ missingFields: [{ id: "m1", name: "sku", necessity: "optional" }] }),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: null,
    });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ passed: true, severity: "info", verifier: "missing_info" });
  });

  it("blocks once per unresolved required field", () => {
    const checks = missingInfoVerifier.run({
      state: makeState({
        missingFields: [
          { id: "m1", name: "delivery_date", necessity: "required" },
          { id: "m2", name: "exact_sku", necessity: "required" },
        ],
      }),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: null,
    });
    expect(checks).toHaveLength(2);
    expect(checks.every((c) => !c.passed && c.severity === "blocking")).toBe(true);
  });
});
