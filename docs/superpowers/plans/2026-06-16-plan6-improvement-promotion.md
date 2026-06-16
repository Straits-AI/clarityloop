# Improvement + Promotion (Replay) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the offline improvement loop (design spec §5 second half, §12 Phase 6): turn a failed/seed trace into a Qwen-proposed `WorkflowPatch`, replay the old vs patched `WorkflowSpec` deterministically over seeded cases, gate promotion on memo §19 criteria, persist the promoted `BusinessProcedureVersion` with lineage, surface old-vs-new replay metrics + version history in the dashboard, and add the bounded operational-memory write path (value score + TTL/conflict + write gate).

**Architecture:** The credibility rule from prior plans holds end-to-end here: **Qwen emits structure only; deterministic TypeScript decides.** Qwen proposes a `WorkflowPatch` (validated by zod via `generateStructured`); deterministic code applies it, replays both specs, computes `ProcedureMetrics`, and runs the deterministic `runPromotionGate`. New deterministic logic lands in `@clarityloop/core` (`applyPatch`, `runPromotionGate`, promotion + patch types). The deterministic replay engine and the Qwen patch-proposal wrapper land in a new `@clarityloop/evals` package (decoupled from `apps/api` via injected cases). The bounded-memory write path lands in a new `@clarityloop/memory` package (`scoreMemoryValue`, `memoryWriteGate`, TTL/conflict). `apps/api` composes the storage repositories (`ProcedureVersionRepository` from Plan 2) with `evals`/`core` to expose `/procedures/:id/improve`, `/procedures/:id/promote`, and version-lineage reads. `apps/web` (Plan 3 SPA) gains a replay-benchmark panel and a version-lineage panel fed by pure, unit-tested presenter functions. Every test uses a **fake `ModelProvider`** and in-memory repositories — no live API, no network.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Vitest (test), Zod (validation), Hono (API), React + Vite + Tailwind (dashboard). New workspace packages `@clarityloop/evals` and `@clarityloop/memory` follow the exact conventions of the existing packages (`type: module`, `tsconfig` extends `../../tsconfig.base.json`, scripts `build`/`test`/`typecheck`).

---

## Dependencies on prior plans (assumptions this plan builds on)

This plan is **Phase 6** and sits on top of Plans 1–5. It assumes the following are already built and exported, per the shared-contracts doc (`/docs/superpowers/specs/2026-06-16-shared-contracts.md`):

- **Plan 1 (`@clarityloop/core`):** `LatentWorkflowStateSchema`, `LatentWorkflowState`, `EntropyScore`, `scoreEntropy(state)`. (`@clarityloop/qwen`): `ModelProvider`, `ChatMessage`, `QwenTask`, `generateStructured`. (`@clarityloop/storage`): `InMemoryArtifactStore`.
- **Plan 2 (`@clarityloop/core`):** `WorkflowSpecSchema`/`WorkflowSpec`, `WorkflowStepSchema`/`WorkflowStep`, `WorkflowStepActionSchema`, `ToolRefSchema`, `ToolNameSchema`/`ToolName`, `WorkflowDomainSchema`/`WorkflowDomain`, `CommitPolicySchema` (with `commitEntropyThreshold`), `EvidencePolicySchema`, `MemoryPolicySchema`, `BudgetPolicySchema`, `AuthorityBoundarySchema`, `EntropyScoreSchema`, `RunOutcomeSchema`, `TraceSchema`/`TraceReferenceSchema`, `BusinessProcedureVersionSchema`/`BusinessProcedureVersion`. (`@clarityloop/storage`): `ProcedureVersionRepository` + `InMemoryProcedureVersionRepository`.
- **Plan 3:** `apps/web` Vite + React + Tailwind SPA scaffold with Vitest configured; a fetch/api layer convention under `apps/web/src/`.
- **Plan 4 (`@clarityloop/core`):** `OperationalMemory` union + member schemas, `OperationalMemoryTypeSchema`, `ClaimCategorySchema`, `VerifierNameSchema`. (`@clarityloop/storage`): `MemoryRepository` + `InMemoryMemoryRepository`.
- **Plan 5 (`@clarityloop/core`):** `runCommitGate` (not required here, but its presence confirms the deterministic-gate pattern this plan mirrors).

All Plan-6 cross-package imports use the package barrel (`@clarityloop/core`, `@clarityloop/storage`, `@clarityloop/qwen`) so they are robust to internal file layout. New intra-`core` modules import sibling schemas from `./schemas` and types from `./types`.

> **Reconciliation note (logged in §Self-Review and surfaced to the contracts author):** the shared-contracts §9/§15 matrix places `runPromotionGate` in `packages/evals`. This plan places `runPromotionGate` in **`@clarityloop/core`**, alongside the entropy scorer and `runCommitGate`, because (a) design spec §4 explicitly lists *"core/ … CommitGate, PromotionGate"*, (b) the Plan-6 scope statement requires *"the deterministic PromotionGate in @clarityloop/core"*, and (c) it is a pure function over `ProcedureMetrics` with zero eval/IO dependency. The **promotion types** (`PromotionDecision`, `ProcedureMetrics`, `PromotionReport`, `RegressionReport`, `EvaluationResult`) also live in `core` (matrix already assigns these to `core`). Only the **replay engine** and the **Qwen patch wrapper** live in `@clarityloop/evals`. This is the single placement deviation; all type *signatures* are copied verbatim.

> **Contract addition:** `WorkflowPatch`/`WorkflowPatchOp` and `applyPatch` are **not** in the shared-contracts doc. Per the contracts rule (*"If a later plan needs a shape not defined here, it adds it here first"*), Task 9 back-ports them into the contracts doc §4. They are introduced in `@clarityloop/core` by this plan.

---

## File Structure

Create:
- `packages/core/src/patch.ts` — `WorkflowPatchOpSchema`, `WorkflowPatchSchema`, `WorkflowPatch`, `applyPatch`.
- `packages/core/src/patch.test.ts`
- `packages/core/src/promotion.ts` — `EvaluationResultSchema`, `ProcedureMetricsSchema`, `PromotionReportSchema`, `RegressionReportSchema`, `PromotionDecisionSchema`, types, `PromotionGateInput`, `runPromotionGate`.
- `packages/core/src/promotion.test.ts`
- `packages/evals/package.json`, `packages/evals/tsconfig.json`
- `packages/evals/src/index.ts`
- `packages/evals/src/cases.ts` — `BenchmarkCaseSchema`, `GroundTruthSchema`, `BenchmarkCase`, `SEED_CASES`.
- `packages/evals/src/cases.test.ts`
- `packages/evals/src/replay.ts` — `specCapabilities`, `resolveGaps`, `decideOutcome`, `runCase`, `computeProcedureMetrics`, `runReplay`, `CaseRunResult`.
- `packages/evals/src/replay.test.ts`
- `packages/evals/src/improve.ts` — `FailureContextSchema`, `proposeWorkflowPatch`, `improveAndEvaluate`.
- `packages/evals/src/improve.test.ts`
- `packages/memory/package.json`, `packages/memory/tsconfig.json`
- `packages/memory/src/index.ts`
- `packages/memory/src/value.ts` — `MemoryValueInputs`, `scoreMemoryValue`.
- `packages/memory/src/write-gate.ts` — `MemoryWriteCandidate`, `MemoryWriteDecision`, `memoryWriteGate`, `isExpired`, `commitMemory`.
- `packages/memory/src/value.test.ts`, `packages/memory/src/write-gate.test.ts`
- `apps/web/src/lib/promotion-view.ts` — pure presenters `toReplayRows`, `toLineageRows`.
- `apps/web/src/lib/promotion-view.test.ts`
- `apps/web/src/components/ReplayBenchmarkPanel.tsx`
- `apps/web/src/components/VersionLineagePanel.tsx`
- `apps/web/src/api/procedures.ts` — typed fetch helpers.
- `docs/technical/improvement-promotion.md` — subsystem technical doc.

Modify:
- `packages/core/src/index.ts` — re-export `./patch`, `./promotion`.
- `apps/api/package.json` — add `@clarityloop/evals` dependency.
- `apps/api/src/app.ts` — add promotion/improve/lineage routes (optional deps).
- `apps/api/src/app.test.ts` — add promotion-route tests.
- `apps/api/src/server.ts` — wire `procedureRepo`, `traceRepo`, `replayCases`.
- `README.md` — Plan-6 feature section.
- `docs/superpowers/specs/2026-06-16-shared-contracts.md` — add `WorkflowPatch` + reconciliation.

---

## Task 1: `core` — `WorkflowPatch` schema + deterministic `applyPatch`

**Files:**
- Create: `packages/core/src/patch.ts`, `packages/core/src/patch.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/patch.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { WorkflowPatchSchema, applyPatch } from "./patch";
import type { WorkflowSpec, WorkflowStep } from "./types";

const toolStep = (id: string, toolName: string): WorkflowStep => ({
  id,
  name: id,
  purpose: `run ${toolName}`,
  action: { type: "tool", toolName: toolName as WorkflowStep["action"] extends { toolName: infer T } ? T : never, args: {} } as WorkflowStep["action"],
  expectedOutputs: ["out"],
  evidenceProduced: null,
  entropyTarget: "evidenceEntropy",
});

const baseSpec: WorkflowSpec = {
  id: "spec-1",
  name: "customer-quote",
  goal: "produce a safe quote",
  version: "v1",
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote"] },
  steps: [
    {
      id: "s_parse",
      name: "parse",
      purpose: "parse request",
      action: { type: "model", promptTemplate: "parse" },
      expectedOutputs: ["facts"],
      evidenceProduced: null,
      entropyTarget: "taskEntropy",
    },
    toolStep("s_draft", "draft_quote"),
  ],
  allowedTools: [{ toolName: "draft_quote", defaultArgs: null }],
  evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
  commitPolicy: {
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
  },
  memoryPolicy: {
    writeEnabled: true,
    allowedTypes: ["CustomerPreference"],
    minMemoryValueToWrite: 0.1,
    defaultTtlDays: 180,
    maxEntriesPerScope: 50,
    conflictResolution: "prefer_higher_confidence",
  },
  budgetPolicy: {
    maxLoopIterations: 8,
    maxTokens: 20000,
    maxToolCalls: 12,
    maxHumanAsks: 2,
    maxLatencyMs: 60000,
  },
};

describe("WorkflowPatchSchema", () => {
  it("rejects a patch with an empty ops array", () => {
    expect(() =>
      WorkflowPatchSchema.parse({
        id: "p1",
        rationale: "x",
        triggerCondition: "always",
        sourceTraceId: null,
        ops: [],
        expectedEntropyReduction: 0.1,
      }),
    ).toThrow();
  });
});

describe("applyPatch", () => {
  it("inserts a step after the named step and bumps the version immutably", () => {
    const patch = WorkflowPatchSchema.parse({
      id: "p1",
      rationale: "retrieve memory before drafting for 'same as last time'",
      triggerCondition: "inquiry contains 'same as last time'",
      sourceTraceId: "trace_001",
      ops: [
        {
          op: "insert_step",
          afterStepId: "s_parse",
          step: toolStep("s_retrieve", "retrieve_memory"),
        },
      ],
      expectedEntropyReduction: 0.31,
    });
    const next = applyPatch(baseSpec, patch);
    expect(next.steps.map((s) => s.id)).toEqual(["s_parse", "s_retrieve", "s_draft"]);
    expect(next.version).toBe("v2");
    // immutability: original untouched
    expect(baseSpec.steps.map((s) => s.id)).toEqual(["s_parse", "s_draft"]);
  });

  it("inserts at the front when afterStepId is null", () => {
    const patch = WorkflowPatchSchema.parse({
      id: "p2",
      rationale: "front insert",
      triggerCondition: "always",
      sourceTraceId: null,
      ops: [{ op: "insert_step", afterStepId: null, step: toolStep("s_first", "lookup_catalog") }],
      expectedEntropyReduction: 0.1,
    });
    expect(applyPatch(baseSpec, patch).steps[0].id).toBe("s_first");
  });

  it("sets the commit threshold via set_commit_threshold", () => {
    const patch = WorkflowPatchSchema.parse({
      id: "p3",
      rationale: "tighten",
      triggerCondition: "always",
      sourceTraceId: null,
      ops: [{ op: "set_commit_threshold", commitEntropyThreshold: 0.2 }],
      expectedEntropyReduction: 0.0,
    });
    expect(applyPatch(baseSpec, patch).commitPolicy.commitEntropyThreshold).toBe(0.2);
  });

  it("throws when removing a step that does not exist", () => {
    const patch = WorkflowPatchSchema.parse({
      id: "p4",
      rationale: "bad",
      triggerCondition: "always",
      sourceTraceId: null,
      ops: [{ op: "remove_step", stepId: "nope" }],
      expectedEntropyReduction: 0.0,
    });
    expect(() => applyPatch(baseSpec, patch)).toThrow(/not found/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './patch'`.

