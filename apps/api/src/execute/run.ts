import { z } from "zod";
import {
  scoreEntropy,
  runCommitGate,
  classifyRiskClass,
  ToolNameSchema,
  WorkflowDomainSchema,
  type LatentWorkflowState,
  type WorkflowSpec,
  type RiskSignals,
  type AuthorityBoundary,
  type Check,
  type CommitDecision,
  type ProposedAction,
  type ToolName,
} from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import type { MemoryRepository, ArtifactStore } from "@clarityloop/storage";
import { createToolRegistry, SEED_CATALOG, type ToolRegistry } from "@clarityloop/tools";
import { designWorkflow } from "../workflow-designer";
import { extractLatentStateStream } from "../latent/extract";
import { authorityCategoryChecks } from "../authority-checks";
import {
  runToolLoopStream,
  makeBuildToolArgs,
  type LoopContext,
  type LoopResult,
} from "../loop/controller";

export const ExecuteInputSchema = z.object({
  request: z.string().min(1),
  domain: WorkflowDomainSchema.optional(),
  goal: z.string().default("draft a customer quote"),
  workflowVersion: z.string().default("quote-v1"),
  gate: z.enum(["on", "off"]),
});
export type ExecuteInput = z.infer<typeof ExecuteInputSchema>;

export type ExecuteRuntime = { memory: MemoryRepository; store: ArtifactStore };

const ALL_TOOLS: ToolName[] = ToolNameSchema.options;

/**
 * Authority boundary for the live demo: auto-commit up to L2 (an internal artifact / single
 * external send), with the high-stakes categories ALWAYS routed to a human. Matches the
 * commitPolicy the workflow designer assembles.
 */
const AUTHORITY: AuthorityBoundary = {
  autoCommitMaxRiskClass: "L2",
  approvalRequiredFor: ["external_send", "high_value_quote", "discount_above_threshold", "policy_exception"],
  forbiddenActions: [],
  allowedTools: [],
};

// ── streamed events ────────────────────────────────────────────────────────────
export type ExecStep = {
  type: "step";
  index: number;
  action: string | null;
  phase: string;
  note: string;
  residual: number;
};
export type DraftQuote = { artifactKey: string; total: number; doc: string | null };
export type ExecVerdict = {
  type: "verdict";
  gate: "on" | "off";
  committed: boolean;
  outcome: "committed" | "escalated";
  /** What the deterministic gate decided on the final state — surfaced in BOTH modes so the
   *  capability-only run can show "the gate WOULD have escalated — shipped anyway". */
  gateWouldHave: CommitDecision["type"];
  residual: number;
  riskFlags: LatentWorkflowState["riskFlags"];
  missingFields: LatentWorkflowState["missingFields"];
  draftQuote: DraftQuote | null;
  reason: string;
};
export type ExecToken = { type: "token"; token: string };
export type ExecEvent = ExecToken | ExecStep | ExecVerdict;

// ── honest, deterministic proposer ───────────────────────────────────────────────
// The model already did the hard part (extracting what's missing/risky). The proposer just
// maps each open gap to the business tool that could close it; selectNextBestAction (code)
// picks. A per-(tool,field) "tried" set keeps a failing tool from being re-proposed forever.
function toolForGap(text: string): ToolName {
  const t = text.toLowerCase();
  if (/supplier|price sheet|attached|invoice/.test(t)) return "parse_supplier_quote";
  if (/stock|availab|lead time|inventory/.test(t)) return "check_stock";
  if (/address|last order|prior|preference|memory|history/.test(t)) return "retrieve_memory";
  if (/compar|delta|margin/.test(t)) return "compare_quote";
  return "lookup_catalog"; // price / unit cost / catalog default
}
function makeProposer() {
  const tried = new Set<string>();
  return async (state: LatentWorkflowState): Promise<ProposedAction[]> => {
    const props: ProposedAction[] = [];
    const add = (actionType: ToolName, targetField: string | null, rationale: string) => {
      const key = `${actionType}:${targetField}`;
      if (tried.has(key)) return;
      tried.add(key);
      props.push({ id: `p_${props.length}_${actionType}`, actionType, verifierName: null, targetField, rationale });
    };
    for (const m of state.missingFields) add(toolForGap(m.name), m.id, `gather ${m.name}`);
    for (const cl of state.claims) if (cl.evidencePointer === null) add(toolForGap(cl.text), cl.id, `support ${cl.id}`);
    if (state.staleMemoryRefs.length > 0) add("retrieve_memory", null, "refresh stale memory");
    return props;
  };
}

