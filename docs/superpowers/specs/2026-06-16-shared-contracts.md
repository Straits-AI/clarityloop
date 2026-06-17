# ClarityLoop — Shared Contracts

**Date:** 2026-06-16
**Status:** Authoritative (canonical cross-plan contract)
**Depends on:** `/memo.md` (§14–§20), `/docs/superpowers/specs/2026-06-16-clarityloop-design.md`,
`/docs/superpowers/plans/2026-06-16-foundation-and-alibaba-deployment.md` (Plan 1, built).

---

## 0. Purpose & precedence

This document is the **single source of truth for every type, interface, and function
signature that crosses a plan boundary.** Plans 2–7 MUST copy these signatures verbatim. If a
later plan needs a shape not defined here, it adds it here first.

Precedence when sources disagree: **this document > design spec > memo**. The memo's type
sketches (§14, §16, §18, §19) are *sketches*; several are mutually inconsistent or were
superseded by the as-built `@clarityloop/core`. Section 14 of this doc logs every
reconciliation. Where this doc and the as-built Plan 1 code differ, the as-built code wins and
this doc documents it.

Conventions used throughout:

- **zod-first.** Anything that (a) is produced by Qwen, (b) is persisted as JSON, or (c) is
  transported over SSE/REST gets a zod schema named `XSchema`, with the TS type derived via
  `export type X = z.infer<typeof XSchema>`. This matches the established `@clarityloop/core`
  pattern. Pure compute-internal helpers (functions) are given plain TS signatures.
- **Deterministic-over-structured-Qwen.** Qwen emits *structure only* (facts, missing fields,
  claims, proposed actions, proposed patches, proposed memories). Deterministic TypeScript
  computes every score, cost, entropy, commit decision, and promotion decision. **The model
  never emits a number that gates anything.**
- **Optionality.** A persisted field that may be empty is modelled as `z.…().nullable()` (the
  key is always present, value may be `null`) rather than `.optional()`, so SQL columns and SSE
  payloads have a stable shape. (`@clarityloop/core`'s `Claim.evidencePointer` already follows
  this.)
- **IDs & timestamps** are `z.string()` (timestamps are ISO-8601 strings).

---

## 1. Package & plan ownership (summary)

Detailed matrix in §15. Quick map of where each contract lives and which plan introduces it:

| Concern | Package | Plan |
|---|---|---|
| Pure types, zod schemas, all deterministic scorers/gates | `packages/core` | 1–6 |
| The six tools + `Tool` interface | `packages/tools` | 4 |
| The six verifiers + `Verifier` interface | `packages/verifiers` | 5 |
| Operational-memory value scoring + write gate | `packages/memory` | 4 (read) / 6 (write) |
| Benchmark cases, baseline runners, metrics | `packages/evals` | 7 |
| `ArtifactStore` + repository interfaces & impls (in-memory + `pg`) | `packages/storage` | 1 (artifact) / 2 (repos) |
| Loop controller, run service, SSE — *composition only* | `apps/api` | 3–6 |

> **Repository placement note.** The orchestration brief lists "api for orchestration/
> repository". This doc places the repository **interfaces and implementations** in
> `packages/storage` (next to `ArtifactStore`, per design spec §4: *"storage/ … repository-pattern
> DB layer"*), and places the **orchestration that composes repositories** (loop controller, run
> service) in `apps/api`. That is the reconciliation: contracts/impls in `storage`, wiring in `api`.

---

## 2. Already built in Plan 1 (do not redefine — import)

These are live in `@clarityloop/core`, `@clarityloop/qwen`, `@clarityloop/storage`. Everything
below builds on them.

```ts
// @clarityloop/core
export const FactSchema, MissingFieldSchema, ClaimSchema, RiskFlagSchema, PolicyFlagSchema,
  LatentWorkflowStateSchema;
export type Fact, MissingField, Claim, RiskFlag, PolicyFlag, LatentWorkflowState;
export type EntropyScore;                 // plain type (this doc adds a matching EntropyScoreSchema, §8)
export function scoreEntropy(state: LatentWorkflowState): EntropyScore;   // deterministic

// @clarityloop/qwen
export type QwenTask, ChatMessage;
export interface ModelProvider { complete(messages: ChatMessage[], opts: { task: QwenTask }): Promise<string>; }
export function modelForTask(task: QwenTask): string;
export class DashScopeProvider;
export function generateStructured<T>(provider, schema: z.ZodType<T>, args: { task; messages }): Promise<T>;

// @clarityloop/storage
export interface ArtifactStore { put(key: string, body: string): Promise<void>; get(key: string): Promise<string | null>; }
export class InMemoryArtifactStore, OssArtifactStore;
```

Reminder of the as-built `LatentWorkflowState` shape (flat, entropy computed externally):
`{ goal, workflowVersion, knownFacts[], missingFields[], claims[], riskFlags[], policyFlags[],
staleMemoryRefs[], toolFailures[] }`. **The memo §8 `LatentWorkflowState` sketch (with nested
`entropy`, `competingHypotheses`, `evidenceMap`, `riskState`, …) is superseded** — see §14 R1.

