import { describe, it, expect } from "vitest";
import { classifyRiskClass, type RiskSignals } from "./risk";
import type { CommitPolicy } from "./workflow";

const policy: CommitPolicy = {
  autoCommitAllowed: true,
  requireApprovalIf: {
    quoteValueAbove: 10000,
    discountAbovePct: 20,
    evidenceCoverageBelow: 0.8,
    deliveryUnconfirmed: true,
    externalSend: true,
    policyException: true,
  },
  forbiddenActions: [],
  commitEntropyThreshold: 0.3,
};

const base: RiskSignals = {
  structuralChange: false,
  legalSensitive: false,
  policyException: false,
  quoteValue: null,
  discountPct: null,
  externalSend: false,
  producesArtifact: false,
  reversible: true,
};

describe("classifyRiskClass (memo §17)", () => {
  it("L0 — read-only / reversible with no artifact", () => {
    expect(classifyRiskClass(base, policy)).toBe("L0");
  });
  it("L1 — internal draft artifact", () => {
    expect(classifyRiskClass({ ...base, producesArtifact: true }, policy)).toBe("L1");
  });
  it("L2 — external-facing but reversible", () => {
    expect(classifyRiskClass({ ...base, producesArtifact: true, externalSend: true }, policy)).toBe("L2");
  });
  it("L3 — high-value quote above the threshold", () => {
    expect(classifyRiskClass({ ...base, producesArtifact: true, quoteValue: 50000 }, policy)).toBe("L3");
  });
  it("L3 — discount above the threshold", () => {
    expect(classifyRiskClass({ ...base, producesArtifact: true, discountPct: 35 }, policy)).toBe("L3");
  });
  it("L3 — irreversible action", () => {
    expect(classifyRiskClass({ ...base, reversible: false }, policy)).toBe("L3");
  });
  it("L4 — structural change (promotion / new tool permission / memory-policy change)", () => {
    expect(classifyRiskClass({ ...base, structuralChange: true }, policy)).toBe("L4");
  });
});
