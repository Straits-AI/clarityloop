import { describe, it, expect } from "vitest";
import {
  scoreEntropy,
  type LatentWorkflowState,
  type ProposedAction,
  type CommitPolicy,
  type BudgetPolicy,
  type EntropyUpdate,
} from "@clarityloop/core";
import { InMemoryArtifactStore, InMemoryMemoryRepository } from "@clarityloop/storage";
import { createToolRegistry, seedMemoryRepository } from "@clarityloop/tools";
import type { ModelProvider } from "@clarityloop/qwen";
import { runToolLoop, runToolLoopStream, applyToolResult, makeBuildToolArgs, type LoopContext } from "./controller";

const fakeProvider: ModelProvider = { async complete() { return "{}"; } };

const commitPolicy: CommitPolicy = {
  autoCommitAllowed: true,
  requireApprovalIf: {
    quoteValueAbove: null,
    discountAbovePct: null,
    evidenceCoverageBelow: null,
    deliveryUnconfirmed: null,
    externalSend: null,
    policyException: null,
  },
  forbiddenActions: [],
  commitEntropyThreshold: 0.3,
};

const generousBudget: BudgetPolicy = {
  maxLoopIterations: 10,
  maxTokens: 100000,
  maxToolCalls: 20,
  maxHumanAsks: 5,
  maxLatencyMs: 100000,
};

const initialState: LatentWorkflowState = {
  goal: "quote 120 cartons, same as last time, deliver next week",
  workflowVersion: "quote-v1",
  knownFacts: [{ id: "f1", text: "customer is Customer ABC", confidence: 0.9 }],
  missingFields: [
    { id: "exact_sku", name: "exact_sku", necessity: "required" },
    { id: "current_price", name: "current_price", necessity: "required" },
  ],
  claims: [{ id: "price_claim", text: "unit price 42.5 MYR", evidencePointer: null }],
  riskFlags: [],
  policyFlags: [],
  staleMemoryRefs: ["mem_old_order"],
  toolFailures: [],
};

const context: LoopContext = {
  customer: "Customer ABC",
  scope: "quote_workflows",
  sku: "CTN-COFFEE-1KG",
  quantity: 120,
  artifactKey: null,
  deliveryDate: "2026-06-22",
  catalog: [{ sku: "CTN-COFFEE-1KG", unitPrice: 42.5 }],
  supplierQuote: {
    lineItems: [{ sku: "CTN-COFFEE-1KG", description: "Coffee 1kg", quantity: 120, unitPrice: 41.0 }],
    total: 4920,
    currency: "MYR",
  },
};

const proposals: ProposedAction[] = [
  { id: "a1", actionType: "retrieve_memory", verifierName: null, targetField: "exact_sku", rationale: "resolve sku from prior order" },
  { id: "a2", actionType: "lookup_catalog", verifierName: null, targetField: "current_price", rationale: "confirm current price" },
  { id: "a3", actionType: "compare_quote", verifierName: null, targetField: "price_claim", rationale: "reconcile supplier vs catalog" },
];

async function setup() {
  const memory = new InMemoryMemoryRepository();
  await seedMemoryRepository(memory);
  const tools = createToolRegistry({ memory, provider: fakeProvider, store: new InMemoryArtifactStore() });
  return tools;
}

describe("runToolLoopStream (tool loop integration)", () => {
  it("streams strictly-decreasing commit entropy and stops below threshold (argmax loop)", async () => {
    const tools = await setup();
    const frames: EntropyUpdate[] = [];
    const gen = runToolLoopStream(initialState, {
      proposeActions: async () => proposals,
      tools,
      buildToolArgs: makeBuildToolArgs(context),
      commitPolicy,
      budget: generousBudget,
    });
    let res = await gen.next();
    while (!res.done) {
      frames.push(res.value);
      res = await gen.next();
    }
    const result = res.value;

    expect(result.stopReason).toBe("commit_entropy_below_threshold");
    expect(result.steps.length).toBeGreaterThanOrEqual(2);

    // the "scored" frames carry the monotonic descent the heatmap animates
    const scored = frames.filter((f) => f.phase === "scored").map((f) => f.entropy.commitEntropy);
    expect(scored.length).toBeGreaterThanOrEqual(3); // initial + one per iteration
    for (let i = 1; i < scored.length; i++) expect(scored[i]).toBeLessThan(scored[i - 1]);

    // every recorded step strictly reduced commit entropy
    for (const s of result.steps) expect(s.entropyAfter.commitEntropy).toBeLessThan(s.entropyBefore.commitEntropy);

    // final entropy below the initial AND below the threshold; loop ends in "done"
    expect(result.finalEntropy.commitEntropy).toBeLessThan(scoreEntropy(initialState).commitEntropy);
    expect(result.finalEntropy.commitEntropy).toBeLessThan(commitPolicy.commitEntropyThreshold);
    expect(frames.at(-1)?.phase).toBe("done");
  });
});

describe("runToolLoop (stop conditions)", () => {
  it("stops with no_useful_action when proposals target nothing real", async () => {
    const tools = await setup();
    const result = await runToolLoop(initialState, {
      proposeActions: async () => [
        { id: "z", actionType: "lookup_catalog", verifierName: null, targetField: "does_not_exist", rationale: "" },
      ],
      tools,
      buildToolArgs: makeBuildToolArgs(context),
      commitPolicy,
      budget: generousBudget,
    });
    expect(result.stopReason).toBe("no_useful_action");
    expect(result.steps).toHaveLength(0);
  });

  it("stops with budget_exhausted when the iteration cap is hit first", async () => {
    const tools = await setup();
    const result = await runToolLoop(initialState, {
      proposeActions: async () => proposals,
      tools,
      buildToolArgs: makeBuildToolArgs(context),
      commitPolicy,
      budget: { ...generousBudget, maxLoopIterations: 1 },
    });
    expect(result.stopReason).toBe("budget_exhausted");
    expect(result.steps).toHaveLength(1);
  });

  it("stops with approval_required when the authority-boundary predicate trips", async () => {
    const tools = await setup();
    const result = await runToolLoop(initialState, {
      proposeActions: async () => proposals,
      tools,
      buildToolArgs: makeBuildToolArgs(context),
      commitPolicy,
      budget: generousBudget,
      approvalRequired: (s) => s.staleMemoryRefs.length === 0, // trips once retrieve_memory clears stale memory
    });
    expect(result.stopReason).toBe("approval_required");
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
  });
});

describe("applyToolResult (state reducer)", () => {
  it("resolves a missing field and clears stale memory on a successful retrieve_memory", () => {
    const action = { ...proposals[0], expectedEntropyReduction: 0, expectedRiskReduction: 0, tokenCost: 0, latencyCost: 0, humanBurdenCost: 0, toolCost: 0, score: 1 };
    const next = applyToolResult(initialState, action, { ok: true, evidence: [{ id: "ev1" }] });
    expect(next.missingFields.some((m) => m.id === "exact_sku")).toBe(false);
    expect(next.staleMemoryRefs).toEqual([]);
  });

  it("records a tool failure on an unsuccessful result", () => {
    const action = { ...proposals[1], expectedEntropyReduction: 0, expectedRiskReduction: 0, tokenCost: 0, latencyCost: 0, humanBurdenCost: 0, toolCost: 0, score: 1 };
    const next = applyToolResult(initialState, action, { ok: false, evidence: [] });
    expect(next.toolFailures).toContain("lookup_catalog");
  });
});
