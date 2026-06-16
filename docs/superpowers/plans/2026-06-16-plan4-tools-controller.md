# Tools + Next-Best-Action Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entropy-reducing action loop — the six fixture-backed tools behind a uniform `Tool` interface (`@clarityloop/tools`), the deterministic next-best-action scorer (`scoreAction` / `selectNextBestAction` in `@clarityloop/core`), and the loop controller in `apps/api` that runs a tool, folds the result into the latent state, re-scores entropy, emits an SSE frame, and repeats until a deterministic stop condition fires. This is design spec §12 Phase 4 and §7.

**Architecture:** Qwen *proposes* candidate actions (structure only — a `ProposedAction[]`, no scores); deterministic TypeScript estimates each candidate's cost/value, computes `score = expectedEntropyReduction + expectedRiskReduction − tokenCost − latencyCost − humanBurdenCost − toolCost`, and picks the argmax. The chosen tool runs, returns `EvidenceRef[]` + a typed result, the controller folds that into `LatentWorkflowState`, and `scoreEntropy` re-scores. **The model never emits a number that gates anything.** Tools are fixture-backed and deterministic; the one Qwen-backed tool (`parse_supplier_quote`) calls `generateStructured` and is driven by a **fake `ModelProvider`** in tests. The controller is an async generator that yields the existing `EntropyUpdate` SSE frame (Plan 3 contract), plugging into Plan 3's "Plan 4 extension point" without changing the heatmap contract.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Vitest, Zod. New package `@clarityloop/tools` (depends on `@clarityloop/core`, `@clarityloop/qwen`, `@clarityloop/storage`). Controller in `apps/api` (Hono + `hono/streaming`, already wired in Plan 3). All tests use a **fake `ModelProvider`** and **in-memory** stores/repositories — no live DashScope, no network, no DB.

---

## Dependencies — what Plans 1–3 already provide (import, do NOT re-create)

This plan executes **after** Plans 1, 2, and 3. It imports the following verbatim:

From **`@clarityloop/core`** (Plan 1 + Plan 2 + Plan 3):
- Plan 1: `LatentWorkflowStateSchema`, `LatentWorkflowState`, `Fact`, `MissingField`, `Claim`, `EntropyScore`, `scoreEntropy`.
- Plan 2 `primitives.ts`: `EvidenceRefSchema`/`EvidenceRef`, `ToolNameSchema`/`ToolName`, `VerifierNameSchema`/`VerifierName`, `RiskClassSchema`/`RiskClass`, `ClaimCategorySchema`/`ClaimCategory`, `OperationalMemoryTypeSchema`/`OperationalMemoryType`.
- Plan 2 `workflow.ts`: `ToolPermissionLevel`, `CommitPolicy` (with `commitEntropyThreshold`), `BudgetPolicy`.
- Plan 2 `actions.ts`: `ActionTypeSchema`/`ActionType`, `ProposedActionSchema`/`ProposedAction`, `CandidateActionSchema`/`CandidateAction` (**schemas/types only — the scoring functions are this plan's job**).
- Plan 3 `stream.ts`: `EntropyUpdateSchema`/`EntropyUpdate` (the SSE frame), `EntropyScoreSchema`.

From **`@clarityloop/qwen`** (Plan 1): `ModelProvider`, `ChatMessage`, `generateStructured`.

From **`@clarityloop/storage`** (Plan 1 + Plan 2): `ArtifactStore`, `InMemoryArtifactStore`. Plan 2 already added `@clarityloop/core` + `zod` to the storage `package.json` and created `repository.ts` / `in-memory-repository.ts` (run/trace/procedure repos) — this plan adds the **memory** repository next to them.

From **`apps/api`** (Plan 3): `apps/api/src/latent/loop.ts` exposes `runLatentLoop(provider, input)` (an async generator yielding `EntropyUpdate`) with a comment marking the **"Plan 4 extension point"**. This plan adds the real tool loop in a new `apps/api/src/loop/` module and documents the one-line SSE-route swap.

**Ownership note (matches `docs/superpowers/specs/2026-06-16-shared-contracts.md` §15):** Plan 2 introduced the action *schemas* and `OperationalMemoryTypeSchema` (the enum). Plan 4 introduces the scoring *functions* (`scoreAction`, `selectNextBestAction`, `estimateActionCosts`, `toCandidateAction`), the full `OperationalMemory` *union*, `MemoryRepository` + `InMemoryMemoryRepository`, the `Tool`/`ToolResult` interface + the six tools, and the loop controller. None of Plan 2's/Plan 3's files are rewritten except `index.ts` export-line additions and the documented optional `loop.ts` swap.

---

## File Structure

**Create (core — scoring functions + memory union):**
- `packages/core/src/action-score.ts`, `packages/core/src/action-score.test.ts`
- `packages/core/src/memory.ts`, `packages/core/src/memory.test.ts`

**Modify:**
- `packages/core/src/index.ts` (add two `export *` lines)

**Create (storage — memory repository):**
- `packages/storage/src/memory-repository.ts`, `packages/storage/src/memory-repository.test.ts`

**Modify:**
- `packages/storage/src/index.ts` (add one `export *` line)

**Create (new package `@clarityloop/tools`):**
- `packages/tools/package.json`, `packages/tools/tsconfig.json`
- `packages/tools/src/tool.ts` (Tool + ToolResult interface — verbatim shared-contracts §11)
- `packages/tools/src/fixtures.ts` (seeded catalog, stock, memories)
- `packages/tools/src/retrieve-memory.ts` + `.test.ts`
- `packages/tools/src/lookup-catalog.ts` + `.test.ts`
- `packages/tools/src/check-stock.ts` + `.test.ts`
- `packages/tools/src/parse-supplier-quote.ts` + `.test.ts`
- `packages/tools/src/compare-quote.ts` + `.test.ts`
- `packages/tools/src/draft-quote.ts` + `.test.ts`
- `packages/tools/src/registry.ts` + `.test.ts`
- `packages/tools/src/index.ts`

**Create (apps/api — loop controller):**
- `apps/api/src/loop/controller.ts`, `apps/api/src/loop/controller.test.ts`

**Modify:**
- `apps/api/package.json` (add `@clarityloop/tools` dep)
- `docs/` + `README.md` (Task 13)

---

## Task 1: Core — next-best-action scorer (design spec §7 / shared-contracts §6)

**Files:**
- Create: `packages/core/src/action-score.ts`, `packages/core/src/action-score.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test for the scorer**

`packages/core/src/action-score.test.ts`:
```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './action-score'`.

- [ ] **Step 3: Implement the scorer**

`packages/core/src/action-score.ts`:
```ts
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
```

- [ ] **Step 4: Add the export**

`packages/core/src/index.ts` — add this line (after the existing `export * from "./actions";` that Plan 2 added):
```ts
export * from "./action-score";
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS — `action-score.test.ts` 6 passed; all other core test files still green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): deterministic next-best-action scorer (scoreAction, selectNextBestAction, estimateActionCosts)"
```

---

## Task 2: Core — full OperationalMemory union (shared-contracts §10)

**Files:**
- Create: `packages/core/src/memory.ts`, `packages/core/src/memory.test.ts`
- Modify: `packages/core/src/index.ts`

> Plan 2 already exports `OperationalMemoryTypeSchema` + the `OperationalMemoryType` enum-string type from `primitives.ts` (needed by `MemoryPolicy`). This task adds the concrete memory *record* schemas + the discriminated `OperationalMemory` union; it does **not** redeclare `OperationalMemoryType`.

- [ ] **Step 1: Write the failing test**

`packages/core/src/memory.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { OperationalMemorySchema } from "./memory";

