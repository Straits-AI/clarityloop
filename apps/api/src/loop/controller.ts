import {
  scoreEntropy,
  estimateActionCosts,
  toCandidateAction,
  selectNextBestAction,
  type LatentWorkflowState,
  type EntropyScore,
  type EntropyUpdate,
  type ProposedAction,
  type CandidateAction,
  type CommitPolicy,
  type BudgetPolicy,
  type ToolName,
} from "@clarityloop/core";
import type { ToolRegistry, ToolResult, SupplierQuote } from "@clarityloop/tools";

/** Successful tool outputs accumulated across a run, so later steps can chain on earlier ones. */
export type PriorToolResults = Partial<Record<ToolName, ToolResult>>;

export type LoopStopReason =
  | "commit_entropy_below_threshold"
  | "no_useful_action"
  | "budget_exhausted"
  | "approval_required";

export type LoopStep = {
  index: number;
  action: CandidateAction;
  entropyBefore: EntropyScore;
  entropyAfter: EntropyScore;
};

export type LoopResult = {
  finalState: LatentWorkflowState;
  finalEntropy: EntropyScore;
  steps: LoopStep[];
  stopReason: LoopStopReason;
};

export type LoopDeps = {
  /** Qwen-backed in production (fake in tests). Returns STRUCTURE only — no scores. */
  proposeActions: (state: LatentWorkflowState) => Promise<ProposedAction[]>;
  tools: ToolRegistry;
  /**
   * Builds concrete tool args from the chosen action + current state + outputs of earlier
   * tools in this run (so e.g. compare_quote can consume a prior parse_supplier_quote result).
   */
  buildToolArgs: (
    action: CandidateAction,
    state: LatentWorkflowState,
    priorResults?: PriorToolResults,
  ) => Record<string, unknown>;
  commitPolicy: CommitPolicy;
  budget: BudgetPolicy;
  /**
   * Authority-boundary predicate. The production implementation is `makeApprovalRequired`
   * (./approval-gate.ts), which runs the deterministic commit gate; default: never.
   */
  approvalRequired?: (state: LatentWorkflowState, entropy: EntropyScore) => boolean;
};

const TOOL_NAMES: ToolName[] = [
  "retrieve_memory",
  "lookup_catalog",
  "check_stock",
  "parse_supplier_quote",
  "compare_quote",
  "draft_quote",
];
const isToolAction = (a: string): a is ToolName => (TOOL_NAMES as string[]).includes(a);

/** Deterministic reducer: fold a tool result into the latent state (the source of entropy reduction). */
export function applyToolResult(
  state: LatentWorkflowState,
  action: CandidateAction,
  result: { ok: boolean; evidence: { id: string }[] },
): LatentWorkflowState {
  if (!result.ok) {
    return {
      ...state,
      toolFailures: state.toolFailures.includes(action.actionType)
        ? state.toolFailures
        : [...state.toolFailures, action.actionType],
    };
  }
  const target = action.targetField;
  const evId = result.evidence[0]?.id ?? null;
  const missingFields = target ? state.missingFields.filter((m) => m.id !== target) : state.missingFields;
  const claims = target
    ? state.claims.map((c) =>
        c.id === target && c.evidencePointer === null && evId ? { ...c, evidencePointer: evId } : c,
      )
    : state.claims;
  const staleMemoryRefs = action.actionType === "retrieve_memory" ? [] : state.staleMemoryRefs;
  const toolFailures = state.toolFailures.filter((f) => f !== action.actionType);
  return { ...state, missingFields, claims, staleMemoryRefs, toolFailures };
}

/**
 * The next-best-action loop, as an async generator yielding the Plan 3 EntropyUpdate SSE frame.
 * Each iteration: propose → score → argmax → run tool → fold result → re-score → emit.
 * The generator's return value is the terminal LoopResult.
 */