---

## 3. Primitives shared by everything

`packages/core/src/schemas.ts` (extends the existing file). Plan 2.

```ts
import { z } from "zod";

/** A concrete piece of support a Tool produced. Claim.evidencePointer holds an EvidenceRef.id. */
export const EvidenceRefSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "catalog", "supplier_quote", "stock", "prior_order",
    "approved_memory", "pricing_policy", "logistics", "user_provided",
  ]),
  sourceTool: z.string().nullable(),   // ToolName that produced it, or null if user-provided
  uri: z.string().nullable(),          // OSS key / external pointer, or null
  snippet: z.string().nullable(),      // short human-readable support text
  confidence: z.number().min(0).max(1),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const WorkflowDomainSchema = z.enum([
  "quote", "supplier_comparison", "invoice_exception", "hr_policy", "customer_support",
]);
export type WorkflowDomain = z.infer<typeof WorkflowDomainSchema>;
// MVP (design spec §9) ships only "quote" + "supplier_comparison". The rest are reserved.

export const ToolNameSchema = z.enum([
  "retrieve_memory", "lookup_catalog", "check_stock",
  "parse_supplier_quote", "compare_quote", "draft_quote",
]);
export type ToolName = z.infer<typeof ToolNameSchema>;

export const VerifierNameSchema = z.enum([
  "schema", "numeric_reconciliation", "evidence_coverage",
  "policy", "hallucinated_tool", "missing_info",
]);
export type VerifierName = z.infer<typeof VerifierNameSchema>;

/** Risk tiers, memo §17. Ordered L0 (reversible) → L4 (promotion / permission change). */
export const RiskClassSchema = z.enum(["L0", "L1", "L2", "L3", "L4"]);
export type RiskClass = z.infer<typeof RiskClassSchema>;
// L0 read-only/reversible · L1 internal draft · L2 external reversible · L3 financial/legal/
// irreversible/policy-exception · L4 workflow promotion / new tool permission / memory-policy change.
```

---

## 4. Workflow definition

