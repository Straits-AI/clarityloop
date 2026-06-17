import { describe, it, expect } from "vitest";
import {
  scoreAction,
  selectNextBestAction,
  estimateActionCosts,
  toCandidateAction,
} from "./action-score";
import type { CandidateAction, ProposedAction } from "./actions";
import type { LatentWorkflowState } from "./types";

const candidate = (over: Partial<CandidateAction>): CandidateAction => ({
  id: "x",
  actionType: "lookup_catalog",
  verifierName: null,
  targetField: null,
  rationale: "",
  expectedEntropyReduction: 0,
  expectedRiskReduction: 0,
  tokenCost: 0,
  latencyCost: 0,
  humanBurdenCost: 0,
  toolCost: 0,
  score: 0,
  ...over,
});

const state = (over: Partial<LatentWorkflowState>): LatentWorkflowState => ({
  goal: "g",
  workflowVersion: "v1",
  knownFacts: [],
  missingFields: [],
  claims: [],
  riskFlags: [],
  policyFlags: [],
  staleMemoryRefs: [],
  toolFailures: [],
  ...over,
});

describe("scoreAction", () => {
  it("is ER + RR minus every cost term (memo §15)", () => {
    const a = candidate({
      expectedEntropyReduction: 0.4,
      expectedRiskReduction: 0.2,
      tokenCost: 0.05,
      latencyCost: 0.03,
      humanBurdenCost: 0,
      toolCost: 0.02,
    });
    expect(scoreAction(a)).toBeCloseTo(0.4 + 0.2 - 0.05 - 0.03 - 0.02, 5);
  });
});

describe("selectNextBestAction", () => {
  it("returns the highest-scoring candidate (argmax)", () => {
    const low = candidate({ id: "low", expectedEntropyReduction: 0.1 });
    const high = candidate({ id: "high", expectedEntropyReduction: 0.5, toolCost: 0.05 });
    const mid = candidate({ id: "mid", expectedEntropyReduction: 0.3 });
    expect(selectNextBestAction([low, high, mid])?.id).toBe("high");
  });

  it("returns null when no candidate has a positive score", () => {
    const a = candidate({ id: "a", expectedEntropyReduction: 0.02, toolCost: 0.5 });
    const b = candidate({ id: "b", expectedEntropyReduction: 0, toolCost: 0.1 });
    expect(selectNextBestAction([a, b])).toBeNull();
  });

  it("returns null on an empty list", () => {
    expect(selectNextBestAction([])).toBeNull();
  });
});

describe("estimateActionCosts", () => {
  it("rewards targeting a required missing field and yields a positive candidate", () => {
    const proposed: ProposedAction = {
      id: "a",
      actionType: "lookup_catalog",
      verifierName: null,
      targetField: "current_price",
      rationale: "",
    };
    const s = state({ missingFields: [{ id: "current_price", name: "current_price", necessity: "required" }] });
    const costs = estimateActionCosts(proposed, s);
    expect(costs.expectedEntropyReduction).toBeCloseTo(0.25, 5);
    expect(toCandidateAction(proposed, costs).score).toBeGreaterThan(0);
  });

  it("gives zero reduction when the target is not a real gap (→ non-positive score)", () => {
    const proposed: ProposedAction = {
      id: "a",
      actionType: "lookup_catalog",
      verifierName: null,
      targetField: "nonexistent",
      rationale: "",
    };
    const costs = estimateActionCosts(proposed, state({}));
    expect(costs.expectedEntropyReduction).toBe(0);
    expect(toCandidateAction(proposed, costs).score).toBeLessThanOrEqual(0);
  });

  it("adds a stale-memory bonus for retrieve_memory", () => {
    const proposed: ProposedAction = {
      id: "a",
      actionType: "retrieve_memory",
      verifierName: null,
      targetField: "exact_sku",
      rationale: "",
    };
    const s = state({
      missingFields: [{ id: "exact_sku", name: "exact_sku", necessity: "required" }],
      staleMemoryRefs: ["m1"],
    });
    expect(estimateActionCosts(proposed, s).expectedEntropyReduction).toBeCloseTo(0.35, 5);
  });
});