describe("OperationalMemorySchema", () => {
  it("parses a CustomerPreference memory", () => {
    const mem = OperationalMemorySchema.parse({
      type: "CustomerPreference",
      entity: "Customer ABC",
      fact: "Reorders CTN-COFFEE-1KG x120, delivery before Thursday noon",
      id: "m1",
      scope: "quote_workflows",
      source: "approved_quote_2026_05_02",
      confidence: 0.86,
      ttlDays: 180,
      createdAt: "2026-05-02T00:00:00Z",
      lastUsedAt: null,
      value: 0.31,
    });
    expect(mem.type).toBe("CustomerPreference");
    if (mem.type === "CustomerPreference") expect(mem.entity).toBe("Customer ABC");
  });

  it("parses an EvidenceSource memory referencing a tool + claim category", () => {
    const mem = OperationalMemorySchema.parse({
      type: "EvidenceSource",
      claimCategory: "price",
      sourceTool: "lookup_catalog",
      id: "m2",
      scope: "quote_workflows",
      source: "trace_002",
      confidence: 0.9,
      ttlDays: 90,
      createdAt: "2026-06-11T00:00:00Z",
      lastUsedAt: null,
      value: 0.2,
    });
    if (mem.type === "EvidenceSource") expect(mem.sourceTool).toBe("lookup_catalog");
  });

  it("rejects an unknown memory type", () => {
    expect(() => OperationalMemorySchema.parse({ type: "ChatLog", id: "m1" })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './memory'`.

- [ ] **Step 3: Implement the union**

`packages/core/src/memory.ts`:
```ts
import { z } from "zod";
import { ClaimCategorySchema, ToolNameSchema, VerifierNameSchema } from "./primitives";

/** Fields shared by every operational-memory record. `value` is scoreMemoryValue() output (Plan 6). */
const memoryBase = {
  id: z.string(),
  scope: z.string(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
  ttlDays: z.number().int().positive(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  value: z.number(),
};

export const CustomerPreferenceMemorySchema = z.object({
  type: z.literal("CustomerPreference"),
  entity: z.string(),
  fact: z.string(),
  ...memoryBase,
});

export const WorkflowFailurePatchMemorySchema = z.object({
  type: z.literal("WorkflowFailurePatch"),
  trigger: z.string(),
  patch: z.string(),
  validatedByReplay: z.boolean(),
  expectedEntropyReduction: z.number(),
  ...memoryBase,
});

export const PolicyExceptionMemorySchema = z.object({
  type: z.literal("PolicyException"),
  rule: z.string(),
  exception: z.string(),
  approvedBy: z.string(),
  ...memoryBase,
});

export const EvidenceSourceMemorySchema = z.object({
  type: z.literal("EvidenceSource"),
  claimCategory: ClaimCategorySchema,
  sourceTool: ToolNameSchema,
  ...memoryBase,
});

export const VerifierFindingMemorySchema = z.object({
  type: z.literal("VerifierFinding"),
  verifierName: VerifierNameSchema,
  finding: z.string(),
  ...memoryBase,
});

export const OperationalMemorySchema = z.discriminatedUnion("type", [
  CustomerPreferenceMemorySchema,
  WorkflowFailurePatchMemorySchema,
  PolicyExceptionMemorySchema,
  EvidenceSourceMemorySchema,
  VerifierFindingMemorySchema,
]);
export type OperationalMemory = z.infer<typeof OperationalMemorySchema>;
```

- [ ] **Step 4: Add the export**

`packages/core/src/index.ts` — add this line:
```ts
export * from "./memory";
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS — `memory.test.ts` 3 passed; all core test files green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): full OperationalMemory discriminated union (shared-contracts §10)"
```

---

## Task 3: Storage — MemoryRepository + in-memory implementation (shared-contracts §13)

**Files:**
- Create: `packages/storage/src/memory-repository.ts`, `packages/storage/src/memory-repository.test.ts`
- Modify: `packages/storage/src/index.ts`

> Plan 2 already added `@clarityloop/core` (+ `zod`) to `packages/storage/package.json`; no manifest change is needed here.

- [ ] **Step 1: Write the failing test**

`packages/storage/src/memory-repository.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { InMemoryMemoryRepository } from "./memory-repository";
import type { OperationalMemory } from "@clarityloop/core";

const pref: OperationalMemory = {
  type: "CustomerPreference",
  entity: "Customer ABC",
  fact: "Reorders CTN-COFFEE-1KG x120",
  id: "m1",
  scope: "quote_workflows",
  source: "trace_001",
  confidence: 0.86,
  ttlDays: 180,
  createdAt: "2026-05-02T00:00:00Z",
  lastUsedAt: null,
  value: 0.31,
};

const evid: OperationalMemory = {
  type: "EvidenceSource",
  claimCategory: "price",
  sourceTool: "lookup_catalog",
  id: "m2",
  scope: "other_scope",
  source: "trace_002",
  confidence: 0.9,
  ttlDays: 90,
  createdAt: "2026-06-11T00:00:00Z",
  lastUsedAt: null,
  value: 0.2,
};

describe("InMemoryMemoryRepository", () => {
  it("puts and gets by id, null for misses", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    expect((await repo.get("m1"))?.id).toBe("m1");
    expect(await repo.get("missing")).toBeNull();
  });

  it("queries by scope", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    await repo.put(evid);
    expect((await repo.query({ scope: "quote_workflows" })).map((m) => m.id)).toEqual(["m1"]);
  });

  it("queries by type", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    await repo.put(evid);
    expect((await repo.query({ type: "EvidenceSource" })).map((m) => m.id)).toEqual(["m2"]);
  });

  it("queries by entity (only CustomerPreference carries one)", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    await repo.put(evid);
    expect((await repo.query({ entity: "Customer ABC" })).map((m) => m.id)).toEqual(["m1"]);
    expect(await repo.query({ entity: "Nobody" })).toEqual([]);
  });

  it("invalidate removes the entry", async () => {
    const repo = new InMemoryMemoryRepository();
    await repo.put(pref);
    await repo.invalidate("m1");
    expect(await repo.get("m1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/storage test`
Expected: FAIL — `Cannot find module './memory-repository'`.

- [ ] **Step 3: Implement the repository**

`packages/storage/src/memory-repository.ts`:
```ts
import type { OperationalMemory, OperationalMemoryType } from "@clarityloop/core";

export interface MemoryRepository {
  put(mem: OperationalMemory): Promise<void>;
  get(id: string): Promise<OperationalMemory | null>;
  query(q: { scope?: string; type?: OperationalMemoryType; entity?: string }): Promise<OperationalMemory[]>;
  invalidate(id: string): Promise<void>; // TTL / conflict invalidation (memo §16)
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly map = new Map<string, OperationalMemory>();

  async put(mem: OperationalMemory): Promise<void> {
    this.map.set(mem.id, mem);
  }

  async get(id: string): Promise<OperationalMemory | null> {
    return this.map.get(id) ?? null;
  }

  async query(q: { scope?: string; type?: OperationalMemoryType; entity?: string }): Promise<OperationalMemory[]> {
    return [...this.map.values()].filter((m) => {
      if (q.scope !== undefined && m.scope !== q.scope) return false;
      if (q.type !== undefined && m.type !== q.type) return false;
      if (q.entity !== undefined) {
        if (m.type !== "CustomerPreference" || m.entity !== q.entity) return false;
      }
      return true;
    });
  }

  async invalidate(id: string): Promise<void> {
    this.map.delete(id);
  }
}
```

- [ ] **Step 4: Add the export**

`packages/storage/src/index.ts` — add this line:
```ts
export * from "./memory-repository";
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @clarityloop/storage test`
Expected: PASS — `memory-repository.test.ts` 5 passed; existing storage test files green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(storage): MemoryRepository interface + in-memory implementation"
```

---

## Task 4: Tools — package scaffold, Tool interface, fixtures

**Files:**
- Create: `packages/tools/package.json`, `packages/tools/tsconfig.json`
- Create: `packages/tools/src/tool.ts`, `packages/tools/src/fixtures.ts`, `packages/tools/src/index.ts`
- Create: `packages/tools/src/fixtures.test.ts`

- [ ] **Step 1: Create the package manifests + install**

`packages/tools/package.json`:
```json
{
  "name": "@clarityloop/tools",
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
    "@clarityloop/storage": "workspace:*",
    "zod": "^3.23.0"
  }
}
```

`packages/tools/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

Run: `pnpm install`
Expected: lockfile updates; `@clarityloop/tools` linked with `@clarityloop/core`, `@clarityloop/qwen`, `@clarityloop/storage` (no errors).

- [ ] **Step 2: Write the Tool interface (verbatim shared-contracts §11)**

`packages/tools/src/tool.ts`:
```ts
import type { z } from "zod";
import type { EvidenceRef, ToolName, ToolPermissionLevel } from "@clarityloop/core";

export interface ToolResult<Data = unknown> {
  ok: boolean;
  data: Data | null;
  evidence: EvidenceRef[]; // support this call produced
  error: string | null;
  costHint: { tokens: number; latencyMs: number; toolCost: number }; // feeds CandidateAction costs
}

export interface Tool<Args = Record<string, unknown>, Data = unknown> {
  name: ToolName;
  description: string;
  permission: ToolPermissionLevel;
  inputs: z.ZodType<Args>; // zod schema for args (validated before run)
  run(args: Args): Promise<ToolResult<Data>>;
}
```

- [ ] **Step 3: Write the failing fixtures test**

`packages/tools/src/fixtures.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { InMemoryMemoryRepository } from "@clarityloop/storage";
import { SEED_CATALOG, SEED_STOCK, SEED_MEMORIES, seedMemoryRepository } from "./fixtures";

describe("tool fixtures", () => {
  it("seeds a coffee SKU in catalog + stock", () => {
    expect(SEED_CATALOG.find((c) => c.sku === "CTN-COFFEE-1KG")?.unitPrice).toBe(42.5);
    expect(SEED_STOCK.find((s) => s.sku === "CTN-COFFEE-1KG")?.available).toBe(500);
  });

  it("seeds an approved CustomerPreference memory and loads it into a repo", async () => {
    expect(SEED_MEMORIES[0].type).toBe("CustomerPreference");
    const repo = new InMemoryMemoryRepository();
    await seedMemoryRepository(repo);
    const got = await repo.query({ scope: "quote_workflows", entity: "Customer ABC" });
    expect(got).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/tools test`
Expected: FAIL — `Cannot find module './fixtures'`.

- [ ] **Step 5: Implement the fixtures**

`packages/tools/src/fixtures.ts`:
```ts
import type { OperationalMemory } from "@clarityloop/core";
import type { MemoryRepository } from "@clarityloop/storage";

export type CatalogEntry = { sku: string; name: string; unitPrice: number; currency: string };
export const SEED_CATALOG: CatalogEntry[] = [
  { sku: "CTN-COFFEE-1KG", name: "Coffee Cartons 1kg", unitPrice: 42.5, currency: "MYR" },
  { sku: "CTN-TEA-500G", name: "Tea Cartons 500g", unitPrice: 18.0, currency: "MYR" },
];

export type StockEntry = { sku: string; available: number; leadTimeDays: number };
export const SEED_STOCK: StockEntry[] = [
  { sku: "CTN-COFFEE-1KG", available: 500, leadTimeDays: 3 },
  { sku: "CTN-TEA-500G", available: 40, leadTimeDays: 10 },
];

/** Prior-order knowledge is stored as approved operational memory (memo §16). */
export const SEED_MEMORIES: OperationalMemory[] = [
  {
    type: "CustomerPreference",
    entity: "Customer ABC",
    fact: "Reorders CTN-COFFEE-1KG, 120 cartons, prefers delivery before Thursday noon",
    id: "mem_abc_pref",
    scope: "quote_workflows",
    source: "approved_quote_2026_05_02",
    confidence: 0.86,
    ttlDays: 180,
    createdAt: "2026-05-02T00:00:00Z",
    lastUsedAt: null,
    value: 0.31,
  },
  {
    type: "EvidenceSource",
    claimCategory: "price",
    sourceTool: "lookup_catalog",
    id: "mem_price_src",
    scope: "quote_workflows",
    source: "trace_seed",
    confidence: 0.9,
    ttlDays: 90,
    createdAt: "2026-05-02T00:00:00Z",
    lastUsedAt: null,
    value: 0.2,
  },
];

export async function seedMemoryRepository(repo: MemoryRepository): Promise<void> {
  for (const mem of SEED_MEMORIES) await repo.put(mem);
}
```

- [ ] **Step 6: Write the index (covers all six tools; filled in by Tasks 5–11)**

`packages/tools/src/index.ts`:
```ts
export * from "./tool";
export * from "./fixtures";
export * from "./retrieve-memory";
export * from "./lookup-catalog";
export * from "./check-stock";
export * from "./parse-supplier-quote";
export * from "./compare-quote";
export * from "./draft-quote";
export * from "./registry";
```

> The index references modules created in Tasks 5–11. To keep this task green in isolation, temporarily comment out the not-yet-created lines, OR run only the fixtures file: `pnpm --filter @clarityloop/tools test fixtures`. Each later task uncomments its line. (Simplest: implement Tasks 5–11 before the first full `pnpm --filter @clarityloop/tools test`.)

- [ ] **Step 7: Run the fixtures test**

Run: `pnpm --filter @clarityloop/tools test fixtures`
Expected: PASS — `fixtures.test.ts` 2 passed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(tools): package scaffold, Tool/ToolResult interface, seeded fixtures"
```

---

## Task 5: Tool — retrieve_memory (read_only)

**Files:**
- Create: `packages/tools/src/retrieve-memory.ts`, `packages/tools/src/retrieve-memory.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/tools/src/retrieve-memory.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { InMemoryMemoryRepository } from "@clarityloop/storage";
import { makeRetrieveMemoryTool, RetrieveMemoryArgsSchema } from "./retrieve-memory";
import { seedMemoryRepository } from "./fixtures";

describe("retrieve_memory tool", () => {
  it("returns scoped memories with approved_memory evidence", async () => {
    const repo = new InMemoryMemoryRepository();
    await seedMemoryRepository(repo);
    const tool = makeRetrieveMemoryTool(repo);
    expect(tool.name).toBe("retrieve_memory");
    expect(tool.permission).toBe("read_only");
    const res = await tool.run(RetrieveMemoryArgsSchema.parse({ scope: "quote_workflows", entity: "Customer ABC" }));
    expect(res.ok).toBe(true);
    expect(res.data?.[0].type).toBe("CustomerPreference");
    expect(res.evidence[0].kind).toBe("approved_memory");
    expect(res.evidence[0].sourceTool).toBe("retrieve_memory");
  });

  it("returns an ok empty result when nothing matches", async () => {
    const repo = new InMemoryMemoryRepository();
    await seedMemoryRepository(repo);
    const tool = makeRetrieveMemoryTool(repo);
    const res = await tool.run(RetrieveMemoryArgsSchema.parse({ scope: "no_such_scope" }));
    expect(res.ok).toBe(true);
    expect(res.data).toEqual([]);
    expect(res.evidence).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/tools test retrieve-memory`
Expected: FAIL — `Cannot find module './retrieve-memory'`.

- [ ] **Step 3: Implement the tool**

`packages/tools/src/retrieve-memory.ts`:
```ts
import { z } from "zod";
import { OperationalMemoryTypeSchema, type EvidenceRef, type OperationalMemory } from "@clarityloop/core";
import type { MemoryRepository } from "@clarityloop/storage";
import type { Tool, ToolResult } from "./tool";

export const RetrieveMemoryArgsSchema = z.object({
  scope: z.string(),
  entity: z.string().nullable().default(null),
  type: OperationalMemoryTypeSchema.nullable().default(null),
});
export type RetrieveMemoryArgs = z.infer<typeof RetrieveMemoryArgsSchema>;

function snippet(m: OperationalMemory): string {
  switch (m.type) {
    case "CustomerPreference":
      return `${m.entity}: ${m.fact}`;
    case "WorkflowFailurePatch":
      return `patch: ${m.patch}`;
    case "PolicyException":
      return `exception: ${m.exception}`;
    case "EvidenceSource":
      return `${m.claimCategory} via ${m.sourceTool}`;
    case "VerifierFinding":
      return `${m.verifierName}: ${m.finding}`;
  }
}

export function makeRetrieveMemoryTool(repo: MemoryRepository): Tool<RetrieveMemoryArgs, OperationalMemory[]> {
  return {
    name: "retrieve_memory",
    description: "Fetch relevant approved operational memory for a scope/entity/type.",
    permission: "read_only",
    inputs: RetrieveMemoryArgsSchema,
    async run(args: RetrieveMemoryArgs): Promise<ToolResult<OperationalMemory[]>> {
      const memories = await repo.query({
        scope: args.scope,
        entity: args.entity ?? undefined,
        type: args.type ?? undefined,
      });
      const evidence: EvidenceRef[] = memories.map((m) => ({
        id: `ev_mem_${m.id}`,
        kind: "approved_memory",
        sourceTool: "retrieve_memory",
        uri: null,
        snippet: snippet(m),
        confidence: m.confidence,
      }));
      return { ok: true, data: memories, evidence, error: null, costHint: { tokens: 0, latencyMs: 5, toolCost: 0.02 } };
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/tools test retrieve-memory`
Expected: PASS — `retrieve-memory.test.ts` 2 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): retrieve_memory tool over MemoryRepository"
```

---

## Task 6: Tool — lookup_catalog (read_only)

**Files:**
- Create: `packages/tools/src/lookup-catalog.ts`, `packages/tools/src/lookup-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/tools/src/lookup-catalog.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeLookupCatalogTool, LookupCatalogArgsSchema } from "./lookup-catalog";

describe("lookup_catalog tool", () => {
  it("finds an entry by sku and emits catalog evidence", async () => {
    const tool = makeLookupCatalogTool();
    const res = await tool.run(LookupCatalogArgsSchema.parse({ sku: "CTN-COFFEE-1KG" }));
    expect(res.ok).toBe(true);
    expect(res.data?.unitPrice).toBe(42.5);
    expect(res.evidence[0].kind).toBe("catalog");
    expect(res.evidence[0].sourceTool).toBe("lookup_catalog");
  });

  it("finds an entry by fuzzy query", async () => {
    const tool = makeLookupCatalogTool();
    const res = await tool.run(LookupCatalogArgsSchema.parse({ query: "coffee" }));
    expect(res.data?.sku).toBe("CTN-COFFEE-1KG");
  });

  it("returns ok:false for an unknown sku", async () => {
    const tool = makeLookupCatalogTool();
    const res = await tool.run(LookupCatalogArgsSchema.parse({ sku: "NOPE" }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("NOPE");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/tools test lookup-catalog`
Expected: FAIL — `Cannot find module './lookup-catalog'`.

- [ ] **Step 3: Implement the tool**

`packages/tools/src/lookup-catalog.ts`:
```ts
import { z } from "zod";
import type { EvidenceRef } from "@clarityloop/core";
import type { Tool, ToolResult } from "./tool";
import { SEED_CATALOG, type CatalogEntry } from "./fixtures";

export const LookupCatalogArgsSchema = z.object({
  sku: z.string().nullable().default(null),
  query: z.string().nullable().default(null),
});
export type LookupCatalogArgs = z.infer<typeof LookupCatalogArgsSchema>;

export type CatalogResult = { sku: string; name: string; unitPrice: number; currency: string };

export function makeLookupCatalogTool(catalog: CatalogEntry[] = SEED_CATALOG): Tool<LookupCatalogArgs, CatalogResult> {
  return {
    name: "lookup_catalog",
    description: "Look up the current catalog price/spec for a SKU (by sku or fuzzy query).",
    permission: "read_only",
    inputs: LookupCatalogArgsSchema,
    async run(args: LookupCatalogArgs): Promise<ToolResult<CatalogResult>> {
      const q = args.query?.toLowerCase() ?? null;
      const entry =
        (args.sku ? catalog.find((c) => c.sku === args.sku) : undefined) ??
        (q ? catalog.find((c) => c.name.toLowerCase().includes(q) || c.sku.toLowerCase().includes(q)) : undefined);
      if (!entry) {
        return {
          ok: false,
          data: null,
          evidence: [],
          error: `no catalog entry for ${args.sku ?? args.query ?? "<empty>"}`,
          costHint: { tokens: 0, latencyMs: 4, toolCost: 0.02 },
        };
      }
      const evidence: EvidenceRef[] = [
        {
          id: `ev_catalog_${entry.sku}`,
          kind: "catalog",
          sourceTool: "lookup_catalog",
          uri: null,
          snippet: `${entry.sku} ${entry.name} @ ${entry.unitPrice} ${entry.currency}`,
          confidence: 0.95,
        },
      ];
      return {
        ok: true,
        data: { sku: entry.sku, name: entry.name, unitPrice: entry.unitPrice, currency: entry.currency },
        evidence,
        error: null,
        costHint: { tokens: 0, latencyMs: 4, toolCost: 0.02 },
      };
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/tools test lookup-catalog`
Expected: PASS — `lookup-catalog.test.ts` 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): lookup_catalog tool over seeded catalog"
```

---

## Task 7: Tool — check_stock (read_only)

**Files:**
- Create: `packages/tools/src/check-stock.ts`, `packages/tools/src/check-stock.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/tools/src/check-stock.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeCheckStockTool, CheckStockArgsSchema } from "./check-stock";

describe("check_stock tool", () => {
  it("reports availability when on-hand covers the quantity", async () => {
    const tool = makeCheckStockTool();
    const res = await tool.run(CheckStockArgsSchema.parse({ sku: "CTN-COFFEE-1KG", quantity: 120 }));
    expect(res.ok).toBe(true);
    expect(res.data?.available).toBe(true);
    expect(res.data?.leadTimeDays).toBe(3);
    expect(res.evidence[0].kind).toBe("stock");
  });

  it("reports unavailable when quantity exceeds on-hand", async () => {
    const tool = makeCheckStockTool();
    const res = await tool.run(CheckStockArgsSchema.parse({ sku: "CTN-TEA-500G", quantity: 120 }));
    expect(res.data?.available).toBe(false);
  });

  it("returns ok:false for an unknown sku", async () => {
    const tool = makeCheckStockTool();
    const res = await tool.run(CheckStockArgsSchema.parse({ sku: "NOPE", quantity: 1 }));
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/tools test check-stock`
Expected: FAIL — `Cannot find module './check-stock'`.

- [ ] **Step 3: Implement the tool**

`packages/tools/src/check-stock.ts`:
```ts
import { z } from "zod";
import type { EvidenceRef } from "@clarityloop/core";
import type { Tool, ToolResult } from "./tool";
import { SEED_STOCK, type StockEntry } from "./fixtures";

export const CheckStockArgsSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
});
export type CheckStockArgs = z.infer<typeof CheckStockArgsSchema>;

export type StockResult = { available: boolean; leadTimeDays: number; onHand: number };

export function makeCheckStockTool(stock: StockEntry[] = SEED_STOCK): Tool<CheckStockArgs, StockResult> {
  return {
    name: "check_stock",
    description: "Check availability and lead time for a SKU + quantity.",
    permission: "read_only",
    inputs: CheckStockArgsSchema,
    async run(args: CheckStockArgs): Promise<ToolResult<StockResult>> {
      const entry = stock.find((s) => s.sku === args.sku);
      if (!entry) {
        return {
          ok: false,
          data: null,
          evidence: [],
          error: `no stock record for ${args.sku}`,
          costHint: { tokens: 0, latencyMs: 6, toolCost: 0.03 },
        };
      }
      const available = entry.available >= args.quantity;
      const evidence: EvidenceRef[] = [
        {
          id: `ev_stock_${entry.sku}`,
          kind: "stock",
          sourceTool: "check_stock",
          uri: null,
          snippet: `${entry.sku}: ${entry.available} on hand, lead ${entry.leadTimeDays}d`,
          confidence: 0.9,
        },
      ];
      return {
        ok: true,
        data: { available, leadTimeDays: entry.leadTimeDays, onHand: entry.available },
        evidence,
        error: null,
        costHint: { tokens: 0, latencyMs: 6, toolCost: 0.03 },
      };
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/tools test check-stock`
Expected: PASS — `check-stock.test.ts` 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): check_stock tool over seeded stock"
```

---

## Task 8: Tool — parse_supplier_quote (read_only, Qwen-VL via generateStructured)

**Files:**
- Create: `packages/tools/src/parse-supplier-quote.ts`, `packages/tools/src/parse-supplier-quote.test.ts`

> Human-gated note: this tool calls Qwen-VL (`task: "document_parse"`) in production. **All tests use a fake `ModelProvider`** — no live API. The single live-VL smoke check is deferred to the deploy phase (Plan 7), human-gated like Plan 1 P0.4.

- [ ] **Step 1: Write the failing test**

`packages/tools/src/parse-supplier-quote.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore } from "@clarityloop/storage";
import type { ModelProvider } from "@clarityloop/qwen";
import { makeParseSupplierQuoteTool, ParseSupplierQuoteArgsSchema } from "./parse-supplier-quote";

const fakeProvider = (reply: string): ModelProvider => ({ async complete() { return reply; } });

const VALID = JSON.stringify({
  lineItems: [{ sku: "CTN-COFFEE-1KG", description: "Coffee 1kg", quantity: 120, unitPrice: 41.0 }],
  total: 4920,
  currency: "MYR",
});

describe("parse_supplier_quote tool", () => {
  it("parses an uploaded quote via the model and emits supplier_quote evidence", async () => {
    const store = new InMemoryArtifactStore();
    await store.put("uploads/q1.txt", "Supplier ACME: 120 x CTN-COFFEE-1KG @ 41.00 MYR, total 4920 MYR");
    const tool = makeParseSupplierQuoteTool({ provider: fakeProvider("```json\n" + VALID + "\n```"), store });
    const res = await tool.run(ParseSupplierQuoteArgsSchema.parse({ artifactKey: "uploads/q1.txt" }));
    expect(res.ok).toBe(true);
    expect(res.data?.total).toBe(4920);
    expect(res.evidence[0].kind).toBe("supplier_quote");
  });

  it("returns ok:false when the artifact is missing", async () => {
    const store = new InMemoryArtifactStore();
    const tool = makeParseSupplierQuoteTool({ provider: fakeProvider(VALID), store });
    const res = await tool.run(ParseSupplierQuoteArgsSchema.parse({ artifactKey: "uploads/missing.txt" }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("not found");
  });

  it("returns ok:false when the model output fails schema validation", async () => {
    const store = new InMemoryArtifactStore();
    await store.put("uploads/q2.txt", "garbled");
    const tool = makeParseSupplierQuoteTool({ provider: fakeProvider('{"lineItems":[]}'), store });
    const res = await tool.run(ParseSupplierQuoteArgsSchema.parse({ artifactKey: "uploads/q2.txt" }));
    expect(res.ok).toBe(false);
    expect(res.error).toContain("parse failed");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/tools test parse-supplier-quote`
Expected: FAIL — `Cannot find module './parse-supplier-quote'`.

- [ ] **Step 3: Implement the tool**

`packages/tools/src/parse-supplier-quote.ts`:
```ts
import { z } from "zod";
import type { EvidenceRef } from "@clarityloop/core";
import { generateStructured, type ModelProvider } from "@clarityloop/qwen";
import type { ArtifactStore } from "@clarityloop/storage";
import type { Tool, ToolResult } from "./tool";

export const SupplierQuoteSchema = z.object({
  lineItems: z.array(
    z.object({
      sku: z.string(),
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    }),
  ),
  total: z.number(),
  currency: z.string(),
});
export type SupplierQuote = z.infer<typeof SupplierQuoteSchema>;

export const ParseSupplierQuoteArgsSchema = z.object({ artifactKey: z.string() });
export type ParseSupplierQuoteArgs = z.infer<typeof ParseSupplierQuoteArgsSchema>;

export type ParseSupplierQuoteDeps = { provider: ModelProvider; store: ArtifactStore };

export function makeParseSupplierQuoteTool(deps: ParseSupplierQuoteDeps): Tool<ParseSupplierQuoteArgs, SupplierQuote> {
  return {
    name: "parse_supplier_quote",
    description: "Extract structured line items/total from an uploaded supplier quote (Qwen-VL/text).",
    permission: "read_only",
    inputs: ParseSupplierQuoteArgsSchema,
    async run(args: ParseSupplierQuoteArgs): Promise<ToolResult<SupplierQuote>> {
      const raw = await deps.store.get(args.artifactKey);
      if (raw === null) {
        return {
          ok: false,
          data: null,
          evidence: [],
          error: `artifact not found: ${args.artifactKey}`,
          costHint: { tokens: 0, latencyMs: 10, toolCost: 0.05 },
        };
      }
      try {
        const quote = await generateStructured(deps.provider, SupplierQuoteSchema, {
          task: "document_parse",
          messages: [
            {
              role: "system",
              content: "Extract the supplier quote as JSON with lineItems[], total, currency. Return JSON only.",
            },
            { role: "user", content: raw },
          ],
        });
        const evidence: EvidenceRef[] = [
          {
            id: `ev_supquote_${args.artifactKey}`,
            kind: "supplier_quote",
            sourceTool: "parse_supplier_quote",
            uri: args.artifactKey,
            snippet: `supplier total ${quote.total} ${quote.currency} across ${quote.lineItems.length} line(s)`,
            confidence: 0.8,
          },
        ];
        return { ok: true, data: quote, evidence, error: null, costHint: { tokens: 800, latencyMs: 60, toolCost: 0.05 } };
      } catch (e) {
        return {
          ok: false,
          data: null,
          evidence: [],
          error: `parse failed: ${(e as Error).message}`,
          costHint: { tokens: 400, latencyMs: 40, toolCost: 0.05 },
        };
      }
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/tools test parse-supplier-quote`
Expected: PASS — `parse-supplier-quote.test.ts` 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): parse_supplier_quote tool (Qwen-VL via generateStructured, fake-tested)"
```

---

## Task 9: Tool — compare_quote (draft)

**Files:**
- Create: `packages/tools/src/compare-quote.ts`, `packages/tools/src/compare-quote.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/tools/src/compare-quote.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeCompareQuoteTool, CompareQuoteArgsSchema } from "./compare-quote";

const supplier = {
  lineItems: [{ sku: "CTN-COFFEE-1KG", description: "Coffee", quantity: 120, unitPrice: 41.0 }],
  total: 4920,
  currency: "MYR",
};

describe("compare_quote tool", () => {
  it("flags within-policy when supplier matches catalog closely", async () => {
    const tool = makeCompareQuoteTool();
    const res = await tool.run(CompareQuoteArgsSchema.parse({ supplier, catalog: [{ sku: "CTN-COFFEE-1KG", unitPrice: 42.5 }] }));
    expect(res.ok).toBe(true);
    expect(res.data?.withinPolicy).toBe(true);
    expect(res.data?.deltas[0].deltaPct).toBeCloseTo((41.0 - 42.5) / 42.5, 5);
    expect(res.permission).toBeUndefined(); // ToolResult carries no permission field
    expect(tool.permission).toBe("draft");
  });

  it("flags out-of-policy when supplier deviates beyond maxDeltaPct", async () => {
    const tool = makeCompareQuoteTool();
    const res = await tool.run(CompareQuoteArgsSchema.parse({ supplier, catalog: [{ sku: "CTN-COFFEE-1KG", unitPrice: 30.0 }] }));
    expect(res.data?.withinPolicy).toBe(false);
    expect(res.evidence[0].kind).toBe("pricing_policy");
  });

  it("treats a missing catalog match as out-of-policy", async () => {
    const tool = makeCompareQuoteTool();
    const res = await tool.run(CompareQuoteArgsSchema.parse({ supplier, catalog: [] }));
    expect(res.data?.deltas[0].catalogUnitPrice).toBeNull();
    expect(res.data?.withinPolicy).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/tools test compare-quote`
Expected: FAIL — `Cannot find module './compare-quote'`.

- [ ] **Step 3: Implement the tool**

`packages/tools/src/compare-quote.ts`:
```ts
import { z } from "zod";
import type { EvidenceRef } from "@clarityloop/core";
import type { Tool, ToolResult } from "./tool";

export const CompareQuoteArgsSchema = z.object({
  supplier: z.object({
    lineItems: z.array(
      z.object({ sku: z.string(), description: z.string(), quantity: z.number(), unitPrice: z.number() }),
    ),
    total: z.number(),
    currency: z.string(),
  }),
  catalog: z.array(z.object({ sku: z.string(), unitPrice: z.number() })),
  maxDeltaPct: z.number().default(0.1),
});
export type CompareQuoteArgs = z.infer<typeof CompareQuoteArgsSchema>;

export type QuoteDelta = {
  sku: string;
  supplierUnitPrice: number;
  catalogUnitPrice: number | null;
  deltaPct: number | null;
};
export type CompareResult = { deltas: QuoteDelta[]; withinPolicy: boolean };

export function makeCompareQuoteTool(): Tool<CompareQuoteArgs, CompareResult> {
  return {
    name: "compare_quote",
    description: "Reconcile a supplier quote against current catalog prices.",
    permission: "draft",
    inputs: CompareQuoteArgsSchema,
    async run(args: CompareQuoteArgs): Promise<ToolResult<CompareResult>> {
      const deltas: QuoteDelta[] = args.supplier.lineItems.map((li) => {
        const cat = args.catalog.find((c) => c.sku === li.sku);
        const catalogUnitPrice = cat ? cat.unitPrice : null;
        const deltaPct = cat ? (li.unitPrice - cat.unitPrice) / cat.unitPrice : null;
        return { sku: li.sku, supplierUnitPrice: li.unitPrice, catalogUnitPrice, deltaPct };
      });
      const withinPolicy = deltas.every((d) => d.deltaPct !== null && Math.abs(d.deltaPct) <= args.maxDeltaPct);
      const evidence: EvidenceRef[] = [
        {
          id: "ev_compare_quote",
          kind: "pricing_policy",
          sourceTool: "compare_quote",
          uri: null,
          snippet: withinPolicy
            ? "supplier prices within policy of catalog"
            : "supplier prices deviate from catalog beyond policy",
          confidence: 0.85,
        },
      ];
      return { ok: true, data: { deltas, withinPolicy }, evidence, error: null, costHint: { tokens: 0, latencyMs: 8, toolCost: 0.02 } };
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/tools test compare-quote`
Expected: PASS — `compare-quote.test.ts` 3 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): compare_quote tool (supplier vs catalog reconciliation)"
```

---

## Task 10: Tool — draft_quote (draft)

**Files:**
- Create: `packages/tools/src/draft-quote.ts`, `packages/tools/src/draft-quote.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/tools/src/draft-quote.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore } from "@clarityloop/storage";
import { makeDraftQuoteTool, DraftQuoteArgsSchema } from "./draft-quote";

describe("draft_quote tool", () => {
  it("writes a draft quote artifact and returns its key + total", async () => {
    const store = new InMemoryArtifactStore();
    const tool = makeDraftQuoteTool(store);
    expect(tool.permission).toBe("draft");
    const res = await tool.run(
      DraftQuoteArgsSchema.parse({
        customer: "Customer ABC",
        lineItems: [{ sku: "CTN-COFFEE-1KG", quantity: 120, unitPrice: 42.5 }],
        deliveryDate: "2026-06-22",
      }),
    );
    expect(res.ok).toBe(true);
    expect(res.data?.artifactKey).toBe("quotes/customer-abc.json");
    expect(res.data?.total).toBe(5100);
    const stored = await store.get("quotes/customer-abc.json");
    expect(JSON.parse(stored!).total).toBe(5100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/tools test draft-quote`
Expected: FAIL — `Cannot find module './draft-quote'`.

- [ ] **Step 3: Implement the tool**

`packages/tools/src/draft-quote.ts`:
```ts
import { z } from "zod";
import type { ArtifactStore } from "@clarityloop/storage";
import type { Tool, ToolResult } from "./tool";

export const DraftQuoteArgsSchema = z.object({
  customer: z.string(),
  lineItems: z.array(z.object({ sku: z.string(), quantity: z.number(), unitPrice: z.number() })),
  deliveryDate: z.string(),
});
export type DraftQuoteArgs = z.infer<typeof DraftQuoteArgsSchema>;

export type DraftQuoteResult = { artifactKey: string; total: number };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function makeDraftQuoteTool(store: ArtifactStore): Tool<DraftQuoteArgs, DraftQuoteResult> {
  return {
    name: "draft_quote",
    description: "Produce a draft quote artifact (internal draft — NOT an external send).",
    permission: "draft",
    inputs: DraftQuoteArgsSchema,
    async run(args: DraftQuoteArgs): Promise<ToolResult<DraftQuoteResult>> {
      const total = args.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
      const artifactKey = `quotes/${slug(args.customer)}.json`;
      const doc = JSON.stringify(
        { customer: args.customer, lineItems: args.lineItems, deliveryDate: args.deliveryDate, total },
        null,
        2,
      );
      await store.put(artifactKey, doc);
      return { ok: true, data: { artifactKey, total }, evidence: [], error: null, costHint: { tokens: 0, latencyMs: 12, toolCost: 0.03 } };
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/tools test draft-quote`
Expected: PASS — `draft-quote.test.ts` 1 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): draft_quote tool writing a draft artifact via ArtifactStore"
```

---

## Task 11: Tools — registry + full package green

**Files:**
- Create: `packages/tools/src/registry.ts`, `packages/tools/src/registry.test.ts`
- (Index already created in Task 4; ensure all six lines are uncommented.)

- [ ] **Step 1: Write the failing test**

`packages/tools/src/registry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore, InMemoryMemoryRepository } from "@clarityloop/storage";
import type { ModelProvider } from "@clarityloop/qwen";
import { createToolRegistry } from "./registry";

const fakeProvider: ModelProvider = { async complete() { return "{}"; } };

describe("createToolRegistry", () => {
  it("wires all six tools keyed by ToolName", () => {
    const reg = createToolRegistry({
      memory: new InMemoryMemoryRepository(),
      provider: fakeProvider,
      store: new InMemoryArtifactStore(),
    });
    expect(Object.keys(reg).sort()).toEqual([
      "check_stock",
      "compare_quote",
      "draft_quote",
      "lookup_catalog",
      "parse_supplier_quote",
      "retrieve_memory",
    ]);
    expect(reg.lookup_catalog.permission).toBe("read_only");
    expect(reg.draft_quote.permission).toBe("draft");
    expect(reg.retrieve_memory.name).toBe("retrieve_memory");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/tools test registry`
Expected: FAIL — `Cannot find module './registry'`.

- [ ] **Step 3: Implement the registry**

`packages/tools/src/registry.ts`:
```ts
import type { ToolName } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import type { ArtifactStore, MemoryRepository } from "@clarityloop/storage";
import type { Tool } from "./tool";
import { makeRetrieveMemoryTool } from "./retrieve-memory";
import { makeLookupCatalogTool } from "./lookup-catalog";
import { makeCheckStockTool } from "./check-stock";
import { makeParseSupplierQuoteTool } from "./parse-supplier-quote";
import { makeCompareQuoteTool } from "./compare-quote";
import { makeDraftQuoteTool } from "./draft-quote";

/** All six tools keyed by their ToolName. The loop controller looks tools up by action type. */
export type ToolRegistry = Record<ToolName, Tool<any, any>>;

export type ToolRegistryDeps = {
  memory: MemoryRepository;
  provider: ModelProvider;
  store: ArtifactStore;
};

export function createToolRegistry(deps: ToolRegistryDeps): ToolRegistry {
  return {
    retrieve_memory: makeRetrieveMemoryTool(deps.memory),
    lookup_catalog: makeLookupCatalogTool(),
    check_stock: makeCheckStockTool(),
    parse_supplier_quote: makeParseSupplierQuoteTool({ provider: deps.provider, store: deps.store }),
    compare_quote: makeCompareQuoteTool(),
    draft_quote: makeDraftQuoteTool(deps.store),
  };
}
```

- [ ] **Step 4: Run the full tools suite + typecheck**

Run: `pnpm --filter @clarityloop/tools test`
Expected: PASS — all tool test files green (registry 1 + fixtures 2 + retrieve-memory 2 + lookup-catalog 3 + check-stock 3 + parse-supplier-quote 3 + compare-quote 3 + draft-quote 1 = 18 passed).

Run: `pnpm --filter @clarityloop/tools typecheck`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(tools): tool registry wiring all six tools by ToolName"
```

---

## Task 12: API — loop controller (run tool → update state → re-score → emit until stop)

**Files:**
- Create: `apps/api/src/loop/controller.ts`, `apps/api/src/loop/controller.test.ts`
- Modify: `apps/api/package.json` (add `@clarityloop/tools`)

- [ ] **Step 1: Add the tools dependency + install**

`apps/api/package.json` — add `@clarityloop/tools` to `dependencies` (keep all existing Plan 1/3 deps):
```json
"@clarityloop/tools": "workspace:*",
```

Run: `pnpm install`
Expected: lockfile updates; `@clarityloop/tools` linked into `@clarityloop/api` (no errors).

- [ ] **Step 2: Write the failing integration test**

`apps/api/src/loop/controller.test.ts`:
```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/api test loop/controller`
Expected: FAIL — `Cannot find module './controller'`.

- [ ] **Step 4: Implement the loop controller**

`apps/api/src/loop/controller.ts`:
```ts
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
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @clarityloop/api test loop/controller`
Expected: PASS — `controller.test.ts` 6 passed (1 streaming integration + 3 stop conditions + 2 reducer). The streaming test confirms commit entropy `0.60 → 0.50 → 0.25` across iterations and stops below the 0.3 threshold.

- [ ] **Step 6: Run the whole API suite (no regressions)**

Run: `pnpm --filter @clarityloop/api test`
Expected: PASS — Plan 1 `app.test.ts`, Plan 3 `latent/extract.test.ts` + `latent/loop.test.ts`, and the new `loop/controller.test.ts` all green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): next-best-action loop controller (run tool, fold state, re-score, emit until stop)"
```

> **SSE-route composition note (no code change required for Plan 4 tests):** Plan 3's `apps/api/src/latent/loop.ts` left a "Plan 4 extension point". To stream the real tool loop over the existing SSE route, the run handler (Plan 3 Task 4 `/runs/stream`) is updated to: (1) build the `ToolRegistry` via `createToolRegistry({ memory, provider, store })`, (2) build a `LoopContext` from the generated `WorkflowSpec` + request, then (3) `for await (const frame of runToolLoopStream(initialState, deps)) streamSSE(...)`. This is a wiring swap that reuses the unchanged `EntropyUpdate` contract; the heatmap animates the loop's `scored` frames. It is exercised live during the demo, and is a one-liner over Plan 3's generator — no new contract.

---

## Task 13: Docs — README + technical doc update

**Files:**
- Modify: `README.md`
- Create: `docs/technical/plan4-tools-and-loop.md`

> Per the repo convention (update README + technical docs on every new feature), record the new `@clarityloop/tools` package and the loop controller.

- [ ] **Step 1: Append the tools + loop section to `README.md`**

Add under the package/architecture overview:
```markdown
### Tools & next-best-action loop (Plan 4)

`@clarityloop/tools` provides six tools behind a uniform `Tool` interface
(`retrieve_memory`, `lookup_catalog`, `check_stock`, `parse_supplier_quote`,
`compare_quote`, `draft_quote`). Read-only/draft tools are fixture-backed and
deterministic; `parse_supplier_quote` uses Qwen-VL via `generateStructured`.

The loop controller (`apps/api/src/loop/controller.ts`) runs the entropy-aware
loop: Qwen proposes candidate actions (structure only), deterministic code scores
them (`scoreAction`/`selectNextBestAction` in `@clarityloop/core`), the argmax tool
runs, its result is folded into the latent state, and `scoreEntropy` re-scores —
repeating until `commitEntropy < threshold`, no useful action remains, the budget
is exhausted, or the authority boundary requires approval. Each iteration emits the
Plan 3 `EntropyUpdate` SSE frame, so the heatmap animates `0.60 → 0.50 → 0.25` live.
```

- [ ] **Step 2: Create the technical doc**

`docs/technical/plan4-tools-and-loop.md`:
```markdown
# Plan 4 — Tools + Next-Best-Action Controller (as built)

## Scoring (deterministic, `@clarityloop/core`)
- `scoreAction(a) = ER + RR − tokenCost − latencyCost − humanBurdenCost − toolCost`.
- `selectNextBestAction(candidates)` = argmax; returns `null` if no candidate scores > 0.
- `estimateActionCosts(proposed, state)` derives ER/RR from the §7 entropy weights
  (required missing field or unsupported claim ≈ 0.25; retrieve_memory +0.10 when
  stale memory is present) plus a static per-action cost table. `toCandidateAction`
  attaches costs + computes the score. The model never supplies a number.

## Tools (`@clarityloop/tools`)
Uniform `Tool { name, description, permission, inputs, run }` returning
`ToolResult { ok, data, evidence: EvidenceRef[], error, costHint }`.
| tool | permission | backing |
|---|---|---|
| retrieve_memory | read_only | `MemoryRepository` (seeded `OperationalMemory`) |
| lookup_catalog | read_only | seeded catalog fixture |
| check_stock | read_only | seeded stock fixture |
| parse_supplier_quote | read_only | Qwen-VL via `generateStructured` (fake in tests) |
| compare_quote | draft | deterministic supplier-vs-catalog reconciliation |
| draft_quote | draft | writes a draft artifact via `ArtifactStore` |

## Loop controller (`apps/api/src/loop/controller.ts`)
`runToolLoopStream(initialState, deps)` is an async generator yielding `EntropyUpdate`
frames and returning a `LoopResult { finalState, finalEntropy, steps, stopReason }`.
Stop reasons: `commit_entropy_below_threshold | no_useful_action | budget_exhausted |
approval_required`. `applyToolResult` is the deterministic state reducer; the SSE
route streams the generator unchanged from Plan 3's `EntropyUpdate` contract.

## Deferred to later plans
- Real commit/approval classification → Plan 5 (`runCommitGate` replaces the
  `approvalRequired` predicate).
- Memory **write** path + value scoring → Plan 6 (read path lands here).
- Live Qwen-VL smoke test → human-gated, Plan 7 deploy.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: document @clarityloop/tools and the next-best-action loop controller"
```

---

## Self-Review

**Spec coverage (design spec §12 Phase 4, §7; scope items (a)/(b)/(c)):**

| Scope item | Where |
|---|---|
| (a) `packages/tools` + six tools behind shared `Tool` interface | Tasks 4–11 |
| — `retrieve_memory` (read path: memory union + `MemoryRepository`) | Tasks 2, 3, 5 |
| — `lookup_catalog`, `check_stock` (seeded, deterministic) | Tasks 6, 7 |
| — `parse_supplier_quote` (Qwen-VL via `generateStructured`, fake in tests) | Task 8 |
| — `compare_quote`, `draft_quote` | Tasks 9, 10 |
| — registry assembling all six by `ToolName` | Task 11 |
| (b) deterministic action scorer `ER+RR−token−latency−human−tool` + argmax | Task 1 (`scoreAction`, `selectNextBestAction`, `estimateActionCosts`) |
| (c) loop: run tool → update latent state → re-score → emit, until stop | Task 12 (`runToolLoopStream` / `runToolLoop`, `applyToolResult`) |
| — stop: `commitEntropy<threshold` OR no useful action OR budget OR approval-required | Task 12 (four `LoopStopReason` branches, each test-covered) |
| Test: each tool unit-tested | Tasks 5–10 (one test file per tool) |
| Test: scorer argmax picks highest score | Task 1 (`selectNextBestAction` argmax + null tests) |
| Test: loop integration shows entropy decreasing across iterations | Task 12 (streaming test asserts strictly-decreasing `scored` frames `0.60→0.50→0.25`) |

**Deterministic-over-structured-Qwen invariant:** Qwen output is confined to `proposeActions` (returns `ProposedAction[]`, structure only) and `parse_supplier_quote`'s `generateStructured` (zod-validated). Every score, cost, entropy, and stop decision is computed by deterministic TypeScript. The model emits no gating number. ✓

**Fake provider / no live API:** every test uses `fakeProvider` (`async complete() {...}`) and in-memory stores/repos. The only live calls (Qwen-VL parse, SSE deploy) are explicitly human-gated/deferred (Tasks 8, 12 note; Plan 7). ✓

**Placeholder scan:** No `TODO`/`TBD`/"similar to above". Every code block is complete; every command has an expected result. The only conditional instruction is Task 4 Step 6's note about ordering the `index.ts` exports — resolved by implementing Tasks 5–11 before the first full-suite run. ✓

**Type-consistency check (across tasks + shared contracts):**
- `Tool` / `ToolResult` copied verbatim from shared-contracts §11; `EvidenceRef.kind` values used (`approved_memory`, `catalog`, `stock`, `supplier_quote`, `pricing_policy`) are all in the §3 enum.
- `scoreAction` / `selectNextBestAction` signatures match shared-contracts §6; operate on Plan 2's `CandidateAction`/`ProposedAction` (imported, not redefined).
- `OperationalMemory` union matches §10; `OperationalMemoryType` (enum) imported from Plan 2 — not redeclared.
- `MemoryRepository` matches §13 verbatim (`put`/`get`/`query`/`invalidate`).
- Loop emits Plan 3's `EntropyUpdate` (`step`, `phase ∈ {scored,acted,done}`, `state`, `entropy`, `nextBestAction`, `note`) — unchanged SSE contract.
- `CommitPolicy.commitEntropyThreshold` (the stop threshold, §4 R8) and `BudgetPolicy`'s five caps (§4 R9) are consumed exactly as typed by Plan 2.
- Entropy arithmetic is self-consistent: `scoreEntropy` weights (0.25 missing, 0.25 unsupported, 0.10 stale) reconcile with `estimateActionCosts` expected-reduction values and the integration test's `0.60→0.50→0.25` trajectory. ✓

**Dependencies assumed from other plans:** Plan 2 (core `primitives`/`workflow`/`actions` schemas; storage `@clarityloop/core` dep + run/trace/procedure repos) and Plan 3 (`EntropyUpdate`/`EntropyScoreSchema`; `apps/api/src/latent/loop.ts` extension point). Stated in the Dependencies section; the ownership split matches shared-contracts §15.

---

## What later plans depend on this one

- **Plan 5 (Commit gate + approval):** consumes `LoopResult.finalState`/`finalEntropy` and the tools' `EvidenceRef[]`; replaces the Plan-4 `approvalRequired` predicate with the real `runCommitGate` (verifiers + risk-tiered approval). The loop's `no_useful_action`/`needs-info` exits map onto `CommitDecision`.
- **Plan 6 (Improvement + promotion):** builds the memory **write** path + `scoreMemoryValue` on top of this plan's `OperationalMemory` union and `MemoryRepository` (read path); replay reuses `runToolLoop` deterministically over seeded cases.
- **Plan 7 (Benchmark + demo):** ClarityLoopBench drives `runToolLoop` per case; the SSE route streams `runToolLoopStream` for the live `0.82 → 0.46 → 0.18` heatmap demo. The single live Qwen-VL `parse_supplier_quote` smoke test is finalized here (human-gated).