`packages/core`. Plan 2 (Qwen generates a `WorkflowSpec`; zod validates it; unauthorized tools
rejected against the procedure's `AuthorityBoundary`).

```ts
export const ToolPermissionLevelSchema = z.enum(["read_only", "draft", "external", "mutating"]);
export type ToolPermissionLevel = z.infer<typeof ToolPermissionLevelSchema>;
// read_only/draft  → autonomy zones low/medium (memo §7)
// external/mutating → authority boundary, high governance

/** A tool the workflow DECLARES it may call (the as-generated proposal). */
export const ToolRefSchema = z.object({
  toolName: ToolNameSchema,
  defaultArgs: z.record(z.unknown()).nullable(),  // optional bound args; runtime sets concrete args
});
export type ToolRef = z.infer<typeof ToolRefSchema>;

/** A GOVERNED grant of authority for a tool (what the org actually permits). */
export const ToolPermissionSchema = z.object({
  toolName: ToolNameSchema,
  level: ToolPermissionLevelSchema,
  maxRiskClass: RiskClassSchema,           // hard ceiling without re-approval
  constraints: z.record(z.unknown()).nullable(),
});
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;

export const WorkflowStepActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("model"),    promptTemplate: z.string() }),
  z.object({ type: z.literal("tool"),     toolName: ToolNameSchema, args: z.record(z.unknown()).default({}) }),
  z.object({ type: z.literal("verifier"), verifierName: VerifierNameSchema }),
  z.object({ type: z.literal("approval"), approvalType: z.string() }),
]);
export type WorkflowStepAction = z.infer<typeof WorkflowStepActionSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  action: WorkflowStepActionSchema,
  expectedOutputs: z.array(z.string()),
  evidenceProduced: z.array(z.string()).nullable(),
  // keyof EntropyScore — the entropy component this step is meant to reduce
  entropyTarget: z.enum([
    "taskEntropy", "evidenceEntropy", "actionEntropy",
    "policyEntropy", "memoryEntropy", "commitEntropy",
  ]).nullable(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const ClaimCategorySchema = z.enum([
  "price", "discount", "delivery", "customerPreference", "supplierComparison",
]);
export const EvidenceRequirementSchema = z.enum([
  "catalog_or_supplier_quote", "pricing_policy", "stock_or_logistics_source",
  "approved_memory_or_prior_order", "uploaded_supplier_quote",
]);
export const EvidencePolicySchema = z.object({
  // memo §14 used a fixed-key object; generalised to a typed record (see §14 R4)
  requiredForClaims: z.record(ClaimCategorySchema, EvidenceRequirementSchema),
  minimumCoverageForCommit: z.number().min(0).max(1),
});
export type EvidencePolicy = z.infer<typeof EvidencePolicySchema>;

export const CommitPolicySchema = z.object({
  autoCommitAllowed: z.boolean(),
  requireApprovalIf: z.object({
    quoteValueAbove: z.number().nullable(),
    discountAbovePct: z.number().nullable(),
    evidenceCoverageBelow: z.number().nullable(),
    deliveryUnconfirmed: z.boolean().nullable(),
    externalSend: z.boolean().nullable(),
    policyException: z.boolean().nullable(),
  }),
  forbiddenActions: z.array(z.string()),
  commitEntropyThreshold: z.number().min(0).max(1).default(0.3),  // ADDED — the stop threshold (§14 R8)
});
export type CommitPolicy = z.infer<typeof CommitPolicySchema>;

export const MemoryPolicySchema = z.object({
  writeEnabled: z.boolean(),
  allowedTypes: z.array(OperationalMemoryTypeSchema),   // defined in §11
  minMemoryValueToWrite: z.number(),                    // threshold on scoreMemoryValue()
  defaultTtlDays: z.number().int().positive(),
  maxEntriesPerScope: z.number().int().positive(),
  conflictResolution: z.enum(["prefer_higher_confidence", "prefer_newer", "reject_on_conflict"]),
});
export type MemoryPolicy = z.infer<typeof MemoryPolicySchema>;

export const BudgetPolicySchema = z.object({   // sketched but never typed in memo §14 (§14 R9)
  maxLoopIterations: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  maxHumanAsks: z.number().int().nonnegative(),
  maxLatencyMs: z.number().int().positive(),
});
export type BudgetPolicy = z.infer<typeof BudgetPolicySchema>;

export const WorkflowSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string(),
  version: z.string(),
  trigger: z.object({
    domain: WorkflowDomainSchema,
    naturalLanguagePatterns: z.array(z.string()),
  }),
  steps: z.array(WorkflowStepSchema),
  allowedTools: z.array(ToolRefSchema),      // DECLARED tools (vs governed ToolPermission[] on the version)
  evidencePolicy: EvidencePolicySchema,
  commitPolicy: CommitPolicySchema,
  memoryPolicy: MemoryPolicySchema,
  budgetPolicy: BudgetPolicySchema,
});
export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;
```

### WorkflowPatch (Plan 6 addition — `packages/core`)

```ts
/** One structural edit to a WorkflowSpec. Qwen proposes these; code applies them. */
export const WorkflowPatchOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("insert_step"), afterStepId: z.string().nullable(), step: WorkflowStepSchema }),
  z.object({ op: z.literal("remove_step"), stepId: z.string() }),
  z.object({ op: z.literal("replace_step"), stepId: z.string(), step: WorkflowStepSchema }),
  z.object({ op: z.literal("set_commit_threshold"), commitEntropyThreshold: z.number().min(0).max(1) }),
]);
export type WorkflowPatchOp = z.infer<typeof WorkflowPatchOpSchema>;

export const WorkflowPatchSchema = z.object({
  id: z.string(),
  rationale: z.string(),
  triggerCondition: z.string(),
  sourceTraceId: z.string().nullable(),
  ops: z.array(WorkflowPatchOpSchema).min(1),
  expectedEntropyReduction: z.number(),
});
export type WorkflowPatch = z.infer<typeof WorkflowPatchSchema>;

/**
 * Deterministically apply a WorkflowPatch to a WorkflowSpec (immutable).
 * Bumps the version string ("v1" → "v2"). Throws on missing stepId.
 */
export function applyPatch(spec: WorkflowSpec, patch: WorkflowPatch): WorkflowSpec;
```

---

## 5. Governance — authority boundary

`packages/core`. Plan 2 (type/data), enforced by the commit gate in Plan 5.

```ts
export const AuthorityBoundarySchema = z.object({
  // highest RiskClass the loop may COMMIT autonomously (no human). Default "L1".
  autoCommitMaxRiskClass: RiskClassSchema,
  // actions that ALWAYS require explicit human approval, regardless of entropy (memo §17)
  approvalRequiredFor: z.array(z.enum([
    "external_send", "high_value_quote", "discount_above_threshold", "legal_sensitive",
    "workflow_promotion", "new_tool_permission", "policy_exception", "memory_policy_change",
  ])),
  forbiddenActions: z.array(z.string()),       // never permitted
  allowedTools: z.array(ToolPermissionSchema), // governed tool grants
});
export type AuthorityBoundary = z.infer<typeof AuthorityBoundarySchema>;
```

---

## 6. Loop — next-best-action

`packages/core`. Plan 4 (next-best-action controller). Qwen *proposes* actions; code *scores*.

```ts
export const ActionTypeSchema = z.enum([
  // the six concrete tools (replaces memo's generic parse_document / draft_artifact — §14 R5)
  "retrieve_memory", "lookup_catalog", "check_stock",
  "parse_supplier_quote", "compare_quote", "draft_quote",
  // meta-actions the loop controller can also choose
  "run_verifier", "ask_customer", "ask_manager", "propose_workflow_patch", "commit",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

/** What Qwen returns when asked for next-best-action candidates (structure only, NO scores). */
export const ProposedActionSchema = z.object({
  id: z.string(),
  actionType: ActionTypeSchema,
  verifierName: VerifierNameSchema.nullable(),  // set iff actionType === "run_verifier"
  targetField: z.string().nullable(),           // the missingField/claim id this addresses
  rationale: z.string(),
});
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

/** A scored candidate. The cost/score fields are CODE-computed, never model-emitted. */
export const CandidateActionSchema = ProposedActionSchema.extend({
  expectedEntropyReduction: z.number(),
  expectedRiskReduction: z.number(),
  tokenCost: z.number(),
  latencyCost: z.number(),
  humanBurdenCost: z.number(),
  toolCost: z.number(),
  score: z.number(),
});
export type CandidateAction = z.infer<typeof CandidateActionSchema>;

/** memo §15 action score. Deterministic, pure. */
export function scoreAction(a: CandidateAction): number;
//   = a.expectedEntropyReduction + a.expectedRiskReduction
//     − a.tokenCost − a.latencyCost − a.humanBurdenCost − a.toolCost

/** Returns the highest-scoring candidate, or null if none has positive score (→ stop / commit-check). */
export function selectNextBestAction(candidates: CandidateAction[]): CandidateAction | null;
```

Loop stop condition (design spec §5 / memo §15) is evaluated by the controller in `apps/api`:
`commitEntropy < commitPolicy.commitEntropyThreshold` OR `selectNextBestAction() === null` OR
budget exhausted (`BudgetPolicy`) OR human approval required OR must ask for missing info.

---

## 7. Gates, checks, approvals, outcomes

`packages/core`. **Types** introduced Plan 2 (so runs/traces persist); **gate logic** Plan 5.

```ts
/** One verifier finding. A Verifier (§12) returns Check[]. */
export const CheckSchema = z.object({
  name: z.string(),
  verifier: VerifierNameSchema,
  passed: z.boolean(),
  severity: z.enum(["info", "warn", "blocking"]),
  detail: z.string(),
});
export type Check = z.infer<typeof CheckSchema>;

/** What is shown to a human approver. */
export const ApprovalPayloadSchema = z.object({
  runId: z.string(),
  riskClass: RiskClassSchema,
  reason: z.string(),
  summary: z.string(),                 // Qwen-generated audit narrative
  evidence: z.array(EvidenceRefSchema),
  proposedArtifactId: z.string().nullable(),
  failedChecks: z.array(CheckSchema),
});
export type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;

/** The resolved approval. */
export const ApprovalRecordSchema = z.object({
  id: z.string(),
  payload: ApprovalPayloadSchema,
  decision: z.enum(["approved", "rejected"]),
  approver: z.string(),
  decidedAt: z.string(),
  note: z.string().nullable(),
});
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

/** Output of the commit gate (memo §18, verb-form tags). */
export const CommitDecisionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("commit"),         reason: z.string() }),
  z.object({ type: z.literal("needs_approval"), reason: z.string(), approvalPayload: ApprovalPayloadSchema }),
  z.object({ type: z.literal("needs_more_info"), missingFields: z.array(z.string()) }),
  z.object({ type: z.literal("reject"),         failedChecks: z.array(CheckSchema) }),
  z.object({ type: z.literal("sandbox_only"),   reason: z.string() }),
]);
export type CommitDecision = z.infer<typeof CommitDecisionSchema>;

/** Terminal record of a run (memo §9, past-tense tags + run IDs). See §14 R6 for the mapping. */
export const RunOutcomeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("committed"),      runId: z.string(), traceId: z.string(), artifactId: z.string() }),
  z.object({ type: z.literal("needs_approval"), runId: z.string(), traceId: z.string(), approvalPayload: ApprovalPayloadSchema }),
  z.object({ type: z.literal("needs_more_info"), runId: z.string(), traceId: z.string(), missingFields: z.array(z.string()) }),
  z.object({ type: z.literal("rejected"),       runId: z.string(), traceId: z.string(), failedChecks: z.array(CheckSchema) }),
  z.object({ type: z.literal("sandbox_only"),   runId: z.string(), traceId: z.string() }),
]);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;
```

**CommitDecision → RunOutcome mapping** (orchestrator attaches `runId`/`traceId`, renames):
`commit → committed` (+ `artifactId`), `reject → rejected`, others keep their tag.

Commit gate contract — deterministic, pure, `packages/core`, Plan 5. Invariant (memo §18):
*the model may propose a commit; code decides whether it is allowed.*

```ts
export type CommitGateInput = {
  state: LatentWorkflowState;
  entropy: EntropyScore;
  checks: Check[];
  evidenceCoverage: number;        // 0..1, from evidence_coverage verifier
  commitPolicy: CommitPolicy;
  authorityBoundary: AuthorityBoundary;
  riskClass: RiskClass;
};
export function runCommitGate(input: CommitGateInput): CommitDecision;
```

---

## 8. Trace (append-only run record)

`packages/core`. Plan 2 (shape + persistence). Design spec §6: *append-only; each step records
input, action chosen, tool output, entropy before/after.*

```ts
/** EntropyScore exists as a plain type in Plan 1; this adds the matching schema (same shape). */
export const EntropyScoreSchema = z.object({
  taskEntropy: z.number(), evidenceEntropy: z.number(), actionEntropy: z.number(),
  policyEntropy: z.number(), memoryEntropy: z.number(), commitEntropy: z.number(),
});

export const TraceStepSchema = z.object({
  index: z.number().int().nonnegative(),
  at: z.string(),
  input: z.unknown(),                       // snapshot fed to this step
  action: CandidateActionSchema,            // the chosen, scored action
  toolOutput: z.unknown().nullable(),       // ToolResult / verifier Check[] / model reply
  entropyBefore: EntropyScoreSchema,
  entropyAfter: EntropyScoreSchema,
});
export type TraceStep = z.infer<typeof TraceStepSchema>;

export const TraceSchema = z.object({
  id: z.string(),
  runId: z.string(),
  procedureVersionId: z.string().nullable(),
  workflowVersion: z.string(),
  domain: WorkflowDomainSchema,
  createdAt: z.string(),
  steps: z.array(TraceStepSchema),          // append-only
  outcome: RunOutcomeSchema.nullable(),     // null while still running
});
export type Trace = z.infer<typeof TraceSchema>;

/** Lightweight pointer stored on BusinessProcedureVersion.runTraces. */
export const TraceReferenceSchema = z.object({
  traceId: z.string(),
  runId: z.string(),
  createdAt: z.string(),
  outcomeType: z.enum(["committed", "needs_approval", "needs_more_info", "rejected", "sandbox_only"]),
  artifactKey: z.string().nullable(),       // OSS key of the full Trace JSON
});
export type TraceReference = z.infer<typeof TraceReferenceSchema>;
```

---

## 9. Procedure versioning & promotion

`packages/core` (types + `PromotionDecision`); promotion logic & replay in `packages/evals`. Plan 6.

```ts
export const EvaluationResultSchema = z.object({
  caseId: z.string(),
  metric: z.string(),
  value: z.number(),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const ProcedureMetricsSchema = z.object({   // headline metrics, memo §20 / design spec §9
  safeCompletionRate: z.number(),
  falseCommitRate: z.number(),
  policyViolationRate: z.number(),
  approvalBurden: z.number(),
  evidenceCoverage: z.number(),
  costPerSafeCompletion: z.number(),
  latencyPerSafeCompletion: z.number(),
  memoryBloatRate: z.number(),
});
export type ProcedureMetrics = z.infer<typeof ProcedureMetricsSchema>;

export const PromotionReportSchema = z.object({
  fromVersion: z.string(),
  toVersion: z.string(),
  baseline: ProcedureMetricsSchema,
  candidate: ProcedureMetricsSchema,
  caseCount: z.number().int().nonnegative(),
});
export type PromotionReport = z.infer<typeof PromotionReportSchema>;

export const RegressionReportSchema = z.object({
  fromVersion: z.string(),
  toVersion: z.string(),
  regressions: z.array(z.object({
    caseId: z.string(), metric: z.string(), before: z.number(), after: z.number(),
  })),
});
export type RegressionReport = z.infer<typeof RegressionReportSchema>;

/** Reconciled from memo §9 + §19 (§14 R7): richer §19 shape, consistent fromVersion/toVersion. */
export const PromotionDecisionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("promote"), fromVersion: z.string(), toVersion: z.string(), report: PromotionReportSchema }),
  z.object({ type: z.literal("reject"), reason: z.string(), regressionReport: RegressionReportSchema }),
  z.object({ type: z.literal("needs_human_review"), reason: z.string() }),
]);
export type PromotionDecision = z.infer<typeof PromotionDecisionSchema>;

export const BusinessProcedureVersionSchema = z.object({
  id: z.string(),
  parentVersion: z.string().nullable(),
  name: z.string(),
  goal: z.string(),
  workflowSpec: WorkflowSpecSchema,
  allowedTools: z.array(ToolPermissionSchema),   // GOVERNED grant (vs spec.allowedTools: ToolRef[]) — §14 R3
  authorityBoundary: AuthorityBoundarySchema,
  // Governed source-of-truth policies. workflowSpec's copies are the as-generated PROPOSAL;
  // these top-level copies are the APPROVED, authoritative policies (§14 R10).
  evidencePolicy: EvidencePolicySchema,
  riskClass: RiskClassSchema,
  commitPolicy: CommitPolicySchema,
  memoryPolicy: MemoryPolicySchema,
  evalResults: z.array(EvaluationResultSchema),
  approvalRecord: ApprovalRecordSchema.nullable(),
  rollbackPointer: z.string().nullable(),
  runTraces: z.array(TraceReferenceSchema),
  createdAt: z.string(),
  promotedAt: z.string().nullable(),
});
export type BusinessProcedureVersion = z.infer<typeof BusinessProcedureVersionSchema>;
```

Promotion gate contract — deterministic, **`packages/core`** (not `packages/evals`), Plan 6.
Per design spec §4 ("core/ … CommitGate, PromotionGate"), `runPromotionGate` is a pure function
over `ProcedureMetrics` with zero eval/IO dependency. The **replay engine** (`runReplay`,
`runCase`, `computeProcedureMetrics`, `proposeWorkflowPatch`) lives in `packages/evals`.
Replay old vs new on seeded cases, then:

```ts
export type PromotionGateInput = {
  fromVersion: string;
  toVersion: string;
  baseline: ProcedureMetrics;
  candidate: ProcedureMetrics;
  caseCount: number;
};
export function runPromotionGate(input: PromotionGateInput): PromotionDecision;  // memo §19 criteria
```

---

## 10. Operational memory

Types in `packages/core`; value-scoring + write gate in `packages/memory`. Read path Plan 4,
write path Plan 6. Store only memories expected to reduce future uncertainty (memo §16).

```ts
export const OperationalMemoryTypeSchema = z.enum([
  "CustomerPreference", "WorkflowFailurePatch", "PolicyException", "EvidenceSource", "VerifierFinding",
]);
export type OperationalMemoryType = z.infer<typeof OperationalMemoryTypeSchema>;

const memoryBase = {
  id: z.string(),
  scope: z.string(),
  source: z.string(),                 // trace id / approved-doc id
  confidence: z.number().min(0).max(1),
  ttlDays: z.number().int().positive(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  value: z.number(),                  // scoreMemoryValue() output, code-filled (null-equivalent: 0)
};

export const CustomerPreferenceMemorySchema = z.object({
  type: z.literal("CustomerPreference"), entity: z.string(), fact: z.string(), ...memoryBase,
});
export const WorkflowFailurePatchMemorySchema = z.object({
  type: z.literal("WorkflowFailurePatch"), trigger: z.string(), patch: z.string(),
  validatedByReplay: z.boolean(), expectedEntropyReduction: z.number(), ...memoryBase,
});
export const PolicyExceptionMemorySchema = z.object({
  type: z.literal("PolicyException"), rule: z.string(), exception: z.string(),
  approvedBy: z.string(), ...memoryBase,
});
export const EvidenceSourceMemorySchema = z.object({
  type: z.literal("EvidenceSource"), claimCategory: ClaimCategorySchema, sourceTool: ToolNameSchema, ...memoryBase,
});
export const VerifierFindingMemorySchema = z.object({
  type: z.literal("VerifierFinding"), verifierName: VerifierNameSchema, finding: z.string(), ...memoryBase,
});

export const OperationalMemorySchema = z.discriminatedUnion("type", [
  CustomerPreferenceMemorySchema, WorkflowFailurePatchMemorySchema, PolicyExceptionMemorySchema,
  EvidenceSourceMemorySchema, VerifierFindingMemorySchema,
]);
export type OperationalMemory = z.infer<typeof OperationalMemorySchema>;
```

Memory value score — deterministic, `packages/memory`, memo §16:

```ts
export type MemoryValueInputs = {
  expectedFutureEntropyReduction: number;
  expectedReuseFrequency: number;
  evidenceConfidence: number;
  retrievalNoiseCost: number;
  stalenessRisk: number;
  storageCost: number;
};
export function scoreMemoryValue(i: MemoryValueInputs): number;
//   = i.expectedFutureEntropyReduction * i.expectedReuseFrequency * i.evidenceConfidence
//     − i.retrievalNoiseCost − i.stalenessRisk − i.storageCost
// Write gate: write iff score >= memoryPolicy.minMemoryValueToWrite AND no stronger conflict.
```

---

## 11. Tools

`packages/tools`. Plan 4. Each tool is deterministic-or-Qwen-backed but presents a uniform
interface; tools produce `EvidenceRef[]` that the latent state's claims point at.

```ts
import type { z } from "zod";
import type { EvidenceRef, ToolName, ToolPermissionLevel } from "@clarityloop/core";

export interface ToolResult<Data = unknown> {
  ok: boolean;
  data: Data | null;
  evidence: EvidenceRef[];                 // support this call produced
  error: string | null;
  costHint: { tokens: number; latencyMs: number; toolCost: number };  // feeds CandidateAction costs
}

export interface Tool<Args = Record<string, unknown>, Data = unknown> {
  name: ToolName;
  description: string;
  permission: ToolPermissionLevel;
  inputs: z.ZodType<Args>;                 // zod schema for args (validated before run)
  run(args: Args): Promise<ToolResult<Data>>;
}
```

The six concrete tools (names are the `ToolName` enum; design spec §4 / memo §11):

| `name` | permission | purpose | key args → data |
|---|---|---|---|
| `retrieve_memory` | `read_only` | fetch relevant `OperationalMemory` | `{ scope, entity?, type? }` → `OperationalMemory[]` |
| `lookup_catalog` | `read_only` | current SKU price/spec | `{ sku?, query? }` → `{ sku, name, unitPrice, currency }` |
| `check_stock` | `read_only` | availability / delivery | `{ sku, quantity }` → `{ available, leadTimeDays }` |
| `parse_supplier_quote` | `read_only` | extract a supplier quote (Qwen-VL) | `{ artifactKey }` → `{ lineItems[], total, currency }` |
| `compare_quote` | `draft` | reconcile supplier vs catalog | `{ supplier, catalog }` → `{ deltas[], withinPolicy }` |
| `draft_quote` | `draft` | produce a draft quote artifact | `{ customer, lineItems, deliveryDate }` → `{ artifactKey }` |

---

## 12. Verifiers

`packages/verifiers`. Plan 5. Deterministic; each returns one-or-more `Check`s consumed by the
commit gate.

```ts
import type { Check, EvidenceRef, LatentWorkflowState, VerifierName, WorkflowSpec } from "@clarityloop/core";

export interface VerifierInput {
  state: LatentWorkflowState;
  evidence: EvidenceRef[];
  workflowSpec: WorkflowSpec;
  draftArtifact: unknown | null;
}

export interface Verifier {
  name: VerifierName;
  run(input: VerifierInput): Check[];      // deterministic, synchronous
}
```

The six verifiers (names are the `VerifierName` enum):

| `name` | checks |
|---|---|
| `schema` | draft artifact / tool outputs match expected zod shapes |
| `numeric_reconciliation` | quote totals = Σ line items; supplier vs catalog deltas add up |
| `evidence_coverage` | every committable claim has an `evidencePointer`; coverage ≥ `minimumCoverageForCommit` |
| `policy` | `CommitPolicy.requireApprovalIf` / `forbiddenActions` / discount & value thresholds |
| `hallucinated_tool` | no step/claim references a tool absent from `AuthorityBoundary.allowedTools` |
| `missing_info` | no `required` `MissingField` remains unresolved |

---

## 13. Persistence — repositories & DB approach

`packages/storage` (interfaces + both implementations). Plan 2. Composed by `apps/api`.

### DB approach (authoritative decision)

**Single SQL layer.** The deployed build uses **`pg` against Postgres** (the `db` service in
`infra/docker-compose.yml` from Plan 1 Task 7; RDS/Postgres on Alibaba for the submission).
Tests use **in-memory repository implementations** (`InMemory*Repository`) — no DB, no network,
fast, deterministic. The repository pattern keeps Postgres ↔ **SQLite/D1 swappable** post-
hackathon (design spec §4 D4) by adding a third implementation behind the same interface.

Storage layout: zod-validated structures are stored as Postgres **`jsonb`** columns; queryable
keys (`runId`, `domain`, `version`, `scope`, `type`, `procedureVersionId`) are promoted to
indexed relational columns. Full `Trace` JSON is additionally written to OSS via `ArtifactStore`
(the `TraceReference.artifactKey` points there); Postgres holds the queryable head + steps.

Suggested tables: `runs`, `traces` (+ `trace_steps` or `steps jsonb`), `procedure_versions`,
`operational_memory`.

### Repository interfaces

```ts
import type {
  BusinessProcedureVersion, OperationalMemory, OperationalMemoryType,
  RunOutcome, Trace, TraceStep, WorkflowDomain, WorkflowSpec,
} from "@clarityloop/core";

export const RunRecordSchema = z.object({
  id: z.string(),
  procedureVersionId: z.string().nullable(),
  domain: WorkflowDomainSchema,
  inputRequest: z.string(),
  workflowSpec: WorkflowSpecSchema.nullable(),   // null until generated
  traceId: z.string().nullable(),
  outcome: RunOutcomeSchema.nullable(),          // null until finished
  createdAt: z.string(),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

export interface RunRepository {
  create(run: RunRecord): Promise<void>;
  get(runId: string): Promise<RunRecord | null>;
  setOutcome(runId: string, outcome: RunOutcome): Promise<void>;
  listByProcedure(versionId: string): Promise<RunRecord[]>;
}

export interface TraceRepository {
  create(trace: Trace): Promise<void>;                       // head, steps empty
  append(traceId: string, step: TraceStep): Promise<void>;   // append-only
  get(traceId: string): Promise<Trace | null>;
}

export interface ProcedureVersionRepository {
  put(version: BusinessProcedureVersion): Promise<void>;
  get(id: string): Promise<BusinessProcedureVersion | null>;
  getLatest(domain: WorkflowDomain): Promise<BusinessProcedureVersion | null>;
  listVersions(name: string): Promise<BusinessProcedureVersion[]>;
}

export interface MemoryRepository {
  put(mem: OperationalMemory): Promise<void>;
  get(id: string): Promise<OperationalMemory | null>;
  query(q: { scope?: string; type?: OperationalMemoryType; entity?: string }): Promise<OperationalMemory[]>;
  invalidate(id: string): Promise<void>;   // TTL / conflict invalidation (memo §16)
}
```

Each interface ships two implementations in `packages/storage`: `InMemory*Repository` (tests)
and `Pg*Repository` (deployed, `pg`).

---

## 14. Reconciliation log (memo inconsistencies fixed)

- **R1 — `LatentWorkflowState`.** Memo §8's nested shape (`entropy` inline,
  `competingHypotheses`, `evidenceMap`, `riskState`, `policyState`, `memoryState`,
  `nextBestActions`) is **superseded** by the as-built flat `@clarityloop/core` schema
  (`knownFacts/missingFields/claims/riskFlags/policyFlags/staleMemoryRefs/toolFailures`) with
  entropy computed externally by `scoreEntropy`. As-built wins (design spec §3 D3, §6).