// ── honest context + risk derivation ─────────────────────────────────────────────
function buildContext(state: LatentWorkflowState, request: string): LoopContext {
  const qtyMatch = request.match(/(\d{2,})\s*(carton|case|unit|box|item)/i);
  const quantity = qtyMatch ? Number(qtyMatch[1]) : 120;
  // Only treat a known fact as the customer name if it actually looks like one (short, no
  // sentence punctuation) — otherwise the drafted quote shows a chunk of the raw request.
  const customerFact = state.knownFacts.find(
    (f) => /customer|account|client/i.test(f.text) && f.text.length <= 36 && !/[.!?]/.test(f.text),
  );
  return {
    customer: customerFact?.text.trim() ?? "Customer ABC",
    scope: "quote_workflows",
    sku: SEED_CATALOG[0].sku,
    quantity: Number.isFinite(quantity) ? quantity : 120,
    artifactKey: null,
    deliveryDate: "2026-06-30",
    catalog: SEED_CATALOG.map((c) => ({ sku: c.sku, unitPrice: c.unitPrice })),
    supplierQuote: null,
  };
}

/** Derive the structured risk signals the gate classifies, honestly, from the request text. */
function deriveRiskSignals(request: string, quoteValue: number | null): RiskSignals {
  const r = request.toLowerCase();
  const discount = request.match(/(\d{1,3})\s*%/);
  // Word-boundary anchored so substrings don't false-trigger (e.g. "sta-nda-rd" must NOT read as NDA).
  const externalSend = /\bsend\b|\be-?mail\b|\bdispatch\b/.test(r);
  return {
    structuralChange: false,
    legalSensitive: /\blegal\b|\bcontract\b|\bnda\b|\bliabilit/.test(r),
    policyException: /\bskip\b.*(approval|review|verif)|\bbypass\b|\boverride\b|without approval|no approval/.test(r),
    quoteValue,
    discountPct: discount ? Number(discount[1]) : null,
    externalSend,
    producesArtifact: true,
    reversible: !(externalSend || /\bwire\b|\btransfer\b|\bpay\b/.test(r)),
  };
}

function coverageOf(state: LatentWorkflowState): number {
  if (state.claims.length === 0) return 1;
  return state.claims.filter((c) => c.evidencePointer !== null).length / state.claims.length;
}

/** Reconstruct the Check[] the verifiers would emit for this state (mirrors evals/replay.ts). */
function deriveChecks(state: LatentWorkflowState, spec: WorkflowSpec, coverage: number, signals: RiskSignals): Check[] {
  const checks: Check[] = [];
  if (coverage < spec.evidencePolicy.minimumCoverageForCommit) {
    checks.push({
      name: "evidence_coverage", verifier: "evidence_coverage", passed: false, severity: "blocking",
      detail: `coverage ${coverage.toFixed(2)} < minimum ${spec.evidencePolicy.minimumCoverageForCommit}`,
    });
  }
  for (const rf of state.riskFlags) {
    if (rf.severity === "high") {
      checks.push({ name: rf.kind, verifier: "policy", passed: false, severity: "warn", detail: `high-severity risk: ${rf.kind}` });
    }
  }
  return [...checks, ...authorityCategoryChecks(signals, spec.commitPolicy)];
}

function decisionReason(d: CommitDecision): string {
  switch (d.type) {
    case "commit": return "authority boundary clear · risk within ceiling · evidence sufficient";
    case "needs_approval": return d.reason;
    case "needs_more_info": return `missing required: ${d.missingFields.join("; ")}`;
    case "sandbox_only": return d.reason;
    case "reject": return `hard reject: ${d.failedChecks.map((c) => c.name).join(", ")}`;
  }
}

// ── the run: gather (real tool loop) → decide (authoritative gate) → draft ─────────
/**
 * Runs the REAL next-best-action tool loop over the extracted state (streaming each tool firing),
 * then applies the AUTHORITATIVE deterministic commit gate. The ONLY difference between the two
 * modes is what we do with the gate's verdict:
 *   - gate "on"  (ClarityLoop):     commit ONLY if the gate returns `commit`; else escalate.
 *   - gate "off" (capability-only): ignore the gate and ship the drafted quote regardless.
 * Same model, same tools, same draft — the gate is the only thing that changes. No faking.
 */