export async function* runToolLoopStream(
  initialState: LatentWorkflowState,
  deps: LoopDeps,
): AsyncGenerator<EntropyUpdate, LoopResult> {
  let state = initialState;
  let entropy = scoreEntropy(state);
  const steps: LoopStep[] = [];
  const threshold = deps.commitPolicy.commitEntropyThreshold;

  let frame = 0;
  let tokens = 0;
  let toolCalls = 0;
  let latencyMs = 0;
  const priorResults: PriorToolResults = {};

  yield { step: frame++, phase: "scored", state, entropy, nextBestAction: null, note: "initial latent state scored" };

  for (let index = 0; ; index++) {
    if (entropy.commitEntropy < threshold) {
      yield { step: frame++, phase: "done", state, entropy, nextBestAction: null, note: "commit entropy below threshold" };
      return { finalState: state, finalEntropy: entropy, steps, stopReason: "commit_entropy_below_threshold" };
    }
    if (deps.approvalRequired?.(state, entropy)) {
      yield { step: frame++, phase: "done", state, entropy, nextBestAction: null, note: "authority boundary requires approval" };
      return { finalState: state, finalEntropy: entropy, steps, stopReason: "approval_required" };
    }
    if (
      index >= deps.budget.maxLoopIterations ||
      toolCalls >= deps.budget.maxToolCalls ||
      tokens >= deps.budget.maxTokens ||
      latencyMs >= deps.budget.maxLatencyMs
    ) {
      yield { step: frame++, phase: "done", state, entropy, nextBestAction: null, note: "budget exhausted" };
      return { finalState: state, finalEntropy: entropy, steps, stopReason: "budget_exhausted" };
    }

    const proposed = await deps.proposeActions(state);
    const candidates = proposed.map((p) => toCandidateAction(p, estimateActionCosts(p, state)));
    const best = selectNextBestAction(candidates);
    if (!best || !isToolAction(best.actionType)) {
      yield { step: frame++, phase: "done", state, entropy, nextBestAction: null, note: "no useful info-gathering action remains" };
      return { finalState: state, finalEntropy: entropy, steps, stopReason: "no_useful_action" };
    }

    const entropyBefore = entropy;
    yield { step: frame++, phase: "acted", state, entropy: entropyBefore, nextBestAction: best.actionType, note: best.rationale };

    const tool = deps.tools[best.actionType];
    // Arg construction (zod parse) and the tool call can throw on malformed/missing inputs
    // (e.g. compare_quote before a supplier quote exists). Fold any throw into a tool failure
    // so the loop stays alive and re-scores, instead of aborting the whole run.
    let result: ToolResult;
    try {
      const parsedArgs = tool.inputs.parse(deps.buildToolArgs(best, state, priorResults));
      result = (await tool.run(parsedArgs)) as ToolResult;
    } catch (err) {
      result = {
        ok: false,
        data: null,
        evidence: [],
        error: err instanceof Error ? err.message : String(err),
        costHint: { tokens: 0, latencyMs: 0, toolCost: 0 },
      };
    }
    tokens += result.costHint.tokens;
    latencyMs += result.costHint.latencyMs;
    toolCalls += 1;
    if (result.ok) priorResults[best.actionType] = result;

    state = applyToolResult(state, best, result);
    entropy = scoreEntropy(state);
    steps.push({ index, action: best, entropyBefore, entropyAfter: entropy });

    yield { step: frame++, phase: "scored", state, entropy, nextBestAction: null, note: `re-scored after ${best.actionType}` };
  }
}

/** Drain the stream to its terminal LoopResult (non-streaming callers + tests). */
export async function runToolLoop(initialState: LatentWorkflowState, deps: LoopDeps): Promise<LoopResult> {
  const gen = runToolLoopStream(initialState, deps);
  let res = await gen.next();
  while (!res.done) res = await gen.next();
  return res.value;
}

/** The run inputs the default arg-builder needs to turn an action into concrete tool args. */
export type LoopContext = {
  customer: string;
  scope: string;
  sku: string | null;
  quantity: number;
  artifactKey: string | null;
  deliveryDate: string;
  catalog: { sku: string; unitPrice: number }[];
  supplierQuote: {
    lineItems: { sku: string; description: string; quantity: number; unitPrice: number }[];
    total: number;
    currency: string;
  } | null;
};

/**
 * Default arg-builder: map a chosen action + run context to the tool's input shape, preferring
 * outputs of earlier tools in the same run over the seeded context (so parse_supplier_quote feeds
 * compare_quote / draft_quote, and lookup_catalog augments the catalog used for comparison).
 */
export function makeBuildToolArgs(context: LoopContext) {
  return (
    action: CandidateAction,
    _state: LatentWorkflowState,
    prior: PriorToolResults = {},
  ): Record<string, unknown> => {
    // A supplier quote parsed earlier this run takes precedence over the seeded context.
    const parsed = prior.parse_supplier_quote?.ok ? (prior.parse_supplier_quote.data as SupplierQuote | null) : null;
    const supplier = parsed ?? context.supplierQuote;
    // A catalog line looked up earlier this run is upserted into the seeded catalog.
    const looked = prior.lookup_catalog?.ok
      ? (prior.lookup_catalog.data as { sku: string; unitPrice: number } | null)
      : null;
    const catalog = looked
      ? [...context.catalog.filter((c) => c.sku !== looked.sku), { sku: looked.sku, unitPrice: looked.unitPrice }]
      : context.catalog;

    switch (action.actionType) {
      case "retrieve_memory":
        return { scope: context.scope, entity: context.customer, type: null };
      case "lookup_catalog":
        return { sku: context.sku, query: context.customer };
      case "check_stock":
        return { sku: context.sku ?? "", quantity: context.quantity };
      case "parse_supplier_quote":
        return { artifactKey: context.artifactKey ?? "" };
      case "compare_quote":
        return { supplier, catalog, maxDeltaPct: 0.1 };
      case "draft_quote":
        return {
          customer: context.customer,
          lineItems: (supplier?.lineItems ?? []).map((li) => ({
            sku: li.sku,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
          })),
          deliveryDate: context.deliveryDate,
        };
      default:
        return {};
    }
  };
}