- **R2 — Entropy ownership.** Entropy is never part of latent state nor model output; it is
  `scoreEntropy(state): EntropyScore`. `WorkflowStep.entropyTarget` therefore keys off
  `EntropyScore` (the six literal keys), not the removed `LatentWorkflowState["entropy"]`.
- **R3 — `ToolRef` vs `ToolPermission`.** Memo used both interchangeably. Split: `ToolRef`
  (declared tool, on `WorkflowSpec.allowedTools`) vs `ToolPermission` (governed grant with
  `level` + `maxRiskClass`, on `AuthorityBoundary` / `BusinessProcedureVersion.allowedTools`).
- **R4 — `EvidencePolicy.requiredForClaims`.** Memo §14 hard-coded five literal keys/values.
  Generalised to `z.record(ClaimCategory, EvidenceRequirement)` — same vocabulary, not rigid.
- **R5 — `CandidateAction.actionType`.** Memo §14's union used generic `parse_document` /
  `draft_artifact` and omitted `check_stock` / `compare_quote`. Replaced with the six concrete
  `ToolName`s plus meta-actions. Also split the type into `ProposedAction` (model output, no
  scores) and `CandidateAction` (adds code-computed costs + `score`), enforcing
  deterministic-over-structured.
- **R6 — `RunOutcome` vs `CommitDecision` tag mismatch.** Memo used `committed`/`rejected`
  (§9) vs `commit`/`reject` (§18). Kept both, defined the mapping (`commit→committed`,
  `reject→rejected`); `CommitDecision` is the gate output, `RunOutcome` is the persisted
  terminal record carrying `runId`/`traceId`/`artifactId`.
