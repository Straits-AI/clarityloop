import {
  scoreEntropy,
  type Claim,
  type LatentWorkflowState,
  type EntropyUpdate,
} from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import { extractLatentState, type LatentExtractionInput } from "./extract";

/**
 * Minimal run-loop scaffold: extract latent state -> score -> emit.
 * Plan 4 extends the body (select next-best-action, run a tool, re-score, loop)
 * WITHOUT changing the EntropyUpdate SSE contract or the heatmap.
 */
export async function* runLatentLoop(
  provider: ModelProvider,
  input: LatentExtractionInput,
): AsyncGenerator<EntropyUpdate> {
  const state = await extractLatentState(provider, input);
  const entropy = scoreEntropy(state);
  yield {
    step: 0, phase: "scored", state, entropy,
    nextBestAction: null,
    note: "initial latent state extracted and scored",
  };
  // --- Plan 4 extension point: tool loop iterations emit further "acted"/"scored" frames here ---
  yield {
    step: 1, phase: "done", state, entropy,
    nextBestAction: null,
    note: "skeleton loop complete — tool loop arrives in Plan 4",
  };
}

const claim = (id: string, supported: boolean): Claim => ({
  id, text: `claim ${id}`, evidencePointer: supported ? `e-${id}` : null,
});

const baseFacts = [{ id: "f1", text: "customer is ABC", confidence: 0.9 }];

// State A — high uncertainty: missing SKU, 7/8 claims unsupported, high risk, ambiguous policy.
// scoreEntropy = 0.25(missing) + 0.25*0.875(unsup) + 0.20(contra) + 0.15(policy) = 0.81875
const stateA: LatentWorkflowState = {
  goal: "draft a customer quote", workflowVersion: "quote-v1",
  knownFacts: baseFacts,
  missingFields: [{ id: "m1", name: "exact_sku", necessity: "required" }],
  claims: [claim("c1", true), claim("c2", false), claim("c3", false), claim("c4", false),
           claim("c5", false), claim("c6", false), claim("c7", false), claim("c8", false)],
  riskFlags: [{ id: "r1", kind: "supplier_mismatch", severity: "high" }],
  policyFlags: [{ id: "p1", rule: "discount_threshold", ambiguous: true }],
  staleMemoryRefs: [], toolFailures: [],
};

// State B — mid: SKU resolved, 3/8 claims unsupported, risk + ambiguous policy remain.
// scoreEntropy = 0.25*0.375(unsup) + 0.20(contra) + 0.15(policy) = 0.44375
const stateB: LatentWorkflowState = {
  goal: "draft a customer quote", workflowVersion: "quote-v1",
  knownFacts: [...baseFacts, { id: "f2", text: "likely SKU CTN-120", confidence: 0.8 }],
  missingFields: [],
  claims: [claim("c1", true), claim("c2", true), claim("c3", true), claim("c4", true),
           claim("c5", true), claim("c6", false), claim("c7", false), claim("c8", false)],
  riskFlags: [{ id: "r1", kind: "supplier_mismatch", severity: "high" }],
  policyFlags: [{ id: "p1", rule: "discount_threshold", ambiguous: true }],
  staleMemoryRefs: [], toolFailures: [],
};

// State C — low: only 1/8 claims unsupported, no risk, ambiguous policy remains.
// scoreEntropy = 0.25*0.125(unsup) + 0.15(policy) = 0.18125
const stateC: LatentWorkflowState = {
  goal: "draft a customer quote", workflowVersion: "quote-v1",
  knownFacts: [...baseFacts, { id: "f2", text: "likely SKU CTN-120", confidence: 0.8 },
               { id: "f3", text: "current catalog price confirmed", confidence: 0.95 }],
  missingFields: [],
  claims: [claim("c1", true), claim("c2", true), claim("c3", true), claim("c4", true),
           claim("c5", true), claim("c6", true), claim("c7", true), claim("c8", false)],
  riskFlags: [],
  policyFlags: [{ id: "p1", rule: "discount_threshold", ambiguous: true }],
  staleMemoryRefs: [], toolFailures: [],
};

/**
 * Deterministic canonical demo (memo §10): commit entropy ≈0.82 → ≈0.44 → ≈0.18.
 * Every number is produced by scoreEntropy on a real LatentWorkflowState — no hardcoded scores.
 * Drives the hero heatmap animation now; Plan 4 replaces the source with the real tool loop.
 */
export function demoEntropySequence(): EntropyUpdate[] {
  return [
    { step: 0, phase: "scored", state: stateA, entropy: scoreEntropy(stateA),
      nextBestAction: "retrieve_memory",
      note: "High uncertainty: exact SKU, current price, delivery evidence, supplier mismatch." },
    { step: 1, phase: "scored", state: stateB, entropy: scoreEntropy(stateB),
      nextBestAction: "lookup_catalog",
      note: "Resolved likely SKU & customer preference; price and stock still open." },
    { step: 2, phase: "scored", state: stateC, entropy: scoreEntropy(stateC),
      nextBestAction: "commit",
      note: "Safe to draft internally; approval required before external send." },
    { step: 3, phase: "done", state: stateC, entropy: scoreEntropy(stateC),
      nextBestAction: null, note: "Loop complete." },
  ];
}
