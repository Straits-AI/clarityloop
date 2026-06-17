import type { CommitPolicy } from "./workflow";
import type { RiskClass } from "./primitives";

/** Signals the orchestrator derives from the proposed action + draft artifact. */
export type RiskSignals = {
  structuralChange: boolean; // workflow promotion / new tool permission / memory-policy change
  legalSensitive: boolean;
  policyException: boolean;
  quoteValue: number | null;
  discountPct: number | null;
  externalSend: boolean;
  producesArtifact: boolean; // false => read-only / reversible, no persisted artifact
  reversible: boolean;
};

/**
 * Risk-tiered classification (memo §17): L0 reversible → L4 structural. Deterministic, pure.
 * First matching tier wins (highest risk first).
 */
export function classifyRiskClass(s: RiskSignals, commitPolicy: CommitPolicy): RiskClass {
  if (s.structuralChange) return "L4";

  const r = commitPolicy.requireApprovalIf;
  const highValue = r.quoteValueAbove !== null && s.quoteValue !== null && s.quoteValue > r.quoteValueAbove;
  const bigDiscount = r.discountAbovePct !== null && s.discountPct !== null && s.discountPct > r.discountAbovePct;

  if (s.legalSensitive || s.policyException || highValue || bigDiscount || !s.reversible) return "L3";
  if (s.externalSend) return "L2";
  if (s.producesArtifact) return "L1";
  return "L0";
}
