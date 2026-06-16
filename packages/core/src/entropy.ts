import type { LatentWorkflowState, EntropyScore } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const frac = (numer: number, denom: number) => (denom === 0 ? 0 : numer / denom);

/**
 * Deterministic operational-entropy scorer.
 * The model NEVER produces these numbers — they are computed purely from the
 * structured latent state. Weights follow spec §7 / memo §15.
 */
export function scoreEntropy(state: LatentWorkflowState): EntropyScore {
  const requiredMissing = state.missingFields.filter((m) => m.necessity === "required");
  const missingFieldScore = clamp01(requiredMissing.length === 0 ? 0 : 1);

  const unsupportedClaims = state.claims.filter((c) => c.evidencePointer === null);
  const unsupportedClaimScore = frac(unsupportedClaims.length, state.claims.length);

  // Contradiction: facts with the same text but differing confidence is a proxy;
  // for v1 we treat high-severity risk flags as contradiction signal.
  const contradictionScore = clamp01(
    frac(state.riskFlags.filter((r) => r.severity === "high").length, Math.max(1, state.riskFlags.length))
  );

  const policyAmbiguityScore = clamp01(
    frac(state.policyFlags.filter((p) => p.ambiguous).length, Math.max(1, state.policyFlags.length))
  );

  const staleMemoryScore = clamp01(state.staleMemoryRefs.length > 0 ? 1 : 0);
  const toolFailureScore = clamp01(state.toolFailures.length > 0 ? 1 : 0);

  const commitEntropy = clamp01(
    0.25 * missingFieldScore +
      0.25 * unsupportedClaimScore +
      0.2 * contradictionScore +
      0.15 * policyAmbiguityScore +
      0.1 * staleMemoryScore +
      0.05 * toolFailureScore
  );

  return {
    taskEntropy: missingFieldScore,
    evidenceEntropy: unsupportedClaimScore,
    actionEntropy: clamp01(missingFieldScore * 0.5 + unsupportedClaimScore * 0.5),
    policyEntropy: policyAmbiguityScore,
    memoryEntropy: staleMemoryScore,
    commitEntropy,
  };
}