- [ ] **Step 3: Implement `patch.ts`**

`packages/core/src/patch.ts`:
```ts
import { z } from "zod";
import { WorkflowStepSchema } from "./schemas";
import type { WorkflowSpec } from "./types";

/** One structural edit to a WorkflowSpec. Qwen proposes these; code applies them. */
export const WorkflowPatchOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("insert_step"),
    afterStepId: z.string().nullable(), // null => insert at the front
    step: WorkflowStepSchema,
  }),
  z.object({ op: z.literal("remove_step"), stepId: z.string() }),
  z.object({ op: z.literal("replace_step"), stepId: z.string(), step: WorkflowStepSchema }),
  z.object({ op: z.literal("set_commit_threshold"), commitEntropyThreshold: z.number().min(0).max(1) }),
]);
export type WorkflowPatchOp = z.infer<typeof WorkflowPatchOpSchema>;

/** A Qwen-proposed, schema-validated workflow improvement (design spec §5 improvement loop). */
export const WorkflowPatchSchema = z.object({
  id: z.string(),
  rationale: z.string(),
  triggerCondition: z.string(), // NL condition, e.g. "inquiry contains 'same as last time'"
  sourceTraceId: z.string().nullable(),
  ops: z.array(WorkflowPatchOpSchema).min(1),
  expectedEntropyReduction: z.number(),
});
export type WorkflowPatch = z.infer<typeof WorkflowPatchSchema>;

/** Bump a trailing integer version: "v1" -> "v2", "1.2.0" -> "1.2.1". */
function bumpVersion(v: string): string {
  const m = v.match(/^(.*?)(\d+)$/);
  if (!m) return `${v}.1`;
  const [, prefix, num] = m;
  return `${prefix}${Number(num) + 1}`;
}

/**
 * Deterministically apply a WorkflowPatch to a WorkflowSpec, returning a NEW spec
 * (immutable) with a bumped version. Throws on an op that references a missing step.
 */
export function applyPatch(spec: WorkflowSpec, patch: WorkflowPatch): WorkflowSpec {
  let steps = [...spec.steps];
  let commitPolicy = { ...spec.commitPolicy };

  for (const op of patch.ops) {
    switch (op.op) {
      case "insert_step": {
        if (op.afterStepId === null) {
          steps = [op.step, ...steps];
          break;
        }
        const idx = steps.findIndex((s) => s.id === op.afterStepId);
        if (idx === -1) throw new Error(`insert_step: afterStepId '${op.afterStepId}' not found`);
        steps = [...steps.slice(0, idx + 1), op.step, ...steps.slice(idx + 1)];
        break;
      }
      case "remove_step": {
        const idx = steps.findIndex((s) => s.id === op.stepId);
        if (idx === -1) throw new Error(`remove_step: stepId '${op.stepId}' not found`);
        steps = steps.filter((s) => s.id !== op.stepId);
        break;
      }
      case "replace_step": {
        const idx = steps.findIndex((s) => s.id === op.stepId);
        if (idx === -1) throw new Error(`replace_step: stepId '${op.stepId}' not found`);
        steps = steps.map((s) => (s.id === op.stepId ? op.step : s));
        break;
      }
      case "set_commit_threshold": {
        commitPolicy = { ...commitPolicy, commitEntropyThreshold: op.commitEntropyThreshold };
        break;
      }
    }
  }

  return { ...spec, version: bumpVersion(spec.version), steps, commitPolicy };
}
```

`packages/core/src/index.ts` — add:
```ts
export * from "./patch";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS — patch suite green (5 new assertions), all prior core tests still pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): WorkflowPatch schema and deterministic applyPatch"
```

---

## Task 2: `core` — promotion types + deterministic `runPromotionGate`

**Files:**
- Create: `packages/core/src/promotion.ts`, `packages/core/src/promotion.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/core/src/promotion.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runPromotionGate, type ProcedureMetrics } from "./promotion";

const metrics = (over: Partial<ProcedureMetrics>): ProcedureMetrics => ({
  safeCompletionRate: 0.5,
  falseCommitRate: 0.2,
  policyViolationRate: 0.0,
  approvalBurden: 0.3,
  evidenceCoverage: 0.9,
  costPerSafeCompletion: 100,
  latencyPerSafeCompletion: 100,
  memoryBloatRate: 0.0,
  ...over,
});

describe("runPromotionGate", () => {
  it("promotes when safety improves with no regression and within budget", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({}),
      candidate: metrics({ safeCompletionRate: 0.8, falseCommitRate: 0.05, costPerSafeCompletion: 90 }),
      caseCount: 10,
    });
    expect(decision.type).toBe("promote");
    if (decision.type === "promote") {
      expect(decision.fromVersion).toBe("v1");
      expect(decision.toVersion).toBe("v2");
      expect(decision.report.candidate.falseCommitRate).toBe(0.05);
      expect(decision.report.caseCount).toBe(10);
    }
  });

  it("rejects with a regression report when false commits go up", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({ falseCommitRate: 0.1 }),
      candidate: metrics({ falseCommitRate: 0.3 }),
      caseCount: 10,
    });
    expect(decision.type).toBe("reject");
    if (decision.type === "reject") {
      expect(decision.regressionReport.regressions.some((r) => r.metric === "falseCommitRate")).toBe(true);
      expect(decision.regressionReport.regressions[0].before).toBe(0.1);
      expect(decision.regressionReport.regressions[0].after).toBe(0.3);
    }
  });

  it("rejects when safe-completion regresses", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({ safeCompletionRate: 0.7 }),
      candidate: metrics({ safeCompletionRate: 0.6 }),
      caseCount: 10,
    });
    expect(decision.type).toBe("reject");
  });

  it("needs human review when neither regression nor improvement is measurable", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({}),
      candidate: metrics({}),
      caseCount: 10,
    });
    expect(decision.type).toBe("needs_human_review");
  });

  it("needs human review when safety improves but the cost budget is blown", () => {
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: metrics({ costPerSafeCompletion: 100 }),
      candidate: metrics({ falseCommitRate: 0.05, costPerSafeCompletion: 1000 }),
      caseCount: 10,
    });
    expect(decision.type).toBe("needs_human_review");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './promotion'`.

- [ ] **Step 3: Implement `promotion.ts`**

`packages/core/src/promotion.ts`:
```ts
import { z } from "zod";

/** A single per-case (or aggregate) metric reading. */
export const EvaluationResultSchema = z.object({
  caseId: z.string(),
  metric: z.string(),
  value: z.number(),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

/** Headline procedure metrics (memo §20 / design spec §9). */
export const ProcedureMetricsSchema = z.object({
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
  regressions: z.array(
    z.object({ caseId: z.string(), metric: z.string(), before: z.number(), after: z.number() }),
  ),
});
export type RegressionReport = z.infer<typeof RegressionReportSchema>;

export const PromotionDecisionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("promote"),
    fromVersion: z.string(),
    toVersion: z.string(),
    report: PromotionReportSchema,
  }),
  z.object({ type: z.literal("reject"), reason: z.string(), regressionReport: RegressionReportSchema }),
  z.object({ type: z.literal("needs_human_review"), reason: z.string() }),
]);
export type PromotionDecision = z.infer<typeof PromotionDecisionSchema>;

export type PromotionGateInput = {
  fromVersion: string;
  toVersion: string;
  baseline: ProcedureMetrics;
  candidate: ProcedureMetrics;
  caseCount: number;
};

// Internal, deterministic thresholds (memo §19 "acceptable threshold" / "budget").
const EPS = 1e-9;
const APPROVAL_BURDEN_CEILING = 0.5;
const MEMORY_BLOAT_CEILING = 0.2;
const COST_TOLERANCE = 1.1; // candidate cost must stay within +10% of baseline
const LATENCY_TOLERANCE = 1.1;

/**
 * memo §19 promotion criteria, deterministic. Invariant: the model may propose a
 * better workflow; replay evidence (these metrics) decides whether it is promoted.
 */
export function runPromotionGate(input: PromotionGateInput): PromotionDecision {
  const { fromVersion, toVersion, baseline, candidate, caseCount } = input;

  // 1. Hard regressions on safety metrics -> reject.
  const regressions: RegressionReport["regressions"] = [];
  if (candidate.falseCommitRate > baseline.falseCommitRate + EPS)
    regressions.push({ caseId: "aggregate", metric: "falseCommitRate", before: baseline.falseCommitRate, after: candidate.falseCommitRate });
  if (candidate.safeCompletionRate < baseline.safeCompletionRate - EPS)
    regressions.push({ caseId: "aggregate", metric: "safeCompletionRate", before: baseline.safeCompletionRate, after: candidate.safeCompletionRate });
  if (candidate.policyViolationRate > baseline.policyViolationRate + EPS)
    regressions.push({ caseId: "aggregate", metric: "policyViolationRate", before: baseline.policyViolationRate, after: candidate.policyViolationRate });

  if (regressions.length > 0) {
    return {
      type: "reject",
      reason: "candidate regresses on at least one safety metric",
      regressionReport: { fromVersion, toVersion, regressions },
    };
  }

  // 2. No regression. Is there a measurable safety improvement?
  const improved =
    candidate.falseCommitRate < baseline.falseCommitRate - EPS ||
    candidate.safeCompletionRate > baseline.safeCompletionRate + EPS;

  // 3. Secondary budget / burden constraints.
  const withinBudget =
    candidate.approvalBurden <= APPROVAL_BURDEN_CEILING + EPS &&
    candidate.memoryBloatRate <= MEMORY_BLOAT_CEILING + EPS &&
    candidate.costPerSafeCompletion <= baseline.costPerSafeCompletion * COST_TOLERANCE + EPS &&
    candidate.latencyPerSafeCompletion <= baseline.latencyPerSafeCompletion * LATENCY_TOLERANCE + EPS;

  if (improved && withinBudget) {
    return { type: "promote", fromVersion, toVersion, report: { fromVersion, toVersion, baseline, candidate, caseCount } };
  }
  if (improved && !withinBudget) {
    return { type: "needs_human_review", reason: "safety improves but exceeds approval/cost/latency budget" };
  }
  return { type: "needs_human_review", reason: "no measurable regression or improvement; manual judgment required" };
}
```

`packages/core/src/index.ts` — add:
```ts
export * from "./promotion";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS — 5 promotion assertions green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): promotion metrics types and deterministic runPromotionGate (memo §19)"
```

---

## Task 3: `evals` package scaffold + `BenchmarkCase` + seed cases

**Files:**
- Create: `packages/evals/package.json`, `packages/evals/tsconfig.json`, `packages/evals/src/index.ts`, `packages/evals/src/cases.ts`, `packages/evals/src/cases.test.ts`

- [ ] **Step 1: Create the package manifests**

`packages/evals/package.json`:
```json
{
  "name": "@clarityloop/evals",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@clarityloop/core": "workspace:*",
    "@clarityloop/qwen": "workspace:*",
    "zod": "^3.23.0"
  }
}
```

`packages/evals/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

`packages/evals/src/index.ts`:
```ts
export * from "./cases";
```

- [ ] **Step 2: Write the failing test**

`packages/evals/src/cases.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { BenchmarkCaseSchema, SEED_CASES } from "./cases";

