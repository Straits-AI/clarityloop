import { describe, it, expect } from "vitest";
import {
  scoreEntropy,
  type AuthorityBoundary,
  type EvidenceRef,
  type LatentWorkflowState,
  type RiskSignals,
  type WorkflowSpec,
} from "@clarityloop/core";
import { InMemoryArtifactStore, InMemoryMemoryRepository } from "@clarityloop/storage";
import { createToolRegistry, seedMemoryRepository } from "@clarityloop/tools";
import type { ModelProvider } from "@clarityloop/qwen";
import { makeApprovalRequired } from "./approval-gate";
import { runToolLoop, makeBuildToolArgs, type LoopContext } from "./controller";

const fakeProvider: ModelProvider = { async complete() { return "{}"; } };

const workflowSpec: WorkflowSpec = {
  id: "wf_quote",
  name: "Customer Quote",
  goal: "Produce a customer quote",
  version: "v1",
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote for"] },
  steps: [
    {
      id: "s1",
      name: "lookup",
      purpose: "price",
      action: { type: "tool", toolName: "lookup_catalog", args: {} },
      expectedOutputs: ["price"],
      evidenceProduced: ["catalog"],
      entropyTarget: "evidenceEntropy",
    },
  ],
  allowedTools: [
    { toolName: "lookup_catalog", defaultArgs: null },
    { toolName: "retrieve_memory", defaultArgs: null },
    { toolName: "compare_quote", defaultArgs: null },
  ],
  evidencePolicy: { requiredForClaims: { price: "catalog_or_supplier_quote" }, minimumCoverageForCommit: 1 },
  commitPolicy: {
    autoCommitAllowed: true,
    requireApprovalIf: {
      quoteValueAbove: 10000,
      discountAbovePct: 20,
      evidenceCoverageBelow: 0.8,
      deliveryUnconfirmed: true,
      externalSend: true,
      policyException: true,
    },
    forbiddenActions: ["bypass_credit_check"],
    commitEntropyThreshold: 0.3,
  },
  memoryPolicy: {
    writeEnabled: true,
    allowedTypes: ["CustomerPreference"],
    minMemoryValueToWrite: 0.5,
    defaultTtlDays: 180,
    maxEntriesPerScope: 100,
    conflictResolution: "prefer_higher_confidence",
  },
  budgetPolicy: { maxLoopIterations: 12, maxTokens: 100000, maxToolCalls: 20, maxHumanAsks: 2, maxLatencyMs: 60000 },
};

const authority: AuthorityBoundary = {
  autoCommitMaxRiskClass: "L2",
  approvalRequiredFor: ["external_send", "high_value_quote"],
  forbiddenActions: ["bypass_credit_check"],
  allowedTools: [],
};

const ev: EvidenceRef = { id: "e1", kind: "catalog", sourceTool: "lookup_catalog", uri: null, snippet: "price 10", confidence: 0.9 };

// A clean, committable state: no missing required fields, every claim evidenced.
const cleanState: LatentWorkflowState = {
  goal: "quote",
  workflowVersion: "v1",
  knownFacts: [{ id: "f1", text: "customer ABC", confidence: 0.9 }],
  missingFields: [],
  claims: [{ id: "c1", text: "price 10", evidencePointer: "e1" }],
  riskFlags: [],
  policyFlags: [],
  staleMemoryRefs: [],
  toolFailures: [],
};

const noSignals: RiskSignals = {
  structuralChange: false,
  legalSensitive: false,
  policyException: false,
  quoteValue: null,
  discountPct: null,
  externalSend: false,
  producesArtifact: true,
  reversible: true,
};

describe("makeApprovalRequired (commit-gate-driven loop predicate)", () => {
  it("does NOT require approval for a clean, low-risk, fully-evidenced state", () => {
    const predicate = makeApprovalRequired({
      workflowSpec,
      authorityBoundary: authority,
      evidence: [ev],
      riskSignals: () => noSignals,
    });
    expect(predicate(cleanState, scoreEntropy(cleanState))).toBe(false);
  });

  it("requires approval when an authority-boundary category (external_send) is active within the ceiling", () => {
    const predicate = makeApprovalRequired({
      workflowSpec,
      authorityBoundary: authority,
      evidence: [ev],
      riskSignals: () => ({ ...noSignals, externalSend: true }), // L2, within the L2 ceiling
    });
    expect(predicate(cleanState, scoreEntropy(cleanState))).toBe(true);
  });

  it("wires into runToolLoop so the loop stops with approval_required", async () => {
    const memory = new InMemoryMemoryRepository();
    await seedMemoryRepository(memory);
    const tools = createToolRegistry({ memory, provider: fakeProvider, store: new InMemoryArtifactStore() });
    const context: LoopContext = {
      customer: "ABC",
      scope: "quote_workflows",
      sku: "CTN-COFFEE-1KG",
      quantity: 120,
      artifactKey: null,
      deliveryDate: "2026-06-22",
      catalog: [{ sku: "CTN-COFFEE-1KG", unitPrice: 42.5 }],
      supplierQuote: null,
    };
    // High residual entropy (so the loop does not stop on the commit-entropy threshold first) AND a
    // gate that routes to a human: unsupported claim + ambiguous policy + active external_send.
    const noisyState: LatentWorkflowState = {
      ...cleanState,
      claims: [{ id: "c1", text: "price 10", evidencePointer: null }],
      policyFlags: [{ id: "p1", rule: "discount_tier", ambiguous: true }],
      staleMemoryRefs: ["mem_old"],
    };
    const result = await runToolLoop(noisyState, {
      proposeActions: async () => [
        { id: "a", actionType: "lookup_catalog", verifierName: null, targetField: "c1", rationale: "confirm price" },
      ],
      tools,
      buildToolArgs: makeBuildToolArgs(context),
      commitPolicy: workflowSpec.commitPolicy,
      budget: workflowSpec.budgetPolicy,
      approvalRequired: makeApprovalRequired({
        workflowSpec,
        authorityBoundary: authority,
        evidence: [ev],
        riskSignals: () => ({ ...noSignals, externalSend: true }),
      }),
    });
    expect(result.stopReason).toBe("approval_required");
  });
});