export async function* runExecutionFromState(
  provider: ModelProvider,
  state: LatentWorkflowState,
  spec: WorkflowSpec,
  input: { gate: "on" | "off"; request: string },
  runtime: ExecuteRuntime,
): AsyncGenerator<ExecStep, ExecVerdict> {
  const context = buildContext(state, input.request);
  const tools: ToolRegistry = createToolRegistry({ memory: runtime.memory, provider, store: runtime.store });

  // gather: drive the real loop, forwarding each tool-firing frame to the caller.
  const gen = runToolLoopStream(state, {
    proposeActions: makeProposer(),
    tools,
    buildToolArgs: makeBuildToolArgs(context),
    commitPolicy: spec.commitPolicy,
    budget: spec.budgetPolicy,
    // No approvalRequired here — the loop GATHERS; the gate is applied authoritatively below
    // (same pattern as evals/replay.ts decideOutcome). The mode decides what we do with it.
  });
  let res = await gen.next();
  while (!res.done) {
    const u = res.value;
    yield { type: "step", index: u.step, action: u.nextBestAction, phase: u.phase, note: u.note ?? "", residual: u.entropy.commitEntropy };
    res = await gen.next();
  }
  const loop: LoopResult = res.value;
  const finalState = loop.finalState;

  // draft the quote the agent would commit (requested product × catalog price — a real artifact).
  const lineItems = [{ sku: context.sku ?? SEED_CATALOG[0].sku, quantity: context.quantity, unitPrice: SEED_CATALOG[0].unitPrice }];
  let draftQuote: DraftQuote | null = null;
  try {
    const dr = await tools.draft_quote.run({ customer: context.customer, lineItems, deliveryDate: context.deliveryDate });
    if (dr.ok && dr.data) draftQuote = { artifactKey: dr.data.artifactKey, total: dr.data.total, doc: await runtime.store.get(dr.data.artifactKey) };
  } catch {
    draftQuote = null;
  }

  // decide: the authoritative deterministic commit gate on the final state.
  const signals = deriveRiskSignals(input.request, draftQuote?.total ?? null);
  const coverage = coverageOf(finalState);
  const decision = runCommitGate({
    state: finalState,
    entropy: scoreEntropy(finalState),
    checks: deriveChecks(finalState, spec, coverage, signals),
    evidenceCoverage: coverage,
    commitPolicy: spec.commitPolicy,
    authorityBoundary: AUTHORITY,
    riskClass: classifyRiskClass(signals, spec.commitPolicy),
  });

  const residual = scoreEntropy(finalState).commitEntropy;
  const committed = input.gate === "off" ? true : decision.type === "commit";
  return {
    type: "verdict",
    gate: input.gate,
    committed,
    outcome: committed ? "committed" : "escalated",
    gateWouldHave: decision.type,
    residual,
    riskFlags: finalState.riskFlags,
    missingFields: finalState.missingFields,
    draftQuote: committed ? draftQuote : null,
    reason:
      committed && input.gate === "off" && decision.type !== "commit"
        ? `shipped WITHOUT release control — the gate would have ${decision.type === "needs_more_info" ? "asked for more info" : "escalated"}: ${decisionReason(decision)}`
        : decisionReason(decision),
  };
}

/** Full streamed run: design the workflow + stream the real Qwen extraction, then gather→decide. */
export async function* executeRunStream(
  provider: ModelProvider,
  input: ExecuteInput,
  runtime: ExecuteRuntime,
): AsyncGenerator<ExecEvent, void> {
  const spec = await designWorkflow(provider, { request: input.request, domain: input.domain, allowedTools: ALL_TOOLS });
  let state: LatentWorkflowState | null = null;
  for await (const ev of extractLatentStateStream(provider, {
    request: input.request,
    goal: input.goal,
    workflowVersion: input.workflowVersion,
  })) {
    if (ev.type === "token") yield { type: "token", token: ev.token };
    else state = ev.state;
  }
  if (!state) throw new Error("extraction produced no state");
  const verdict = yield* runExecutionFromState(provider, state, spec, { gate: input.gate, request: input.request }, runtime);
  yield verdict;
}