describe("SEED_CASES", () => {
  it("every seed case parses against the schema", () => {
    for (const c of SEED_CASES) expect(() => BenchmarkCaseSchema.parse(c)).not.toThrow();
  });

  it("covers the core promotion-demo case types", () => {
    const types = new Set(SEED_CASES.map((c) => c.caseType));
    expect(types.has("clear")).toBe(true);
    expect(types.has("same_as_last_time")).toBe(true);
    expect(types.has("stale_memory")).toBe(true);
    expect(types.has("unsupported_claim")).toBe(true);
  });

  it("has unique case ids", () => {
    const ids = SEED_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/evals test`
Expected: FAIL — `Cannot find module './cases'`.

- [ ] **Step 4: Implement `cases.ts`**

`packages/evals/src/cases.ts`:
```ts
import { z } from "zod";
import { LatentWorkflowStateSchema, ToolNameSchema, WorkflowDomainSchema } from "@clarityloop/core";

/**
 * Ground truth + resolution map for a seeded replay case. Deterministic:
 * a gap (missing field / unsupported claim / stale memory) is "resolved" iff the
 * spec under replay has the declared tool capability. Safety is then derived from
 * the EFFECTIVE state, so a patch that adds the resolving capability changes the
 * outcome without any model call.
 */
export const GroundTruthSchema = z.object({
  expectedOutcome: z.enum(["committed", "needs_approval", "needs_more_info", "rejected", "sandbox_only"]),
  safetyCriticalMissingFieldIds: z.array(z.string()),
  safetyCriticalClaimIds: z.array(z.string()),
  staleMemoryIsCritical: z.boolean(),
  policyViolationIfActiveFlag: z.boolean(),
});
export type GroundTruth = z.infer<typeof GroundTruthSchema>;

export const CaseResolutionSchema = z.object({
  missingFieldResolvers: z.record(z.string(), ToolNameSchema), // missingFieldId -> tool that resolves it
  claimSupporters: z.record(z.string(), ToolNameSchema), // claimId -> tool that supplies evidence
  staleResolvedBy: ToolNameSchema.nullable(), // tool that refreshes stale memory, or null
});
export type CaseResolution = z.infer<typeof CaseResolutionSchema>;

export const BenchmarkCaseSchema = z.object({
  id: z.string(),
  domain: WorkflowDomainSchema,
  caseType: z.enum([
    "clear",
    "ambiguous",
    "same_as_last_time",
    "stale_memory",
    "supplier_mismatch",
    "catalog_mismatch",
    "missing_delivery",
    "unauthorized_discount",
    "unsupported_claim",
    "adversarial_attachment",
    "policy_exception",
    "high_value_approval",
  ]),
  inputRequest: z.string(),
  seededLatentState: LatentWorkflowStateSchema, // what extraction would yield (the fake-provider fixture)
  resolution: CaseResolutionSchema,
  groundTruth: GroundTruthSchema,
});
export type BenchmarkCase = z.infer<typeof BenchmarkCaseSchema>;

const supportedClaim = (id: string) => ({ id, text: `${id} text`, evidencePointer: `ev:user:${id}` });

/** Deterministic seed set for promotion replay (design spec §9 case types). */
export const SEED_CASES: BenchmarkCase[] = [
  {
    id: "case-clear",
    domain: "quote",
    caseType: "clear",
    inputRequest: "Please quote 100 cartons of SKU-7788 for delivery next month.",
    seededLatentState: {
      goal: "quote 100 cartons SKU-7788",
      workflowVersion: "v1",
      knownFacts: [{ id: "f1", text: "customer ABC, SKU-7788, qty 100", confidence: 0.95 }],
      missingFields: [],
      claims: [supportedClaim("c1")],
      riskFlags: [],
      policyFlags: [],
      staleMemoryRefs: [],
      toolFailures: [],
    },
    resolution: { missingFieldResolvers: {}, claimSupporters: {}, staleResolvedBy: null },
    groundTruth: {
      expectedOutcome: "committed",
      safetyCriticalMissingFieldIds: [],
      safetyCriticalClaimIds: [],
      staleMemoryIsCritical: false,
      policyViolationIfActiveFlag: false,
    },
  },
  {
    id: "case-same-as-last-time",
    domain: "quote",
    caseType: "same_as_last_time",
    inputRequest: "Same as last time, need 120 cartons urgently next week.",
    seededLatentState: {
      goal: "repeat order, 120 cartons",
      workflowVersion: "v1",
      knownFacts: [{ id: "f1", text: "customer ABC, qty 120", confidence: 0.9 }],
      missingFields: [{ id: "m_sku", name: "exact_sku", necessity: "required" }],
      claims: [supportedClaim("c1")],
      riskFlags: [],
      policyFlags: [],
      staleMemoryRefs: [],
      toolFailures: [],
    },
    resolution: { missingFieldResolvers: { m_sku: "retrieve_memory" }, claimSupporters: {}, staleResolvedBy: null },
    groundTruth: {
      expectedOutcome: "committed",
      safetyCriticalMissingFieldIds: ["m_sku"],
      safetyCriticalClaimIds: [],
      staleMemoryIsCritical: false,
      policyViolationIfActiveFlag: false,
    },
  },
  {
    id: "case-stale-price",
    domain: "quote",
    caseType: "stale_memory",
    inputRequest: "Quote the usual price for 80 cartons of SKU-7788.",
    seededLatentState: {
      goal: "quote 80 cartons at usual price",
      workflowVersion: "v1",
      knownFacts: [{ id: "f1", text: "customer ABC, SKU-7788, qty 80", confidence: 0.9 }],
      missingFields: [],
      claims: [supportedClaim("c1")],
      riskFlags: [],
      policyFlags: [],
      staleMemoryRefs: ["price@2026-05"],
      toolFailures: [],
    },
    resolution: { missingFieldResolvers: {}, claimSupporters: {}, staleResolvedBy: "lookup_catalog" },
    groundTruth: {
      expectedOutcome: "committed",
      safetyCriticalMissingFieldIds: [],
      safetyCriticalClaimIds: [],
      staleMemoryIsCritical: true,
      policyViolationIfActiveFlag: false,
    },
  },
  {
    id: "case-unsupported-total",
    domain: "supplier_comparison",
    caseType: "unsupported_claim",
    inputRequest: "Confirm the supplier total matches our catalog before quoting.",
    seededLatentState: {
      goal: "verify supplier total vs catalog",
      workflowVersion: "v1",
      knownFacts: [{ id: "f1", text: "supplier quote attached", confidence: 0.8 }],
      missingFields: [],
      claims: [{ id: "c_total", text: "supplier total reconciles", evidencePointer: null }],
      riskFlags: [],
      policyFlags: [],
      staleMemoryRefs: [],
      toolFailures: [],
    },
    resolution: { missingFieldResolvers: {}, claimSupporters: { c_total: "compare_quote" }, staleResolvedBy: null },
    groundTruth: {
      expectedOutcome: "committed",
      safetyCriticalMissingFieldIds: [],
      safetyCriticalClaimIds: ["c_total"],
      staleMemoryIsCritical: false,
      policyViolationIfActiveFlag: false,
    },
  },
];
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @clarityloop/evals test`
Expected: PASS — 3 case-schema assertions green. (Run `pnpm install` first if the new workspace package is not yet linked.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(evals): scaffold package with BenchmarkCase schema and deterministic seed cases"
```

---

## Task 4: `evals` — deterministic replay engine + metrics

**Files:**
- Create: `packages/evals/src/replay.ts`, `packages/evals/src/replay.test.ts`
- Modify: `packages/evals/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/evals/src/replay.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runPromotionGate } from "@clarityloop/core";
import type { ToolName, WorkflowSpec, WorkflowStep } from "@clarityloop/core";
import { runReplay, computeProcedureMetrics, runCase } from "./replay";
import { SEED_CASES } from "./cases";

const toolStep = (id: string, toolName: ToolName): WorkflowStep => ({
  id,
  name: id,
  purpose: `run ${toolName}`,
  action: { type: "tool", toolName, args: {} },
  expectedOutputs: ["out"],
  evidenceProduced: null,
  entropyTarget: "evidenceEntropy",
});

const makeSpec = (version: string, tools: ToolName[]): WorkflowSpec => ({
  id: `spec-${version}`,
  name: "customer-quote",
  goal: "produce a safe quote",
  version,
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote"] },
  steps: [
    {
      id: "s_parse",
      name: "parse",
      purpose: "parse",
      action: { type: "model", promptTemplate: "parse" },
      expectedOutputs: ["facts"],
      evidenceProduced: null,
      entropyTarget: "taskEntropy",
    },
    ...tools.map((t) => toolStep(`s_${t}`, t)),
  ],
  allowedTools: tools.map((toolName) => ({ toolName, defaultArgs: null })),
  evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
  commitPolicy: {
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
  },
  memoryPolicy: {
    writeEnabled: true,
    allowedTypes: ["CustomerPreference"],
    minMemoryValueToWrite: 0.1,
    defaultTtlDays: 180,
    maxEntriesPerScope: 50,
    conflictResolution: "prefer_higher_confidence",
  },
  budgetPolicy: { maxLoopIterations: 8, maxTokens: 20000, maxToolCalls: 12, maxHumanAsks: 2, maxLatencyMs: 60000 },
});

// Old: only drafts. New: drafts AND can retrieve memory / look up catalog / compare.
const oldSpec = makeSpec("v1", ["draft_quote"]);
const newSpec = makeSpec("v2", ["draft_quote", "retrieve_memory", "lookup_catalog", "compare_quote"]);

describe("runCase (deterministic)", () => {
  it("old spec false-commits on the stale-memory case", () => {
    const stale = SEED_CASES.find((c) => c.id === "case-stale-price")!;
    const r = runCase(oldSpec, stale);
    expect(r.committed).toBe(true);
    expect(r.falseCommit).toBe(true);
    expect(r.safeCompletion).toBe(false);
  });

  it("new spec safely completes the stale-memory case", () => {
    const stale = SEED_CASES.find((c) => c.id === "case-stale-price")!;
    const r = runCase(newSpec, stale);
    expect(r.falseCommit).toBe(false);
    expect(r.safeCompletion).toBe(true);
  });

  it("old spec asks for missing info on same-as-last-time; new spec completes", () => {
    const c = SEED_CASES.find((x) => x.id === "case-same-as-last-time")!;
    expect(runCase(oldSpec, c).outcome).toBe("needs_more_info");
    expect(runCase(newSpec, c).safeCompletion).toBe(true);
  });
});

describe("runReplay + computeProcedureMetrics", () => {
  it("computes deterministic baseline vs candidate metrics over the seed set", () => {
    const report = runReplay({ fromVersion: "v1", toVersion: "v2", oldSpec, newSpec, cases: SEED_CASES });
    expect(report.caseCount).toBe(4);
    // baseline: only the clear case is safely completed (1/4); stale case is a false commit (1/4)
    expect(report.baseline.safeCompletionRate).toBeCloseTo(0.25, 5);
    expect(report.baseline.falseCommitRate).toBeCloseTo(0.25, 5);
    // candidate: all four safely completed, zero false commits
    expect(report.candidate.safeCompletionRate).toBeCloseTo(1, 5);
    expect(report.candidate.falseCommitRate).toBeCloseTo(0, 5);
  });

  it("is reproducible: identical inputs yield identical metrics", () => {
    const a = runReplay({ fromVersion: "v1", toVersion: "v2", oldSpec, newSpec, cases: SEED_CASES });
    const b = runReplay({ fromVersion: "v1", toVersion: "v2", oldSpec, newSpec, cases: SEED_CASES });
    expect(a).toEqual(b);
  });

  it("feeds runPromotionGate to a promote decision", () => {
    const report = runReplay({ fromVersion: "v1", toVersion: "v2", oldSpec, newSpec, cases: SEED_CASES });
    const decision = runPromotionGate({
      fromVersion: "v1",
      toVersion: "v2",
      baseline: report.baseline,
      candidate: report.candidate,
      caseCount: report.caseCount,
    });
    expect(decision.type).toBe("promote");
  });

  it("empty case set yields zeroed rates", () => {
    expect(computeProcedureMetrics([]).safeCompletionRate).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/evals test`
Expected: FAIL — `Cannot find module './replay'`.

- [ ] **Step 3: Implement `replay.ts`**

`packages/evals/src/replay.ts`:
```ts
import { scoreEntropy } from "@clarityloop/core";
import type {
  LatentWorkflowState,
  PromotionReport,
  ProcedureMetrics,
  RunOutcome,
  ToolName,
  WorkflowSpec,
} from "@clarityloop/core";
import type { BenchmarkCase, CaseResolution } from "./cases";

const COST_PER_STEP = 100;
const LATENCY_PER_STEP = 50;

export type CaseRunResult = {
  caseId: string;
  outcome: RunOutcome["type"];
  committed: boolean;
  falseCommit: boolean;
  policyViolation: boolean;
  safeCompletion: boolean;
  askedHuman: boolean;
  evidenceCoverage: number;
  tokens: number;
  latencyMs: number;
};

/** Tools the spec can actually perform: declared allowedTools + tool steps. */
export function specCapabilities(spec: WorkflowSpec): Set<ToolName> {
  const caps = new Set<ToolName>();
  for (const t of spec.allowedTools) caps.add(t.toolName);
  for (const s of spec.steps) if (s.action.type === "tool") caps.add(s.action.toolName);
  return caps;
}

/** Apply a spec's capabilities to a seeded latent state, resolving the gaps it can. */
export function resolveGaps(
  state: LatentWorkflowState,
  caps: Set<ToolName>,
  resolution: CaseResolution,
): LatentWorkflowState {
  const missingFields = state.missingFields.filter((m) => {
    const resolver = resolution.missingFieldResolvers[m.id];
    return !(resolver && caps.has(resolver));
  });
  const claims = state.claims.map((c) => {
    if (c.evidencePointer !== null) return c;
    const supporter = resolution.claimSupporters[c.id];
    return supporter && caps.has(supporter) ? { ...c, evidencePointer: `ev:${supporter}:${c.id}` } : c;
  });
  const staleCleared = resolution.staleResolvedBy !== null && caps.has(resolution.staleResolvedBy);
  const staleMemoryRefs = staleCleared ? [] : state.staleMemoryRefs;
  return { ...state, missingFields, claims, staleMemoryRefs };
}

function computeCoverage(state: LatentWorkflowState): number {
  if (state.claims.length === 0) return 1;
  const supported = state.claims.filter((c) => c.evidencePointer !== null).length;
  return supported / state.claims.length;
}

/** Commit-gate-lite over the effective state: reuses scoreEntropy (the loop's kernel). */
export function decideOutcome(state: LatentWorkflowState, spec: WorkflowSpec): RunOutcome["type"] {
  const requiredMissing = state.missingFields.filter((m) => m.necessity === "required");
  if (requiredMissing.length > 0) return "needs_more_info";
  if (state.riskFlags.some((r) => r.severity === "high")) return "needs_approval";
  const entropy = scoreEntropy(state);
  const coverage = computeCoverage(state);
  if (
    entropy.commitEntropy < spec.commitPolicy.commitEntropyThreshold &&
    coverage >= spec.evidencePolicy.minimumCoverageForCommit
  ) {
    return "committed";
  }
  return "rejected";
}

/** Run a single seeded case against a spec and classify the result vs ground truth. */
export function runCase(spec: WorkflowSpec, c: BenchmarkCase): CaseRunResult {
  const caps = specCapabilities(spec);
  const effective = resolveGaps(c.seededLatentState, caps, c.resolution);
  const outcome = decideOutcome(effective, spec);
  const gt = c.groundTruth;

  const committed = outcome === "committed";
  const coverage = computeCoverage(effective);
  const falseCommit =
    committed &&
    (gt.safetyCriticalMissingFieldIds.some((id) => effective.missingFields.some((m) => m.id === id)) ||
      gt.safetyCriticalClaimIds.some((id) =>
        effective.claims.some((cl) => cl.id === id && cl.evidencePointer === null),
      ) ||
      (gt.staleMemoryIsCritical && effective.staleMemoryRefs.length > 0));
  const policyViolation = committed && gt.policyViolationIfActiveFlag && effective.policyFlags.some((p) => p.ambiguous);
  const safeCompletion =
    committed && !falseCommit && !policyViolation && coverage >= spec.evidencePolicy.minimumCoverageForCommit;

  const stepCount = spec.steps.length;
  return {
    caseId: c.id,
    outcome,
    committed,
    falseCommit,
    policyViolation,
    safeCompletion,
    askedHuman: outcome === "needs_approval" || outcome === "needs_more_info",
    evidenceCoverage: coverage,
    tokens: stepCount * COST_PER_STEP,
    latencyMs: stepCount * LATENCY_PER_STEP,
  };
}

const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/** Aggregate per-case results into headline ProcedureMetrics. Deterministic. */
export function computeProcedureMetrics(results: CaseRunResult[]): ProcedureMetrics {
  const safeCount = results.filter((r) => r.safeCompletion).length;
  const totalTokens = results.reduce((a, r) => a + r.tokens, 0);
  const totalLatency = results.reduce((a, r) => a + r.latencyMs, 0);
  return {
    safeCompletionRate: mean(results.map((r) => (r.safeCompletion ? 1 : 0))),
    falseCommitRate: mean(results.map((r) => (r.falseCommit ? 1 : 0))),
    policyViolationRate: mean(results.map((r) => (r.policyViolation ? 1 : 0))),
    approvalBurden: mean(results.map((r) => (r.askedHuman ? 1 : 0))),
    evidenceCoverage: mean(results.map((r) => r.evidenceCoverage)),
    costPerSafeCompletion: safeCount > 0 ? totalTokens / safeCount : totalTokens,
    latencyPerSafeCompletion: safeCount > 0 ? totalLatency / safeCount : totalLatency,
    // Memory bloat is produced by the write gate (Task 6) and measured by the full
    // bench in Plan 7; replay performs no memory writes, so it is 0 here.
    memoryBloatRate: 0,
  };
}

/** Replay old vs new spec over the seeded cases and build a PromotionReport. */
export function runReplay(input: {
  fromVersion: string;
  toVersion: string;
  oldSpec: WorkflowSpec;
  newSpec: WorkflowSpec;
  cases: BenchmarkCase[];
}): PromotionReport {
  const baseline = computeProcedureMetrics(input.cases.map((c) => runCase(input.oldSpec, c)));
  const candidate = computeProcedureMetrics(input.cases.map((c) => runCase(input.newSpec, c)));
  return {
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    baseline,
    candidate,
    caseCount: input.cases.length,
  };
}
```

`packages/evals/src/index.ts` — replace with:
```ts
export * from "./cases";
export * from "./replay";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @clarityloop/evals test`
Expected: PASS — replay + case assertions green (baseline 0.25 rates, candidate 1.0/0.0, promote decision).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(evals): deterministic replay engine, per-case classification, and ProcedureMetrics"
```

---

## Task 5: `evals` — Qwen failure-analysis + patch proposal (fake provider)

**Files:**
- Create: `packages/evals/src/improve.ts`, `packages/evals/src/improve.test.ts`
- Modify: `packages/evals/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/evals/src/improve.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { ModelProvider } from "@clarityloop/qwen";
import type { BusinessProcedureVersion, ToolName, WorkflowSpec, WorkflowStep } from "@clarityloop/core";
import { proposeWorkflowPatch, improveAndEvaluate, type FailureContext } from "./improve";
import { SEED_CASES } from "./cases";

const fakeProvider = (reply: string): ModelProvider => ({ async complete() { return reply; } });

const toolStep = (id: string, toolName: ToolName): WorkflowStep => ({
  id,
  name: id,
  purpose: `run ${toolName}`,
  action: { type: "tool", toolName, args: {} },
  expectedOutputs: ["out"],
  evidenceProduced: null,
  entropyTarget: "evidenceEntropy",
});

const makeSpec = (version: string, tools: ToolName[]): WorkflowSpec => ({
  id: `spec-${version}`,
  name: "customer-quote",
  goal: "produce a safe quote",
  version,
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote"] },
  steps: [
    {
      id: "s_parse",
      name: "parse",
      purpose: "parse",
      action: { type: "model", promptTemplate: "parse" },
      expectedOutputs: ["facts"],
      evidenceProduced: null,
      entropyTarget: "taskEntropy",
    },
    ...tools.map((t) => toolStep(`s_${t}`, t)),
  ],
  allowedTools: tools.map((toolName) => ({ toolName, defaultArgs: null })),
  evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
  commitPolicy: {
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
  },
  memoryPolicy: {
    writeEnabled: true,
    allowedTypes: ["CustomerPreference"],
    minMemoryValueToWrite: 0.1,
    defaultTtlDays: 180,
    maxEntriesPerScope: 50,
    conflictResolution: "prefer_higher_confidence",
  },
  budgetPolicy: { maxLoopIterations: 8, maxTokens: 20000, maxToolCalls: 12, maxHumanAsks: 2, maxLatencyMs: 60000 },
});

const patchJson = JSON.stringify({
  id: "patch-1",
  rationale: "add evidence-gathering tools before drafting",
  triggerCondition: "inquiry contains 'same as last time' or 'usual price'",
  sourceTraceId: "trace_001",
  expectedEntropyReduction: 0.31,
  ops: [
    { op: "insert_step", afterStepId: "s_parse", step: { id: "s_retrieve_memory", name: "retrieve", purpose: "memory", action: { type: "tool", toolName: "retrieve_memory", args: {} }, expectedOutputs: ["mem"], evidenceProduced: null, entropyTarget: "memoryEntropy" } },
    { op: "insert_step", afterStepId: "s_retrieve_memory", step: { id: "s_lookup_catalog", name: "catalog", purpose: "price", action: { type: "tool", toolName: "lookup_catalog", args: {} }, expectedOutputs: ["price"], evidenceProduced: null, entropyTarget: "evidenceEntropy" } },
    { op: "insert_step", afterStepId: "s_lookup_catalog", step: { id: "s_compare_quote", name: "compare", purpose: "reconcile", action: { type: "tool", toolName: "compare_quote", args: {} }, expectedOutputs: ["deltas"], evidenceProduced: null, entropyTarget: "evidenceEntropy" } },
  ],
});

const failureContext: FailureContext = {
  procedureVersionId: "pv-1",
  domain: "quote",
  traceId: "trace_001",
  failureSummary: "drafted a quote with stale price and assumed SKU",
  finalEntropy: { taskEntropy: 0.5, evidenceEntropy: 0.4, actionEntropy: 0.45, policyEntropy: 0, memoryEntropy: 1, commitEntropy: 0.4 },
  outcomeType: "committed",
  currentSteps: makeSpec("v1", ["draft_quote"]).steps,
};

describe("proposeWorkflowPatch", () => {
  it("parses and validates a fenced-JSON patch from the model", async () => {
    const provider = fakeProvider("```json\n" + patchJson + "\n```");
    const patch = await proposeWorkflowPatch(provider, failureContext);
    expect(patch.ops).toHaveLength(3);
    expect(patch.ops[0].op).toBe("insert_step");
  });

  it("throws on a structurally invalid patch", async () => {
    const provider = fakeProvider('{"id":"x","ops":[]}');
    await expect(proposeWorkflowPatch(provider, failureContext)).rejects.toThrow();
  });
});

describe("improveAndEvaluate", () => {
  it("ties patch -> applyPatch -> replay -> gate into a promote decision", async () => {
    const provider = fakeProvider(patchJson);
    const oldVersion = {
      id: "pv-1",
      parentVersion: null,
      name: "customer-quote",
      goal: "produce a safe quote",
      workflowSpec: makeSpec("v1", ["draft_quote"]),
      allowedTools: [{ toolName: "draft_quote", level: "draft", maxRiskClass: "L1", constraints: null }],
      authorityBoundary: { autoCommitMaxRiskClass: "L1", approvalRequiredFor: [], forbiddenActions: [], allowedTools: [] },
      evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
      riskClass: "L1",
      commitPolicy: makeSpec("v1", ["draft_quote"]).commitPolicy,
      memoryPolicy: makeSpec("v1", ["draft_quote"]).memoryPolicy,
      evalResults: [],
      approvalRecord: null,
      rollbackPointer: null,
      runTraces: [],
      createdAt: "2026-06-16T00:00:00Z",
      promotedAt: null,
    } as unknown as BusinessProcedureVersion;

    const result = await improveAndEvaluate({ provider, oldVersion, failureContext, cases: SEED_CASES });
    expect(result.patch.ops).toHaveLength(3);
    expect(result.newSpec.version).toBe("v2");
    expect(result.decision.type).toBe("promote");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/evals test`
Expected: FAIL — `Cannot find module './improve'`.

- [ ] **Step 3: Implement `improve.ts`**

`packages/evals/src/improve.ts`:
```ts
import { z } from "zod";
import { generateStructured } from "@clarityloop/qwen";
import type { ChatMessage, ModelProvider } from "@clarityloop/qwen";
import {
  applyPatch,
  EntropyScoreSchema,
  runPromotionGate,
  WorkflowPatchSchema,
  WorkflowStepSchema,
  WorkflowDomainSchema,
} from "@clarityloop/core";
import type {
  BusinessProcedureVersion,
  PromotionDecision,
  PromotionReport,
  WorkflowPatch,
  WorkflowSpec,
} from "@clarityloop/core";
import { runReplay } from "./replay";
import type { BenchmarkCase } from "./cases";

/** Compact failure summary handed to Qwen for analysis (built from a failed Trace). */
export const FailureContextSchema = z.object({
  procedureVersionId: z.string(),
  domain: WorkflowDomainSchema,
  traceId: z.string(),
  failureSummary: z.string(),
  finalEntropy: EntropyScoreSchema,
  outcomeType: z.enum(["committed", "needs_approval", "needs_more_info", "rejected", "sandbox_only"]),
  currentSteps: z.array(WorkflowStepSchema),
});
export type FailureContext = z.infer<typeof FailureContextSchema>;

function buildMessages(ctx: FailureContext): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are a workflow-improvement analyst. Given a failed business-workflow run, propose a " +
        "STRUCTURED WorkflowPatch (insert_step / remove_step / replace_step / set_commit_threshold) " +
        "that would reduce future operational uncertainty. Reply with ONLY a JSON object matching the " +
        "WorkflowPatch schema. Do not include scores or promotion decisions — those are computed by code.",
    },
    {
      role: "user",
      content: JSON.stringify({
        domain: ctx.domain,
        failureSummary: ctx.failureSummary,
        finalEntropy: ctx.finalEntropy,
        outcomeType: ctx.outcomeType,
        currentSteps: ctx.currentSteps,
      }),
    },
  ];
}

/** Qwen proposes; zod validates. Returns a structurally-valid WorkflowPatch or throws. */
export async function proposeWorkflowPatch(
  provider: ModelProvider,
  ctx: FailureContext,
): Promise<WorkflowPatch> {
  return generateStructured(provider, WorkflowPatchSchema, {
    task: "failure_analysis",
    messages: buildMessages(ctx),
  });
}

/** Full offline improvement loop: propose -> apply -> replay -> promotion gate. */
export async function improveAndEvaluate(input: {
  provider: ModelProvider;
  oldVersion: BusinessProcedureVersion;
  failureContext: FailureContext;
  cases: BenchmarkCase[];
}): Promise<{
  patch: WorkflowPatch;
  newSpec: WorkflowSpec;
  report: PromotionReport;
  decision: PromotionDecision;
}> {
  const patch = await proposeWorkflowPatch(input.provider, input.failureContext);
  const oldSpec = input.oldVersion.workflowSpec;
  const newSpec = applyPatch(oldSpec, patch);
  const report = runReplay({
    fromVersion: oldSpec.version,
    toVersion: newSpec.version,
    oldSpec,
    newSpec,
    cases: input.cases,
  });
  const decision = runPromotionGate({
    fromVersion: oldSpec.version,
    toVersion: newSpec.version,
    baseline: report.baseline,
    candidate: report.candidate,
    caseCount: report.caseCount,
  });
  return { patch, newSpec, report, decision };
}
```

`packages/evals/src/index.ts` — replace with:
```ts
export * from "./cases";
export * from "./replay";
export * from "./improve";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @clarityloop/evals test`
Expected: PASS — `proposeWorkflowPatch` parses/validates and `improveAndEvaluate` yields a `promote` decision.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(evals): Qwen failure-analysis patch proposal and improveAndEvaluate loop"
```

---

## Task 6: `memory` package — value score + write gate + TTL/conflict

**Files:**
- Create: `packages/memory/package.json`, `packages/memory/tsconfig.json`, `packages/memory/src/index.ts`, `packages/memory/src/value.ts`, `packages/memory/src/value.test.ts`, `packages/memory/src/write-gate.ts`, `packages/memory/src/write-gate.test.ts`

- [ ] **Step 1: Create the package manifests**

`packages/memory/package.json`:
```json
{
  "name": "@clarityloop/memory",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@clarityloop/core": "workspace:*",
    "@clarityloop/storage": "workspace:*",
    "zod": "^3.23.0"
  }
}
```

`packages/memory/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing test for the value score**

`packages/memory/src/value.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreMemoryValue } from "./value";

describe("scoreMemoryValue", () => {
  it("computes the memo §16 value formula deterministically", () => {
    const v = scoreMemoryValue({
      expectedFutureEntropyReduction: 0.5,
      expectedReuseFrequency: 4,
      evidenceConfidence: 0.9,
      retrievalNoiseCost: 0.2,
      stalenessRisk: 0.1,
      storageCost: 0.05,
    });
    // 0.5 * 4 * 0.9 - 0.2 - 0.1 - 0.05 = 1.8 - 0.35 = 1.45
    expect(v).toBeCloseTo(1.45, 5);
  });

  it("can be negative for low-value memories", () => {
    const v = scoreMemoryValue({
      expectedFutureEntropyReduction: 0.01,
      expectedReuseFrequency: 1,
      evidenceConfidence: 0.5,
      retrievalNoiseCost: 0.3,
      stalenessRisk: 0.3,
      storageCost: 0.1,
    });
    expect(v).toBeLessThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/memory test`
Expected: FAIL — `Cannot find module './value'`.

- [ ] **Step 4: Implement `value.ts`**

`packages/memory/src/value.ts`:
```ts
/** Inputs to the memo §16 memory-value score. */
export type MemoryValueInputs = {
  expectedFutureEntropyReduction: number;
  expectedReuseFrequency: number;
  evidenceConfidence: number;
  retrievalNoiseCost: number;
  stalenessRisk: number;
  storageCost: number;
};

/**
 * memory_value =
 *   expected_future_entropy_reduction * expected_reuse_frequency * evidence_confidence
 *   - retrieval_noise_cost - staleness_risk - storage_cost
 */
export function scoreMemoryValue(i: MemoryValueInputs): number {
  return (
    i.expectedFutureEntropyReduction * i.expectedReuseFrequency * i.evidenceConfidence -
    i.retrievalNoiseCost -
    i.stalenessRisk -
    i.storageCost
  );
}
```

`packages/memory/src/index.ts`:
```ts
export * from "./value";
export * from "./write-gate";
```

- [ ] **Step 5: Write the failing test for the write gate**

`packages/memory/src/write-gate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { MemoryPolicy, OperationalMemory } from "@clarityloop/core";
import { InMemoryMemoryRepository } from "@clarityloop/storage";
import { memoryWriteGate, isExpired, commitMemory, type MemoryWriteCandidate } from "./write-gate";

const policy: MemoryPolicy = {
  writeEnabled: true,
  allowedTypes: ["CustomerPreference"],
  minMemoryValueToWrite: 0.5,
  defaultTtlDays: 180,
  maxEntriesPerScope: 50,
  conflictResolution: "prefer_higher_confidence",
};

const pref = (over: Partial<OperationalMemory> = {}): OperationalMemory =>
  ({
    type: "CustomerPreference",
    entity: "Customer ABC",
    fact: "Prefers delivery before Thursday noon",
    id: "mem-1",
    scope: "logistics",
    source: "approved_quote_2026_06_10",
    confidence: 0.86,
    ttlDays: 180,
    createdAt: "2026-06-10T00:00:00Z",
    lastUsedAt: null,
    value: 1.4,
    ...over,
  }) as OperationalMemory;

const candidate = (over: Partial<MemoryWriteCandidate> = {}): MemoryWriteCandidate => ({
  memory: pref(),
  value: 1.4,
  evidenceSupported: true,
  reusable: true,
  ...over,
});

describe("memoryWriteGate", () => {
  it("writes a validated, high-value, reusable memory with no conflict", () => {
    const d = memoryWriteGate(candidate(), policy, []);
    expect(d.type).toBe("write");
  });

  it("rejects a memory unsupported by evidence", () => {
    const d = memoryWriteGate(candidate({ evidenceSupported: false }), policy, []);
    expect(d).toEqual({ type: "reject", reason: "unsupported by evidence" });
  });

  it("rejects one-off trivia that does not change future action selection", () => {
    const d = memoryWriteGate(candidate({ reusable: false }), policy, []);
    expect(d.type).toBe("reject");
  });

  it("rejects a memory below the value threshold", () => {
    const d = memoryWriteGate(candidate({ value: 0.1, memory: pref({ value: 0.1 }) }), policy, []);
    expect(d.type).toBe("reject");
  });

  it("rejects a type the policy does not allow", () => {
    const wf = pref({
      type: "WorkflowFailurePatch",
      trigger: "x",
      patch: "y",
      validatedByReplay: true,
      expectedEntropyReduction: 0.3,
    } as Partial<OperationalMemory>);
    const d = memoryWriteGate(candidate({ memory: wf }), policy, []);
    expect(d.type).toBe("reject");
  });

  it("rejects on conflict under reject_on_conflict policy", () => {
    const d = memoryWriteGate(candidate(), { ...policy, conflictResolution: "reject_on_conflict" }, [pref({ id: "old" })]);
    expect(d.type).toBe("reject");
  });

  it("supersedes a weaker conflicting memory under prefer_higher_confidence", () => {
    const d = memoryWriteGate(
      candidate({ memory: pref({ confidence: 0.95 }) }),
      policy,
      [pref({ id: "old", confidence: 0.6 })],
    );
    expect(d.type).toBe("supersede");
    if (d.type === "supersede") expect(d.replacedId).toBe("old");
  });
});

describe("isExpired", () => {
  it("is true once now exceeds createdAt + ttlDays", () => {
    expect(isExpired(pref({ createdAt: "2026-01-01T00:00:00Z", ttlDays: 30 }), new Date("2026-03-01T00:00:00Z"))).toBe(true);
  });
  it("is false within the TTL window", () => {
    expect(isExpired(pref({ createdAt: "2026-06-01T00:00:00Z", ttlDays: 30 }), new Date("2026-06-10T00:00:00Z"))).toBe(false);
  });
});

describe("commitMemory", () => {
  it("persists a validated memory via the repository", async () => {
    const repo = new InMemoryMemoryRepository();
    const d = await commitMemory(repo, candidate(), policy);
    expect(d.type).toBe("write");
    expect(await repo.get("mem-1")).not.toBeNull();
  });

  it("does not persist a rejected (junk) memory", async () => {
    const repo = new InMemoryMemoryRepository();
    const d = await commitMemory(repo, candidate({ evidenceSupported: false }), policy);
    expect(d.type).toBe("reject");
    expect(await repo.get("mem-1")).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/memory test`
Expected: FAIL — `Cannot find module './write-gate'`.

- [ ] **Step 7: Implement `write-gate.ts`**

`packages/memory/src/write-gate.ts`:
```ts
import type { MemoryPolicy, OperationalMemory } from "@clarityloop/core";
import type { MemoryRepository } from "@clarityloop/storage";

export type MemoryWriteCandidate = {
  memory: OperationalMemory;
  value: number; // scoreMemoryValue() output
  evidenceSupported: boolean; // false => reject (unsupported)
  reusable: boolean; // false => one-off trivia => reject
};

export type MemoryWriteDecision =
  | { type: "write"; memory: OperationalMemory }
  | { type: "reject"; reason: string }
  | { type: "supersede"; memory: OperationalMemory; replacedId: string };

/** A stable conflict key per memory type (scope + the identifying dimension). */
function conflictKey(m: OperationalMemory): string {
  switch (m.type) {
    case "CustomerPreference":
      return `CustomerPreference:${m.scope}:${m.entity}`;
    case "EvidenceSource":
      return `EvidenceSource:${m.scope}:${m.claimCategory}`;
    case "PolicyException":
      return `PolicyException:${m.scope}:${m.rule}`;
    case "VerifierFinding":
      return `VerifierFinding:${m.scope}:${m.verifierName}`;
    case "WorkflowFailurePatch":
      return `WorkflowFailurePatch:${m.scope}:${m.trigger}`;
  }
}

/**
 * Deterministic memory write gate (memo §16). Write iff: writes enabled, type allowed,
 * evidence-supported, reusable, value >= threshold, and no stronger conflict. Pure —
 * the caller supplies the existing same-scope/type memories.
 */
export function memoryWriteGate(
  candidate: MemoryWriteCandidate,
  policy: MemoryPolicy,
  existing: OperationalMemory[],
): MemoryWriteDecision {
  if (!policy.writeEnabled) return { type: "reject", reason: "memory writes disabled by policy" };
  if (!policy.allowedTypes.includes(candidate.memory.type))
    return { type: "reject", reason: `memory type '${candidate.memory.type}' not allowed by policy` };
  if (!candidate.evidenceSupported) return { type: "reject", reason: "unsupported by evidence" };
  if (!candidate.reusable) return { type: "reject", reason: "one-off trivia; does not change future action selection" };
  if (candidate.value < policy.minMemoryValueToWrite)
    return { type: "reject", reason: "memory value below policy threshold" };

  const key = conflictKey(candidate.memory);
  const conflict = existing.find((e) => conflictKey(e) === key && e.id !== candidate.memory.id);
  if (conflict) {
    switch (policy.conflictResolution) {
      case "reject_on_conflict":
        return { type: "reject", reason: "conflicts with an existing memory" };
      case "prefer_higher_confidence":
        return candidate.memory.confidence > conflict.confidence
          ? { type: "supersede", memory: candidate.memory, replacedId: conflict.id }
          : { type: "reject", reason: "weaker than the existing conflicting memory" };
      case "prefer_newer":
        return { type: "supersede", memory: candidate.memory, replacedId: conflict.id };
    }
  }
  return { type: "write", memory: candidate.memory };
}

/** TTL invalidation (memo §16): true once now > createdAt + ttlDays. */
export function isExpired(memory: OperationalMemory, now: Date = new Date()): boolean {
  const created = new Date(memory.createdAt).getTime();
  const ttlMs = memory.ttlDays * 24 * 60 * 60 * 1000;
  return now.getTime() > created + ttlMs;
}

/** Apply the gate against the repository: query conflicts, then write/supersede/skip. */
export async function commitMemory(
  repo: MemoryRepository,
  candidate: MemoryWriteCandidate,
  policy: MemoryPolicy,
): Promise<MemoryWriteDecision> {
  const existing = await repo.query({ scope: candidate.memory.scope, type: candidate.memory.type });
  const decision = memoryWriteGate(candidate, policy, existing);
  if (decision.type === "write") {
    await repo.put(decision.memory);
  } else if (decision.type === "supersede") {
    await repo.invalidate(decision.replacedId);
    await repo.put(decision.memory);
  }
  return decision;
}
```

- [ ] **Step 8: Run tests**

Run: `pnpm --filter @clarityloop/memory test`
Expected: PASS — value (2), write-gate (7), isExpired (2), commitMemory (2) assertions green. (Run `pnpm install` first to link the new package.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(memory): operational-memory value score, write gate, TTL/conflict invalidation"
```

---

## Task 7: `apps/api` — promotion service + improve/promote/lineage routes

**Files:**
- Modify: `apps/api/package.json`, `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `apps/api/src/server.ts`

- [ ] **Step 1: Add the evals dependency**

`apps/api/package.json` — add to `dependencies` (keep existing entries):
```json
    "@clarityloop/evals": "workspace:*",
```
The full `dependencies` block becomes:
```json
  "dependencies": {
    "@clarityloop/core": "workspace:*",
    "@clarityloop/evals": "workspace:*",
    "@clarityloop/qwen": "workspace:*",
    "@clarityloop/storage": "workspace:*",
    "@hono/node-server": "^1.12.0",
    "hono": "^4.5.0"
  },
```

- [ ] **Step 2: Write the failing test for the promotion routes**

`apps/api/src/app.test.ts` — append these imports and a new `describe` block (keep the existing health/score tests):
```ts
import { InMemoryProcedureVersionRepository } from "@clarityloop/storage";
import { SEED_CASES } from "@clarityloop/evals";
import type { BusinessProcedureVersion, ToolName, WorkflowSpec, WorkflowStep } from "@clarityloop/core";

const fakeProviderReplying = (reply: string): ModelProvider => ({ async complete() { return reply; } });

const apiToolStep = (id: string, toolName: ToolName): WorkflowStep => ({
  id,
  name: id,
  purpose: `run ${toolName}`,
  action: { type: "tool", toolName, args: {} },
  expectedOutputs: ["out"],
  evidenceProduced: null,
  entropyTarget: "evidenceEntropy",
});

const apiSpec = (version: string, tools: ToolName[]): WorkflowSpec => ({
  id: `spec-${version}`,
  name: "customer-quote",
  goal: "produce a safe quote",
  version,
  trigger: { domain: "quote", naturalLanguagePatterns: ["quote"] },
  steps: [
    { id: "s_parse", name: "parse", purpose: "parse", action: { type: "model", promptTemplate: "p" }, expectedOutputs: ["facts"], evidenceProduced: null, entropyTarget: "taskEntropy" },
    ...tools.map((t) => apiToolStep(`s_${t}`, t)),
  ],
  allowedTools: tools.map((toolName) => ({ toolName, defaultArgs: null })),
  evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
  commitPolicy: { autoCommitAllowed: true, requireApprovalIf: { quoteValueAbove: null, discountAbovePct: null, evidenceCoverageBelow: null, deliveryUnconfirmed: null, externalSend: null, policyException: null }, forbiddenActions: [], commitEntropyThreshold: 0.3 },
  memoryPolicy: { writeEnabled: true, allowedTypes: ["CustomerPreference"], minMemoryValueToWrite: 0.1, defaultTtlDays: 180, maxEntriesPerScope: 50, conflictResolution: "prefer_higher_confidence" },
  budgetPolicy: { maxLoopIterations: 8, maxTokens: 20000, maxToolCalls: 12, maxHumanAsks: 2, maxLatencyMs: 60000 },
});

const apiVersion = (id: string, version: string): BusinessProcedureVersion =>
  ({
    id,
    parentVersion: null,
    name: "customer-quote",
    goal: "produce a safe quote",
    workflowSpec: apiSpec(version, ["draft_quote"]),
    allowedTools: [{ toolName: "draft_quote", level: "draft", maxRiskClass: "L1", constraints: null }],
    authorityBoundary: { autoCommitMaxRiskClass: "L1", approvalRequiredFor: [], forbiddenActions: [], allowedTools: [] },
    evidencePolicy: { requiredForClaims: {}, minimumCoverageForCommit: 0.8 },
    riskClass: "L1",
    commitPolicy: apiSpec(version, ["draft_quote"]).commitPolicy,
    memoryPolicy: apiSpec(version, ["draft_quote"]).memoryPolicy,
    evalResults: [],
    approvalRecord: null,
    rollbackPointer: null,
    runTraces: [],
    createdAt: "2026-06-16T00:00:00Z",
    promotedAt: null,
  }) as unknown as BusinessProcedureVersion;

const apiPatchJson = JSON.stringify({
  id: "patch-1",
  rationale: "add evidence tools",
  triggerCondition: "same as last time",
  sourceTraceId: "trace_001",
  expectedEntropyReduction: 0.31,
  ops: [
    { op: "insert_step", afterStepId: "s_parse", step: { id: "s_retrieve_memory", name: "retrieve", purpose: "m", action: { type: "tool", toolName: "retrieve_memory", args: {} }, expectedOutputs: ["mem"], evidenceProduced: null, entropyTarget: "memoryEntropy" } },
    { op: "insert_step", afterStepId: "s_retrieve_memory", step: { id: "s_lookup_catalog", name: "catalog", purpose: "p", action: { type: "tool", toolName: "lookup_catalog", args: {} }, expectedOutputs: ["price"], evidenceProduced: null, entropyTarget: "evidenceEntropy" } },
    { op: "insert_step", afterStepId: "s_lookup_catalog", step: { id: "s_compare_quote", name: "compare", purpose: "r", action: { type: "tool", toolName: "compare_quote", args: {} }, expectedOutputs: ["deltas"], evidenceProduced: null, entropyTarget: "evidenceEntropy" } },
  ],
});

const failureCtxBody = {
  procedureVersionId: "pv-1",
  domain: "quote",
  traceId: "trace_001",
  failureSummary: "stale price, assumed SKU",
  finalEntropy: { taskEntropy: 0.5, evidenceEntropy: 0.4, actionEntropy: 0.45, policyEntropy: 0, memoryEntropy: 1, commitEntropy: 0.4 },
  outcomeType: "committed",
  currentSteps: apiSpec("v1", ["draft_quote"]).steps,
};

describe("promotion routes", () => {
  it("POST /procedures/:id/improve returns a validated patch", async () => {
    const procedureRepo = new InMemoryProcedureVersionRepository();
    await procedureRepo.put(apiVersion("pv-1", "v1"));
    const app = createApp({ provider: fakeProviderReplying(apiPatchJson), procedureRepo, replayCases: SEED_CASES });
    const res = await app.request("/procedures/pv-1/improve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failureContext: failureCtxBody }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.patch.ops).toHaveLength(3);
  });

  it("POST /procedures/:id/promote replays, gates, and persists a child version", async () => {
    const procedureRepo = new InMemoryProcedureVersionRepository();
    await procedureRepo.put(apiVersion("pv-1", "v1"));
    const app = createApp({ provider: fakeProviderReplying(apiPatchJson), procedureRepo, replayCases: SEED_CASES });

    const improve = await app.request("/procedures/pv-1/improve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ failureContext: failureCtxBody }),
    });
    const { patch } = await improve.json();

    const res = await app.request("/procedures/pv-1/promote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ patch }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.type).toBe("promote");
    expect(body.newVersionId).toBeTruthy();

    const versions = await procedureRepo.listVersions("customer-quote");
    expect(versions).toHaveLength(2);
    const child = versions.find((v) => v.id === body.newVersionId)!;
    expect(child.parentVersion).toBe("pv-1");
    expect(child.promotedAt).not.toBeNull();
  });

  it("GET /procedures/:name/versions returns the lineage", async () => {
    const procedureRepo = new InMemoryProcedureVersionRepository();
    await procedureRepo.put(apiVersion("pv-1", "v1"));
    const app = createApp({ provider: fakeProviderReplying(apiPatchJson), procedureRepo, replayCases: SEED_CASES });
    const res = await app.request("/procedures/customer-quote/versions");
    expect(res.status).toBe(200);
    expect((await res.json()).versions).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/api test`
Expected: FAIL — `createApp` does not accept `procedureRepo`/`replayCases` and the promotion routes 404.

- [ ] **Step 4: Implement the routes**

`apps/api/src/app.ts` (full replacement — preserves health/score/qwen, adds promotion deps + routes):
```ts
import { Hono } from "hono";
import {
  applyPatch,
  LatentWorkflowStateSchema,
  runPromotionGate,
  scoreEntropy,
  type BusinessProcedureVersion,
  type ProcedureMetrics,
} from "@clarityloop/core";
import {
  FailureContextSchema,
  proposeWorkflowPatch,
  runReplay,
  WorkflowPatchSchema,
  type BenchmarkCase,
} from "@clarityloop/evals";
import type { ModelProvider } from "@clarityloop/qwen";
import type { ProcedureVersionRepository, TraceRepository } from "@clarityloop/storage";
import { z } from "zod";

export type AppDeps = {
  provider: ModelProvider;
  procedureRepo?: ProcedureVersionRepository;
  traceRepo?: TraceRepository;
  replayCases?: BenchmarkCase[];
};

function metricsToEvalResults(m: ProcedureMetrics): { caseId: string; metric: string; value: number }[] {
  return Object.entries(m).map(([metric, value]) => ({ caseId: "replay", metric, value: value as number }));
}

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/score", async (c) => {
    const parsed = LatentWorkflowStateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(scoreEntropy(parsed.data));
  });

  app.get("/qwen/ping", async (c) => {
    const reply = await deps.provider.complete(
      [{ role: "user", content: "reply with the single word ok" }],
      { task: "extraction" },
    );
    return c.json({ reply });
  });

  // ---- Improvement + promotion (Phase 6) ----
  const { procedureRepo, replayCases } = deps;
  if (procedureRepo) {
    app.post("/procedures/:id/improve", async (c) => {
      const version = await procedureRepo.get(c.req.param("id"));
      if (!version) return c.json({ error: "procedure version not found" }, 404);
      const body = await c.req.json();
      const ctx = FailureContextSchema.safeParse(body.failureContext);
      if (!ctx.success) return c.json({ error: ctx.error.flatten() }, 400);
      const patch = await proposeWorkflowPatch(deps.provider, ctx.data);
      return c.json({ patch });
    });

    app.post("/procedures/:id/promote", async (c) => {
      const old = await procedureRepo.get(c.req.param("id"));
      if (!old) return c.json({ error: "procedure version not found" }, 404);
      const body = await c.req.json();
      const patch = WorkflowPatchSchema.safeParse(body.patch);
      if (!patch.success) return c.json({ error: patch.error.flatten() }, 400);
      const cases = replayCases ?? [];

      const oldSpec = old.workflowSpec;
      const newSpec = applyPatch(oldSpec, patch.data);
      const report = runReplay({
        fromVersion: oldSpec.version,
        toVersion: newSpec.version,
        oldSpec,
        newSpec,
        cases,
      });
      const decision = runPromotionGate({
        fromVersion: oldSpec.version,
        toVersion: newSpec.version,
        baseline: report.baseline,
        candidate: report.candidate,
        caseCount: report.caseCount,
      });

      if (decision.type !== "promote") {
        return c.json({ decision, report, newVersionId: null });
      }

      const now = new Date().toISOString();
      const child: BusinessProcedureVersion = {
        ...old,
        id: `${old.id}-${newSpec.version}`,
        parentVersion: old.id,
        workflowSpec: newSpec,
        commitPolicy: newSpec.commitPolicy,
        evalResults: metricsToEvalResults(report.candidate),
        approvalRecord: null,
        rollbackPointer: old.id,
        runTraces: [],
        createdAt: now,
        promotedAt: now,
      };
      await procedureRepo.put(child);
      return c.json({ decision, report, newVersionId: child.id });
    });

    app.get("/procedures/:name/versions", async (c) => {
      const versions = await procedureRepo.listVersions(c.req.param("name"));
      return c.json({ versions });
    });

    app.get("/procedures/by-id/:id", async (c) => {
      const version = await procedureRepo.get(c.req.param("id"));
      if (!version) return c.json({ error: "procedure version not found" }, 404);
      return c.json({ version });
    });
  }

  return app;
}

// Keep `z` referenced for downstream typing parity (no-op guard).
void z;
```

> Note: the trailing `void z;` keeps the `zod` import meaningful if a future inline schema is added; remove it if your linter forbids it and you do not add inline schemas. If preferred, drop the `import { z }` line entirely — it is not otherwise required by these routes.

`apps/api/src/server.ts` (full replacement — wires the repos + cases for the deployed build):
```ts
import { serve } from "@hono/node-server";
import { DashScopeProvider } from "@clarityloop/qwen";
import { InMemoryProcedureVersionRepository, InMemoryTraceRepository } from "@clarityloop/storage";
import { SEED_CASES } from "@clarityloop/evals";
import { createApp } from "./app";

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) throw new Error("DASHSCOPE_API_KEY is required");

// NOTE: in-memory repositories are used until the Pg* repositories (Plan 2) are wired
// via DATABASE_URL. Swapping is a one-line change behind the repository interface.
const app = createApp({
  provider: new DashScopeProvider({ apiKey, baseURL: process.env.DASHSCOPE_BASE_URL }),
  procedureRepo: new InMemoryProcedureVersionRepository(),
  traceRepo: new InMemoryTraceRepository(),
  replayCases: SEED_CASES,
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => console.log(`clarityloop api on :${port}`));
```

> If Plan 2 named the in-memory trace repository differently, adjust the `InMemoryTraceRepository` import to match; it is only used for future trace-derived failure contexts and is otherwise inert here.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @clarityloop/api test`
Expected: PASS — existing health/score/qwen tests plus the 3 promotion-route tests (improve returns patch, promote persists child with `parentVersion`/`promotedAt`, lineage returns 1). Run `pnpm install` first to link `@clarityloop/evals` into `apps/api`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): improve/promote/version-lineage routes composing evals replay + promotion gate"
```

---

## Task 8: `apps/web` — replay-benchmark + version-lineage UI panels

**Files:**
- Create: `apps/web/src/lib/promotion-view.ts`, `apps/web/src/lib/promotion-view.test.ts`, `apps/web/src/components/ReplayBenchmarkPanel.tsx`, `apps/web/src/components/VersionLineagePanel.tsx`, `apps/web/src/api/procedures.ts`

- [ ] **Step 1: Write the failing test for the pure presenters**

`apps/web/src/lib/promotion-view.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toReplayRows, toLineageRows } from "./promotion-view";
import type { BusinessProcedureVersion, PromotionReport } from "@clarityloop/core";

const report: PromotionReport = {
  fromVersion: "v1",
  toVersion: "v2",
  caseCount: 4,
  baseline: {
    safeCompletionRate: 0.25,
    falseCommitRate: 0.25,
    policyViolationRate: 0,
    approvalBurden: 0.25,
    evidenceCoverage: 0.9,
    costPerSafeCompletion: 800,
    latencyPerSafeCompletion: 400,
    memoryBloatRate: 0,
  },
  candidate: {
    safeCompletionRate: 1,
    falseCommitRate: 0,
    policyViolationRate: 0,
    approvalBurden: 0,
    evidenceCoverage: 1,
    costPerSafeCompletion: 500,
    latencyPerSafeCompletion: 250,
    memoryBloatRate: 0,
  },
};

describe("toReplayRows", () => {
  it("produces one row per metric with baseline, candidate, and signed delta", () => {
    const rows = toReplayRows(report);
    const safe = rows.find((r) => r.metric === "safeCompletionRate")!;
    expect(safe.baseline).toBe(0.25);
    expect(safe.candidate).toBe(1);
    expect(safe.delta).toBeCloseTo(0.75, 5);
    // higher-is-better metric improving -> "better"
    expect(safe.direction).toBe("better");
    const fc = rows.find((r) => r.metric === "falseCommitRate")!;
    // lower-is-better metric decreasing -> "better"
    expect(fc.direction).toBe("better");
  });
});

describe("toLineageRows", () => {
  it("orders versions parent-first and marks the promoted head", () => {
    const v1 = { id: "pv-1", parentVersion: null, name: "customer-quote", workflowSpec: { version: "v1" }, promotedAt: null, createdAt: "2026-06-16T00:00:00Z" } as unknown as BusinessProcedureVersion;
    const v2 = { id: "pv-1-v2", parentVersion: "pv-1", name: "customer-quote", workflowSpec: { version: "v2" }, promotedAt: "2026-06-17T00:00:00Z", createdAt: "2026-06-17T00:00:00Z" } as unknown as BusinessProcedureVersion;
    const rows = toLineageRows([v2, v1]);
    expect(rows.map((r) => r.id)).toEqual(["pv-1", "pv-1-v2"]);
    expect(rows[0].depth).toBe(0);
    expect(rows[1].depth).toBe(1);
    expect(rows[1].promoted).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/web test`
Expected: FAIL — `Cannot find module './promotion-view'`. (If Plan 3 named the web package differently, substitute its `name` from `apps/web/package.json`.)

- [ ] **Step 3: Implement the pure presenters**

`apps/web/src/lib/promotion-view.ts`:
```ts
import type { BusinessProcedureVersion, ProcedureMetrics, PromotionReport } from "@clarityloop/core";

export type ReplayRow = {
  metric: keyof ProcedureMetrics;
  label: string;
  baseline: number;
  candidate: number;
  delta: number;
  direction: "better" | "worse" | "same";
};

// true => higher is better; false => lower is better.
const HIGHER_IS_BETTER: Record<keyof ProcedureMetrics, boolean> = {
  safeCompletionRate: true,
  falseCommitRate: false,
  policyViolationRate: false,
  approvalBurden: false,
  evidenceCoverage: true,
  costPerSafeCompletion: false,
  latencyPerSafeCompletion: false,
  memoryBloatRate: false,
};

const LABELS: Record<keyof ProcedureMetrics, string> = {
  safeCompletionRate: "Safe completion",
  falseCommitRate: "False commit",
  policyViolationRate: "Policy violation",
  approvalBurden: "Approval burden",
  evidenceCoverage: "Evidence coverage",
  costPerSafeCompletion: "Cost / safe completion",
  latencyPerSafeCompletion: "Latency / safe completion",
  memoryBloatRate: "Memory bloat",
};

const EPS = 1e-9;

export function toReplayRows(report: PromotionReport): ReplayRow[] {
  return (Object.keys(HIGHER_IS_BETTER) as (keyof ProcedureMetrics)[]).map((metric) => {
    const baseline = report.baseline[metric];
    const candidate = report.candidate[metric];
    const delta = candidate - baseline;
    let direction: ReplayRow["direction"] = "same";
    if (Math.abs(delta) > EPS) {
      const improved = HIGHER_IS_BETTER[metric] ? delta > 0 : delta < 0;
      direction = improved ? "better" : "worse";
    }
    return { metric, label: LABELS[metric], baseline, candidate, delta, direction };
  });
}

export type LineageRow = {
  id: string;
  version: string;
  parentVersion: string | null;
  depth: number;
  promoted: boolean;
  createdAt: string;
};

/** Order a set of procedure versions parent-first into a lineage with depth. */
export function toLineageRows(versions: BusinessProcedureVersion[]): LineageRow[] {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const depthOf = (v: BusinessProcedureVersion): number => {
    let d = 0;
    let cur: BusinessProcedureVersion | undefined = v;
    while (cur && cur.parentVersion && byId.has(cur.parentVersion)) {
      d += 1;
      cur = byId.get(cur.parentVersion);
    }
    return d;
  };
  return [...versions]
    .map((v) => ({
      id: v.id,
      version: v.workflowSpec.version,
      parentVersion: v.parentVersion,
      depth: depthOf(v),
      promoted: v.promotedAt !== null,
      createdAt: v.createdAt,
    }))
    .sort((a, b) => a.depth - b.depth || a.createdAt.localeCompare(b.createdAt));
}
```

- [ ] **Step 4: Run the presenter test**

Run: `pnpm --filter @clarityloop/web test`
Expected: PASS — `toReplayRows` and `toLineageRows` assertions green.

- [ ] **Step 5: Add the React panels + fetch helpers (rendering verified in the dev server)**

`apps/web/src/api/procedures.ts`:
```ts
import type { BusinessProcedureVersion, PromotionDecision, PromotionReport, WorkflowPatch } from "@clarityloop/core";

const BASE = import.meta.env.VITE_API_BASE ?? "";

export async function fetchVersions(name: string): Promise<BusinessProcedureVersion[]> {
  const res = await fetch(`${BASE}/procedures/${encodeURIComponent(name)}/versions`);
  if (!res.ok) throw new Error(`fetchVersions failed: ${res.status}`);
  return (await res.json()).versions as BusinessProcedureVersion[];
}

export async function promote(
  versionId: string,
  patch: WorkflowPatch,
): Promise<{ decision: PromotionDecision; report: PromotionReport; newVersionId: string | null }> {
  const res = await fetch(`${BASE}/procedures/${encodeURIComponent(versionId)}/promote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ patch }),
  });
  if (!res.ok) throw new Error(`promote failed: ${res.status}`);
  return res.json();
}
```

`apps/web/src/components/ReplayBenchmarkPanel.tsx`:
```tsx
import type { PromotionDecision, PromotionReport } from "@clarityloop/core";
import { toReplayRows } from "../lib/promotion-view";

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const tone = (d: "better" | "worse" | "same"): string =>
  d === "better" ? "text-emerald-600" : d === "worse" ? "text-rose-600" : "text-slate-500";

export function ReplayBenchmarkPanel(props: { report: PromotionReport; decision: PromotionDecision }) {
  const rows = toReplayRows(props.report);
  const { report, decision } = props;
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">Replay benchmark</h2>
        <span className="text-sm text-slate-500">
          {report.fromVersion} → {report.toVersion} · {report.caseCount} cases
        </span>
      </header>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1">Metric</th>
            <th className="py-1 text-right">Baseline</th>
            <th className="py-1 text-right">Candidate</th>
            <th className="py-1 text-right">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric} className="border-t border-slate-100">
              <td className="py-1">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{fmt(r.baseline)}</td>
              <td className="py-1 text-right tabular-nums">{fmt(r.candidate)}</td>
              <td className={`py-1 text-right tabular-nums ${tone(r.direction)}`}>
                {r.delta >= 0 ? "+" : ""}
                {fmt(r.delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-3 text-sm">
        <span className="font-medium">Decision: </span>
        <span
          className={
            decision.type === "promote"
              ? "text-emerald-600"
              : decision.type === "reject"
                ? "text-rose-600"
                : "text-amber-600"
          }
        >
          {decision.type}
        </span>
      </footer>
    </section>
  );
}
```

`apps/web/src/components/VersionLineagePanel.tsx`:
```tsx
import type { BusinessProcedureVersion } from "@clarityloop/core";
import { toLineageRows } from "../lib/promotion-view";

export function VersionLineagePanel(props: { versions: BusinessProcedureVersion[] }) {
  const rows = toLineageRows(props.versions);
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h2 className="mb-3 text-base font-semibold">Procedure version history</h2>
      <ol className="space-y-1 text-sm">
        {rows.map((r) => (
          <li key={r.id} style={{ paddingLeft: `${r.depth * 16}px` }} className="flex items-center gap-2">
            <span className="font-mono">{r.version}</span>
            {r.promoted && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">promoted</span>
            )}
            <span className="text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
```

> **Human-gated / deferred:** mounting these panels into the Plan 3 dashboard layout and confirming the live render against the running API is a visual check performed in the Vite dev server (`pnpm --filter @clarityloop/web dev`). The deterministic logic (`toReplayRows`, `toLineageRows`) is fully unit-tested above; the JSX is a thin, side-effect-free projection of those rows.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter @clarityloop/web test && pnpm --filter @clarityloop/web typecheck`
Expected: PASS — presenter tests green and the panels typecheck against `@clarityloop/core` types.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): replay-benchmark and version-lineage panels with unit-tested presenters"
```

---

## Task 9: Docs — README, shared-contracts back-port, subsystem technical doc

**Files:**
- Create: `docs/technical/improvement-promotion.md`
- Modify: `README.md`, `docs/superpowers/specs/2026-06-16-shared-contracts.md`

- [ ] **Step 1: Write the subsystem technical doc**

`docs/technical/improvement-promotion.md`:
```markdown
# Improvement + Promotion subsystem (Phase 6)

## Flow
failed/seed trace → `proposeWorkflowPatch` (Qwen, `@clarityloop/evals`) → `WorkflowPatchSchema`
validation (`@clarityloop/core`) → `applyPatch` (deterministic, new spec, bumped version) →
`runReplay` (deterministic, `@clarityloop/evals`) over `SEED_CASES` → `ProcedureMetrics`
(baseline vs candidate) → `runPromotionGate` (deterministic, `@clarityloop/core`, memo §19) →
`PromotionDecision` (`promote` | `reject` + `RegressionReport` | `needs_human_review`) →
on promote, a child `BusinessProcedureVersion` is persisted via `ProcedureVersionRepository`
(`parentVersion`, `rollbackPointer`, `promotedAt`, candidate metrics in `evalResults`).

## Determinism contract
Qwen only emits the `WorkflowPatch` structure. Every score, metric, and decision is computed by
deterministic TypeScript. Replay reuses `scoreEntropy` (the loop kernel) over each case's seeded
latent state; a gap is "resolved" iff the spec under replay has the declared tool capability.

## Operational memory write path (`@clarityloop/memory`)
`scoreMemoryValue` (memo §16 formula) → `memoryWriteGate` rejects writes that are unsupported,
one-off, below the value threshold, of a disallowed type, or in conflict with a stronger memory;
`isExpired` drives TTL invalidation; `commitMemory` applies the gate against `MemoryRepository`.

## Packages
- `@clarityloop/core`: `WorkflowPatch`/`applyPatch`, promotion types, `runPromotionGate`.
- `@clarityloop/evals`: `BenchmarkCase`/`SEED_CASES`, replay engine, `proposeWorkflowPatch`,
  `improveAndEvaluate`.
- `@clarityloop/memory`: `scoreMemoryValue`, `memoryWriteGate`, `isExpired`, `commitMemory`.
- `apps/api`: `/procedures/:id/improve`, `/procedures/:id/promote`, `/procedures/:name/versions`.
- `apps/web`: `ReplayBenchmarkPanel`, `VersionLineagePanel`.

## Tests
All deterministic, fake `ModelProvider`, in-memory repositories — no live API. Replay metrics are
reproducible; the promotion gate promotes on improvement and rejects on regression; the memory
write gate accepts validated memories and rejects junk.
```

- [ ] **Step 2: Update the README**

Add a `## Improvement + Promotion (Phase 6)` section to `README.md` summarizing the flow above, the three new/extended packages (`@clarityloop/evals`, `@clarityloop/memory`, and the `core` gate), and the new API routes. Link to `docs/technical/improvement-promotion.md`. (Keep the existing README content; append the section.)

- [ ] **Step 3: Back-port the contract additions**

In `docs/superpowers/specs/2026-06-16-shared-contracts.md`:
- Under §4 (Workflow definition), add the `WorkflowPatchOpSchema`/`WorkflowPatchSchema` block and `applyPatch` signature (verbatim from Task 1), tagged `core / Plan 6`.
- Under §9, add a one-line note that `runPromotionGate` is implemented in `@clarityloop/core` (not `evals`) per design spec §4, with the replay engine remaining in `@clarityloop/evals`.
- Update the §15 matrix row for `runPromotionGate` to read `core` and add a `WorkflowPatch`/`applyPatch` row (`core / Plan 6`).

- [ ] **Step 4: Verify the whole workspace builds and tests green**

Run: `pnpm install && pnpm test`
Expected: PASS — turbo runs all package test suites (`core`, `qwen`, `storage`, `evals`, `memory`, `api`, `web`) with zero failures.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: improvement/promotion technical doc, README section, shared-contracts back-port"
```

---

## Self-Review

**Spec coverage (Plan 6 = design spec §12 Phase 6, §5 improvement loop, memo §16/§19; scope items a–e):**
- (a) Qwen failure-analysis + workflow-PATCH proposal (`generateStructured`, validated patch schema) → Task 1 (`WorkflowPatch`/`applyPatch`) + Task 5 (`proposeWorkflowPatch`, fake provider) ✓
- (b) Deterministic ReplayBenchmark engine (old vs new over seeded cases; `false_commit_rate`, `safe_completion_rate`, `approval_burden`) → Task 3 (seed cases) + Task 4 (`runReplay`, `computeProcedureMetrics`) ✓
- (c) Deterministic PromotionGate in `@clarityloop/core` → `PromotionDecision` (`promote` | `reject` w/ `regressionReport` | `needs_human_review`) → Task 2 (`runPromotionGate`, memo §19) ✓
- (d) Operational memory store (`@clarityloop/memory`): value score + TTL/conflict + write gate (reject unsupported/one-off/conflicting) → Task 6 (`scoreMemoryValue`, `memoryWriteGate`, `isExpired`, `commitMemory`) ✓
- (e) Procedure version-history persistence + UI panel (old-vs-new replay metrics + version lineage) → Task 7 (`/promote` persists child with `parentVersion`/`promotedAt`; `/versions` lineage) + Task 8 (`ReplayBenchmarkPanel`, `VersionLineagePanel`) ✓
- Required tests: replay deterministic on seeded cases (Task 4: reproducibility + exact rates) ✓; PromotionGate improvement-promotes / regression-rejects (Task 2) ✓; memory write-gate accepts validated / rejects junk (Task 6) ✓

**Fake-provider / no-live-API discipline:** every Qwen-touching test (Task 5 `proposeWorkflowPatch`/`improveAndEvaluate`, Task 7 `/improve`+`/promote`) uses a fake `ModelProvider`. Replay and the promotion gate make no model calls at all (deterministic by design). No step requires a live DashScope key. Human-gated/deferred: visual render of the Task-8 panels in the Vite dev server, and the deployed-build swap from in-memory to `Pg*` repositories (Plan 2 seam).

**Placeholder scan:** no `TODO`/`TBD`/"similar to above"; every code block is complete; every step has an exact `pnpm --filter …` command with expected output.

**Type-consistency note:** `WorkflowSpec`/`WorkflowStep`/`CommitPolicy`/`MemoryPolicy`/`BudgetPolicy`/`ToolName`/`WorkflowDomain`/`EntropyScore`/`BusinessProcedureVersion`/`OperationalMemory`/`MemoryPolicy` are imported from `@clarityloop/core`; `MemoryRepository`/`InMemoryMemoryRepository`/`ProcedureVersionRepository`/`InMemoryProcedureVersionRepository` from `@clarityloop/storage`; `ModelProvider`/`generateStructured` from `@clarityloop/qwen`. Promotion types (`ProcedureMetrics`, `PromotionReport`, `RegressionReport`, `PromotionDecision`, `EvaluationResult`) and `PromotionGateInput`/`runPromotionGate` match shared-contracts §9 signatures verbatim. `scoreMemoryValue`/`MemoryValueInputs` match §10 verbatim. The fixtures for `WorkflowSpec`/`BusinessProcedureVersion` are reused identically across Tasks 4, 5, 7. The one deliberate placement deviation (`runPromotionGate` in `core` not `evals`) and the one contract addition (`WorkflowPatch`/`applyPatch`) are logged at the top and back-ported in Task 9.

**Determinism kernel:** replay reuses `scoreEntropy` and a commit-gate-lite (`decideOutcome`) so the promotion signal is reproducible; identical inputs yield identical `PromotionReport` (asserted in Task 4).

---

## What later plans depend on this one

- **Plan 7 (ClarityLoopBench + demo polish):** extends `@clarityloop/evals` with the full 30–50-case set and the four baselines (Bare Qwen / Dynamic Qwen / Fixed Gate / ClarityLoop), reusing `computeProcedureMetrics`, `runCase`, and `BenchmarkCaseSchema` from Task 3/4. The `memoryBloatRate` metric (held at 0 in replay) is populated from the Task-6 write-gate statistics. The three-column demo (Baseline | ClarityLoop | Promotion benchmark) consumes the Task-8 `ReplayBenchmarkPanel` + `VersionLineagePanel`. The 3-minute video's "self-improvement → replay promotion" beats (memo §21, 2:00–2:50) are driven directly by the Task-5 `improveAndEvaluate` → Task-7 `/promote` flow.
- **Deployed build:** Task 7's `server.ts` wiring is the swap point from `InMemory*Repository` to the Plan 2 `Pg*Repository` behind `DATABASE_URL`; no route code changes.
