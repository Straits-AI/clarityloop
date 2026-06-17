/** Inputs to the memo §16 memory-value score. */
export type MemoryValueInputs = {
  expectedFutureEntropyReduction: number;
  expectedReuseFrequency: number;
  evidenceConfidence: number;
  retrievalNoiseCost: number;
  stalenessRisk: number;
  storageCost: number;
};

/**
 * memory_value =
 *   expected_future_entropy_reduction * expected_reuse_frequency * evidence_confidence
 *   - retrieval_noise_cost - staleness_risk - storage_cost
 */
export function scoreMemoryValue(i: MemoryValueInputs): number {
  return (
    i.expectedFutureEntropyReduction * i.expectedReuseFrequency * i.evidenceConfidence -
    i.retrievalNoiseCost -
    i.stalenessRisk -
    i.storageCost
  );
}