- **R7 — `PromotionDecision` defined twice.** Memo §9 (`fromVersion`/`toVersion`, no report)
  vs §19 (`from`/`to`, `report`, `reason`). Reconciled to the richer §19 with consistent
  `fromVersion`/`toVersion` naming and a typed `PromotionReport`.
- **R8 — `commitEntropyThreshold` was untyped.** The stop threshold referenced in memo
  §8/§15 had no home; added to `CommitPolicy` (default `0.3`).
- **R9 — `BudgetPolicy` was named but never sketched.** Defined concretely (loop/token/tool/
  human-ask/latency caps).
- **R10 — Policy duplication on `BusinessProcedureVersion`.** `WorkflowSpec` and the version
  both carry `evidencePolicy`/`commitPolicy`/`memoryPolicy`. Disambiguated: spec copies are the
  as-generated **proposal**; the version's top-level copies are the **approved/governed** source
  of truth.

---

## 15. Package & plan ownership matrix

| Contract | Package | Introduced by |
|---|---|---|
| `EvidenceRef`, `WorkflowDomain`, `ToolName`, `VerifierName`, `RiskClass` | core | Plan 2 |
| `ToolRef`, `ToolPermission`, `ToolPermissionLevel` | core | Plan 2 |
| `WorkflowStep(Action)`, `WorkflowSpec` | core | Plan 2 |
| `EvidencePolicy`, `CommitPolicy`, `MemoryPolicy`, `BudgetPolicy` | core | Plan 2 |
| `AuthorityBoundary` | core | Plan 2 (type) / enforced Plan 5 |
| `EntropyScoreSchema` (schema for existing `EntropyScore`) | core | Plan 2 |
| `Check`, `ApprovalPayload`, `ApprovalRecord`, `CommitDecision`, `RunOutcome` | core | Plan 2 (type) / gate logic Plan 5 |
| `runCommitGate` | core | Plan 5 |
| `TraceStep`, `Trace`, `TraceReference` | core | Plan 2 |
| `RunRecord` + `RunRepository`/`TraceRepository`/`ProcedureVersionRepository` (+ in-memory & `pg` impls) | storage | Plan 2 |
| `ActionType`, `ProposedAction`, `CandidateAction`, `scoreAction`, `selectNextBestAction` | core | Plan 4 |
| `Tool`, `ToolResult` + the six tools | tools | Plan 4 |
| `OperationalMemory` union + `MemoryRepository` | core (types) / storage (repo) | Plan 4 (read) |
| `scoreMemoryValue`, `MemoryValueInputs`, memory write gate | memory | Plan 6 (write) |
| `Verifier`, `VerifierInput` + the six verifiers | verifiers | Plan 5 |
| `EvaluationResult`, `ProcedureMetrics`, `PromotionReport`, `RegressionReport`, `PromotionDecision` | core | Plan 6 |
| `BusinessProcedureVersion` | core | Plan 2 (skeleton) / completed Plan 6 |
| `WorkflowPatch`, `WorkflowPatchOp`, `applyPatch` | core | Plan 6 |
| `runPromotionGate` | core | Plan 6 (see §9 placement note) |
| replay runner (`runReplay`, `runCase`, `computeProcedureMetrics`), `proposeWorkflowPatch`, `improveAndEvaluate` | evals | Plan 6 |
| `BenchmarkCase`, baseline runners, scoring report (built on `ProcedureMetrics`) | evals | Plan 7 |
| Loop controller, run service, SSE stream (composition of the above) | apps/api | Plan 3–6 |
