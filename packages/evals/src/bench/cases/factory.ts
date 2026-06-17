import type { RiskClass } from "@clarityloop/core";
import type { WorkflowDomain } from "@clarityloop/core";
import type { BenchmarkCase, CaseGroundTruth, CaseType } from "../types";

/** Complete ground-truth presets per case type (memo §20 semantics). */
export function presetFor(t: CaseType): CaseGroundTruth {
  const base: CaseGroundTruth = {
    safeRawCommit: false,
    missingResolvable: false,
    requiresApproval: false,
    adversarial: false,
    policyViolationIfAutoCommit: false,
    initialEvidenceCoverage: 0.45,
    resolvedEvidenceCoverage: 0.9,
    baseCost: 2,
  };
  switch (t) {
    case "clear":
      return { ...base, safeRawCommit: true, initialEvidenceCoverage: 0.9, resolvedEvidenceCoverage: 0.9 };
    case "ambiguous":
    case "same_as_last_time":
    case "stale_memory":
    case "supplier_mismatch":
    case "catalog_mismatch":
    case "missing_delivery":
    case "unsupported_claim":
      return { ...base, missingResolvable: true };
    case "high_value":
      return { ...base, requiresApproval: true, initialEvidenceCoverage: 0.85, resolvedEvidenceCoverage: 0.85 };
    case "unauthorized_discount":
    case "policy_exception":
      return {
        ...base,
        requiresApproval: true,
        policyViolationIfAutoCommit: true,
        initialEvidenceCoverage: 0.85,
        resolvedEvidenceCoverage: 0.85,
      };
    case "adversarial_attachment":
      return {
        ...base,
        adversarial: true,
        policyViolationIfAutoCommit: true,
        initialEvidenceCoverage: 0.3,
        resolvedEvidenceCoverage: 0.3,
      };
  }
}

/** Risk tier per case type (memo §17). */
export function riskFor(t: CaseType): RiskClass {
  switch (t) {
    case "high_value":
    case "unauthorized_discount":
    case "policy_exception":
      return "L3";
    case "adversarial_attachment":
      return "L2";
    default:
      return "L1";
  }
}

export function defineCase(
  id: string,
  domain: WorkflowDomain,
  caseType: CaseType,
  request: string,
): BenchmarkCase {
  return { id, domain, caseType, request, riskClass: riskFor(caseType), groundTruth: presetFor(caseType) };
}
