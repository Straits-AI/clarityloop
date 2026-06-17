import { describe, it, expect } from "vitest";
import { computeEvidenceCoverage, evidenceCoverageVerifier } from "./evidence-coverage";
import { makeState, makeWorkflowSpec } from "./test-helpers";
import type { EvidenceRef } from "@clarityloop/core";

const ev: EvidenceRef = { id: "e1", kind: "catalog", sourceTool: "lookup_catalog", uri: null, snippet: "price 10", confidence: 0.9 };

describe("computeEvidenceCoverage", () => {
  it("is 1 when there are no claims", () => {
    expect(computeEvidenceCoverage(makeState(), [])).toBe(1);
  });
  it("counts only claims with resolvable evidence", () => {
    const state = makeState({
      claims: [
        { id: "c1", text: "price 10", evidencePointer: "e1" },
        { id: "c2", text: "discount ok", evidencePointer: null },
      ],
    });
    expect(computeEvidenceCoverage(state, [ev])).toBe(0.5);
  });
  it("treats a dangling evidencePointer as unsupported", () => {
    const state = makeState({ claims: [{ id: "c1", text: "x", evidencePointer: "missing" }] });
    expect(computeEvidenceCoverage(state, [ev])).toBe(0);
  });
});

describe("evidenceCoverageVerifier", () => {
  it("passes the threshold check when coverage meets the minimum", () => {
    const state = makeState({ claims: [{ id: "c1", text: "price 10", evidencePointer: "e1" }] });
    const checks = evidenceCoverageVerifier.run({ state, evidence: [ev], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks.find((c) => c.name === "evidence_coverage_threshold")!.passed).toBe(true);
  });
  it("blocks the threshold check when coverage is below the minimum", () => {
    const state = makeState({
      claims: [
        { id: "c1", text: "price 10", evidencePointer: "e1" },
        { id: "c2", text: "discount", evidencePointer: null },
      ],
    });
    const checks = evidenceCoverageVerifier.run({ state, evidence: [ev], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    const threshold = checks.find((c) => c.name === "evidence_coverage_threshold")!;
    expect(threshold.passed).toBe(false);
    expect(threshold.severity).toBe("blocking");
  });
});
