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
import type { ToolRegistry } from "@clarityloop/tools";

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
  /** Builds concrete tool args from the chosen action + current state/run context. */
  buildToolArgs: (action: CandidateAction, state: LatentWorkflowState) => Record<string, unknown>;
  commitPolicy: CommitPolicy;
  budget: BudgetPolicy;
  /** Authority-boundary predicate. Plan 5 supplies the real one (commit gate); default: never. */
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
    const parsedArgs = tool.inputs.parse(deps.buildToolArgs(best, state));
    const result = await tool.run(parsedArgs);
    tokens += result.costHint.tokens;
    latencyMs += result.costHint.latencyMs;
    toolCalls += 1;

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

/** Default arg-builder: map a chosen action + run context to the tool's input shape. */
export function makeBuildToolArgs(context: LoopContext) {
  return (action: CandidateAction, _state: LatentWorkflowState): Record<string, unknown> => {
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
        return { supplier: context.supplierQuote, catalog: context.catalog, maxDeltaPct: 0.1 };
      case "draft_quote":
        return {
          customer: context.customer,
          lineItems: (context.supplierQuote?.lineItems ?? []).map((li) => ({
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
