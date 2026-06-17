import type { Check, EvidenceRef, LatentWorkflowState } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";

/** Fraction of claims backed by a RESOLVABLE EvidenceRef. No claims => fully covered (1). */
export function computeEvidenceCoverage(state: LatentWorkflowState, evidence: EvidenceRef[]): number {
  if (state.claims.length === 0) return 1;
  const ids = new Set(evidence.map((e) => e.id));
  const supported = state.claims.filter((c) => c.evidencePointer !== null && ids.has(c.evidencePointer));
  return supported.length / state.claims.length;
}

export const evidenceCoverageVerifier: Verifier = {
  name: "evidence_coverage",
  run(input: VerifierInput): Check[] {
    const min = input.workflowSpec.evidencePolicy.minimumCoverageForCommit;
    const coverage = computeEvidenceCoverage(input.state, input.evidence);
    const checks: Check[] = [];

    // Per-claim findings are advisory (warn): the THRESHOLD is the gating, blocking signal.
    const unsupported = input.state.claims.filter(
      (c) => c.evidencePointer === null || !input.evidence.some((e) => e.id === c.evidencePointer),
    );
    for (const c of unsupported) {
      checks.push({
        name: `claim_unsupported:${c.id}`,
        verifier: "evidence_coverage",
        passed: false,
        severity: "warn",
        detail: `claim "${c.text}" has no resolvable evidence`,
      });
    }

    const meets = coverage >= min;
    checks.push({
      name: "evidence_coverage_threshold",
      verifier: "evidence_coverage",
      passed: meets,
      severity: meets ? "info" : "blocking",
      detail: `coverage ${coverage.toFixed(2)} ${meets ? ">=" : "<"} required ${min}`,
    });
    return checks;
  },
};
