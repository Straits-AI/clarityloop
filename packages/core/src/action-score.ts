import type { ActionType, CandidateAction, ProposedAction } from "./actions";
import type { LatentWorkflowState } from "./types";

/** The six cost/value fields code attaches to a ProposedAction to make it a CandidateAction. */
export type ActionCostEstimate = {
  expectedEntropyReduction: number;
  expectedRiskReduction: number;
  tokenCost: number;
  latencyCost: number;
  humanBurdenCost: number;
  toolCost: number;
};

/** memo §15 action score. Deterministic, pure — the model never supplies these numbers. */
export function scoreAction(a: CandidateAction): number {
  return (
    a.expectedEntropyReduction +
    a.expectedRiskReduction -
    a.tokenCost -
    a.latencyCost -
    a.humanBurdenCost -
    a.toolCost
  );
}

/** Argmax over candidates. Returns the highest-scoring candidate, or null if none scores > 0. */
export function selectNextBestAction(candidates: CandidateAction[]): CandidateAction | null {
  let best: CandidateAction | null = null;
  let bestScore = 0; // a candidate must beat 0 to be worth running
  for (const c of candidates) {
    const s = scoreAction(c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

/** Static per-action cost table (token/latency/human/tool) + base risk-reduction weight. */
const ACTION_COSTS: Record<
  ActionType,
  { tokenCost: number; latencyCost: number; humanBurdenCost: number; toolCost: number; baseRisk: number }
> = {
  retrieve_memory: { tokenCost: 0.02, latencyCost: 0.02, humanBurdenCost: 0, toolCost: 0.02, baseRisk: 0.1 },
  lookup_catalog: { tokenCost: 0.01, latencyCost: 0.02, humanBurdenCost: 0, toolCost: 0.02, baseRisk: 0.1 },
  check_stock: { tokenCost: 0.01, latencyCost: 0.03, humanBurdenCost: 0, toolCost: 0.03, baseRisk: 0.1 },
  parse_supplier_quote: { tokenCost: 0.08, latencyCost: 0.06, humanBurdenCost: 0, toolCost: 0.05, baseRisk: 0.1 },
  compare_quote: { tokenCost: 0.03, latencyCost: 0.02, humanBurdenCost: 0, toolCost: 0.02, baseRisk: 0.15 },
  draft_quote: { tokenCost: 0.05, latencyCost: 0.03, humanBurdenCost: 0, toolCost: 0.03, baseRisk: 0 },
  run_verifier: { tokenCost: 0.01, latencyCost: 0.01, humanBurdenCost: 0, toolCost: 0.01, baseRisk: 0.05 },
  ask_customer: { tokenCost: 0.01, latencyCost: 0.5, humanBurdenCost: 0.6, toolCost: 0, baseRisk: 0 },
  ask_manager: { tokenCost: 0.01, latencyCost: 0.5, humanBurdenCost: 0.8, toolCost: 0, baseRisk: 0 },
  propose_workflow_patch: { tokenCost: 0.1, latencyCost: 0.05, humanBurdenCost: 0, toolCost: 0, baseRisk: 0 },
  commit: { tokenCost: 0, latencyCost: 0, humanBurdenCost: 0, toolCost: 0, baseRisk: 0 },
};

/**
 * Deterministic estimate of an action's value against the CURRENT latent state.
 * expectedEntropyReduction mirrors the §7 commit-entropy weights: resolving a required
 * missing field or an unsupported claim each carry a 0.25-weighted component; retrieve_memory
 * additionally clears the 0.10-weighted stale-memory component. Pure: depends only on the
 * structured state + the static table.
 */
export function estimateActionCosts(
  proposed: ProposedAction,
  state: LatentWorkflowState,
): ActionCostEstimate {
  const c = ACTION_COSTS[proposed.actionType];
  const target = proposed.targetField;
  const requiredMissing = state.missingFields.some((m) => m.id === target && m.necessity === "required");
  const optionalMissing = state.missingFields.some((m) => m.id === target && m.necessity === "optional");
  const unsupportedClaim = state.claims.some((cl) => cl.id === target && cl.evidencePointer === null);

  let expectedEntropyReduction = 0;
  if (requiredMissing) expectedEntropyReduction = 0.25;
  else if (unsupportedClaim) expectedEntropyReduction = 0.25 / Math.max(1, state.claims.length);
  else if (optionalMissing) expectedEntropyReduction = 0.05;

  if (proposed.actionType === "retrieve_memory" && state.staleMemoryRefs.length > 0) {
    expectedEntropyReduction += 0.1;
  }

  const expectedRiskReduction = expectedEntropyReduction > 0 ? c.baseRisk : 0;

  return {
    expectedEntropyReduction,
    expectedRiskReduction,
    tokenCost: c.tokenCost,
    latencyCost: c.latencyCost,
    humanBurdenCost: c.humanBurdenCost,
    toolCost: c.toolCost,
  };
}

/** Attach a cost estimate to a ProposedAction and compute its score → CandidateAction. */
export function toCandidateAction(proposed: ProposedAction, costs: ActionCostEstimate): CandidateAction {
  const withCosts: CandidateAction = { ...proposed, ...costs, score: 0 };
  return { ...withCosts, score: scoreAction(withCosts) };
}
