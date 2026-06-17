# Commit Gate + Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the run loop with the **governed commit decision**. Build the six deterministic verifiers (`packages/verifiers`), the deterministic `runCommitGate` in `@clarityloop/core` that turns latent state + entropy + verifier results + risk class + policy into a `CommitDecision` union, risk-tiered (L0–L4) approval classification, and wire it all into the API (`POST /commit`, `POST /approvals/resolve`) and an approval panel in the web dashboard. Invariant throughout: **the model may propose a commit; deterministic code decides whether it is allowed.**

**Architecture:** Verifiers are pure, synchronous functions behind a uniform `Verifier` interface; they consume the latent state, evidence, and the workflow spec and emit `Check[]`. The commit gate is a pure function in `packages/core` that consumes those checks plus the deterministic entropy score and the governed policy/authority boundary and returns one of `commit | needs_approval | needs_more_info | reject | sandbox_only`. Risk classification (`classifyRiskClass`) is a separate pure function so the gate stays small and the L0–L4 tiers are independently testable. `apps/api` composes verifiers + entropy + risk + gate into a `POST /commit` pipeline and enriches any `needs_approval` payload with a Qwen-generated audit narrative; `apps/web` renders the decision and posts the human approval back. No live Qwen calls in tests — a FAKE `ModelProvider` is used everywhere.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Vitest (test), Zod (validation), Hono (API), React + Vite + Tailwind (web, scaffolded by Plan 3). New package `@clarityloop/verifiers`. No new runtime cloud dependencies.

---

## Dependencies assumed from other plans

This plan builds **on top of** earlier plans. It does **not** redefine their contracts; it imports them. Copy signatures verbatim from `docs/superpowers/specs/2026-06-16-shared-contracts.md`.

- **Plan 1 (built):** `@clarityloop/core` exports `LatentWorkflowState`, `MissingField`, `Claim`, `EntropyScore`, `scoreEntropy`; `@clarityloop/qwen` exports `ModelProvider`; `@clarityloop/api` exports `createApp(deps)`.
- **Plan 2 (assumed done — core schemas + inferred types):** this plan imports from `@clarityloop/core`, added by Plan 2 per the contracts matrix (§15): `EvidenceRef`/`EvidenceRefSchema`, `RiskClass`/`RiskClassSchema`, `VerifierName`, `ToolName`, `WorkflowSpec`/`WorkflowSpecSchema`, `CommitPolicy`, `EvidencePolicy`, `AuthorityBoundary`/`AuthorityBoundarySchema`, `Check`/`CheckSchema`, `ApprovalPayload`/`ApprovalPayloadSchema`, `ApprovalRecord`, `CommitDecision`, `RunOutcome`, `EntropyScoreSchema`. Following the Plan 1 file convention, the **inferred TS types live in `packages/core/src/types.ts`** and the **zod schemas in `packages/core/src/schemas.ts`**, all re-exported from `packages/core/src/index.ts`. Plan 5's new core modules therefore `import type { … } from "./types"` and (where a runtime schema is needed) `import { …Schema } from "./schemas"`.
- **Plan 4 (assumed done):** `@clarityloop/tools` and the `ActionType`/`ProposedAction`/`CandidateAction` types. Plan 5 does **not** import tools directly — it consumes the `EvidenceRef[]` that tools produced — so Plan 4 is only a soft dependency (the run loop that calls `/commit` is wired in Plan 4/this plan's API tasks).
- **Plan 3 (assumed done):** `apps/web` Vite + React + Tailwind + Vitest scaffold, with `@clarityloop/core` as a workspace dependency and `jsx: "react-jsx"` in its tsconfig. Task 11 adds files into that scaffold. If executing this plan before Plan 3, scaffold `apps/web` first (out of scope here).

If any of the Plan 2 core types are not yet present when this plan is executed, add them to `@clarityloop/core` **using the exact shapes in the shared-contracts doc** before starting Task 1.

---

## File Structure

**Create — `packages/verifiers` (new package):**
- `packages/verifiers/package.json`
- `packages/verifiers/tsconfig.json`
- `packages/verifiers/src/types.ts` — `Verifier`, `VerifierInput`
- `packages/verifiers/src/artifact.ts` — `QuoteArtifactSchema`, `QuoteArtifact`
- `packages/verifiers/src/test-helpers.ts` — `makeState`, `makeWorkflowSpec` fixtures
- `packages/verifiers/src/missing-info.ts` + `missing-info.test.ts`
- `packages/verifiers/src/schema.ts`
- `packages/verifiers/src/numeric-reconciliation.ts`
- `packages/verifiers/src/schema-numeric.test.ts`
- `packages/verifiers/src/evidence-coverage.ts` (+ `computeEvidenceCoverage`) + `evidence-coverage.test.ts`
- `packages/verifiers/src/policy.ts`
- `packages/verifiers/src/hallucinated-tool.ts`
- `packages/verifiers/src/policy-hallucinated.test.ts`
- `packages/verifiers/src/aggregate.ts` — `allVerifiers`, `runAllVerifiers` + `aggregate.test.ts`
- `packages/verifiers/src/index.ts`

**Create — `@clarityloop/core` additions (Plan 5-owned):**
- `packages/core/src/risk.ts` (+ `risk.test.ts`) — `RiskSignals`, `classifyRiskClass`
- `packages/core/src/commit-gate.ts` (+ `commit-gate.test.ts`) — `CommitGateInput`, `runCommitGate`
- `packages/core/src/outcome.ts` (+ `outcome.test.ts`) — `commitDecisionToOutcome`, `applyApprovalDecision`, `RunIds`

**Create — `apps/api` additions:**
- `apps/api/src/commit.ts` — `CommitRequestSchema`, `RiskSignalsSchema`, `runCommitPipeline`
- `apps/api/src/commit-route.ts` — `registerCommitRoutes`
- `apps/api/src/commit.test.ts`
- `apps/api/src/approval-route.ts` — `ApprovalResolveSchema`, `registerApprovalRoutes`
- `apps/api/src/approval.test.ts`

**Create — `apps/web` additions (into the Plan 3 scaffold):**
- `apps/web/src/lib/commit-view.ts` (+ `commit-view.test.ts`) — `commitDecisionView`
- `apps/web/src/lib/approval-client.ts` (+ `approval-client.test.ts`) — `submitApproval`
- `apps/web/src/components/ApprovalPanel.tsx`

**Create — docs:**
- `docs/commit-gate-and-approval.md`

**Modify:**
- `packages/core/src/index.ts` — re-export `risk`, `commit-gate`, `outcome`
- `apps/api/src/app.ts` — register commit + approval routes
- `apps/api/package.json` — add `@clarityloop/verifiers` + `zod` deps
- `README.md` — add a "Commit gate & approval" section + bump the status table

---

## Task 1: `packages/verifiers` scaffold + `Verifier` interface + `missing_info` verifier

**Files:**
- Create: `packages/verifiers/package.json`, `packages/verifiers/tsconfig.json`
- Create: `packages/verifiers/src/types.ts`, `packages/verifiers/src/artifact.ts`, `packages/verifiers/src/test-helpers.ts`
- Create: `packages/verifiers/src/missing-info.ts`, `packages/verifiers/src/missing-info.test.ts`

- [ ] **Step 1: Create the package manifests**

`packages/verifiers/package.json`:
```json
{
  "name": "@clarityloop/verifiers",
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
    "zod": "^3.23.0"
  }
}
```

`packages/verifiers/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: Define the `Verifier` interface and the committable-artifact schema**

`packages/verifiers/src/types.ts` (copied verbatim from shared-contracts §12):
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
  run(input: VerifierInput): Check[]; // deterministic, synchronous
}
```

`packages/verifiers/src/artifact.ts` (the MVP committable artifact — a customer/supplier quote):
```ts
import { z } from "zod";

export const QuoteLineItemSchema = z.object({
  sku: z.string(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
});

export const QuoteArtifactSchema = z.object({
  customer: z.string(),
  currency: z.string(),
  lineItems: z.array(QuoteLineItemSchema),
  total: z.number(),
  deliveryDate: z.string().nullable(),
});
export type QuoteArtifact = z.infer<typeof QuoteArtifactSchema>;
```

- [ ] **Step 3: Add the shared test fixtures**

`packages/verifiers/src/test-helpers.ts` (builders for the two large core shapes; not re-exported from `index.ts`):
```ts
import type { LatentWorkflowState, WorkflowSpec } from "@clarityloop/core";

export function makeState(overrides: Partial<LatentWorkflowState> = {}): LatentWorkflowState {
  const base: LatentWorkflowState = {
    goal: "quote 120 cartons",
    workflowVersion: "v1",
    knownFacts: [],
    missingFields: [],
    claims: [],
    riskFlags: [],
    policyFlags: [],
    staleMemoryRefs: [],
    toolFailures: [],
  };
  return { ...base, ...overrides };
}

export function makeWorkflowSpec(overrides: Partial<WorkflowSpec> = {}): WorkflowSpec {
  const base: WorkflowSpec = {
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
      {
        id: "s2",
        name: "draft",
        purpose: "draft quote",
        action: { type: "tool", toolName: "draft_quote", args: {} },
        expectedOutputs: ["artifact"],
        evidenceProduced: null,
        entropyTarget: "commitEntropy",
      },
    ],
    allowedTools: [
      { toolName: "lookup_catalog", defaultArgs: null },
      { toolName: "draft_quote", defaultArgs: null },
    ],
    evidencePolicy: {
      requiredForClaims: { price: "catalog_or_supplier_quote" },
      minimumCoverageForCommit: 1,
    },
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
    budgetPolicy: {
      maxLoopIterations: 12,
      maxTokens: 100000,
      maxToolCalls: 20,
      maxHumanAsks: 2,
      maxLatencyMs: 60000,
    },
  };
  return { ...base, ...overrides };
}
```

- [ ] **Step 4: Write the failing test for `missing_info`**

`packages/verifiers/src/missing-info.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { missingInfoVerifier } from "./missing-info";
import { makeState, makeWorkflowSpec } from "./test-helpers";

describe("missingInfoVerifier", () => {
  it("passes (info) when no required field is outstanding", () => {
    const checks = missingInfoVerifier.run({
      state: makeState({ missingFields: [{ id: "m1", name: "sku", necessity: "optional" }] }),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: null,
    });
    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ passed: true, severity: "info", verifier: "missing_info" });
  });

  it("blocks once per unresolved required field", () => {
    const checks = missingInfoVerifier.run({
      state: makeState({
        missingFields: [
          { id: "m1", name: "delivery_date", necessity: "required" },
          { id: "m2", name: "exact_sku", necessity: "required" },
        ],
      }),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: null,
    });
    expect(checks).toHaveLength(2);
    expect(checks.every((c) => !c.passed && c.severity === "blocking")).toBe(true);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: FAIL — `Cannot find module './missing-info'`.

- [ ] **Step 6: Implement `missing_info`**

`packages/verifiers/src/missing-info.ts`:
```ts
import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";

export const missingInfoVerifier: Verifier = {
  name: "missing_info",
  run(input: VerifierInput): Check[] {
    const required = input.state.missingFields.filter((m) => m.necessity === "required");
    if (required.length === 0) {
      return [
        {
          name: "all_required_fields_present",
          verifier: "missing_info",
          passed: true,
          severity: "info",
          detail: "no required fields outstanding",
        },
      ];
    }
    return required.map((m) => ({
      name: `required_field_missing:${m.name}`,
      verifier: "missing_info",
      passed: false,
      severity: "blocking",
      detail: `required field "${m.name}" is unresolved`,
    }));
  },
};
```

- [ ] **Step 7: Run the test**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: PASS — `missing-info.test.ts` 2 passed (2 total).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(verifiers): package scaffold, Verifier interface, missing_info verifier"
```

---

## Task 2: `schema` + `numeric_reconciliation` verifiers

**Files:**
- Create: `packages/verifiers/src/schema.ts`, `packages/verifiers/src/numeric-reconciliation.ts`
- Create: `packages/verifiers/src/schema-numeric.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/verifiers/src/schema-numeric.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { schemaVerifier } from "./schema";
import { numericReconciliationVerifier } from "./numeric-reconciliation";
import { makeState, makeWorkflowSpec } from "./test-helpers";

const validQuote = {
  customer: "ABC",
  currency: "MYR",
  lineItems: [{ sku: "A1", description: "carton", quantity: 120, unitPrice: 10, lineTotal: 1200 }],
  total: 1200,
  deliveryDate: "2026-06-20",
};

describe("schemaVerifier", () => {
  it("passes (info) when there is no draft artifact", () => {
    const checks = schemaVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks[0]).toMatchObject({ passed: true, severity: "info", verifier: "schema" });
  });
  it("passes a valid quote artifact", () => {
    const checks = schemaVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: validQuote });
    expect(checks[0].passed).toBe(true);
  });
  it("blocks an artifact missing required keys", () => {
    const checks = schemaVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: { customer: "ABC" } });
    expect(checks[0]).toMatchObject({ passed: false, severity: "blocking" });
  });
});

describe("numericReconciliationVerifier", () => {
  it("passes when line totals and quote total reconcile", () => {
    const checks = numericReconciliationVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: validQuote });
    expect(checks.every((c) => c.passed)).toBe(true);
  });
  it("blocks when the quote total != sum of line items", () => {
    const checks = numericReconciliationVerifier.run({
      state: makeState(),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: { ...validQuote, total: 999 },
    });
    expect(checks.some((c) => c.name === "quote_total" && !c.passed && c.severity === "blocking")).toBe(true);
  });
  it("blocks when a line total != quantity x unitPrice", () => {
    const checks = numericReconciliationVerifier.run({
      state: makeState(),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: {
        ...validQuote,
        lineItems: [{ sku: "A1", description: "c", quantity: 120, unitPrice: 10, lineTotal: 1300 }],
        total: 1300,
      },
    });
    expect(checks.some((c) => c.name === "line_total:A1" && !c.passed)).toBe(true);
  });
  it("skips (info) when there is no valid quote artifact", () => {
    const checks = numericReconciliationVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks[0]).toMatchObject({ passed: true, severity: "info" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: FAIL — `Cannot find module './schema'`.

- [ ] **Step 3: Implement both verifiers**

`packages/verifiers/src/schema.ts`:
```ts
import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";
import { QuoteArtifactSchema } from "./artifact";

export const schemaVerifier: Verifier = {
  name: "schema",
  run(input: VerifierInput): Check[] {
    if (input.draftArtifact === null) {
      return [{ name: "schema_skipped", verifier: "schema", passed: true, severity: "info", detail: "no draft artifact to validate" }];
    }
    const parsed = QuoteArtifactSchema.safeParse(input.draftArtifact);
    if (parsed.success) {
      return [{ name: "artifact_schema_valid", verifier: "schema", passed: true, severity: "info", detail: "draft artifact matches QuoteArtifact schema" }];
    }
    return [
      {
        name: "artifact_schema_invalid",
        verifier: "schema",
        passed: false,
        severity: "blocking",
        detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      },
    ];
  },
};
```

`packages/verifiers/src/numeric-reconciliation.ts`:
```ts
import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";
import { QuoteArtifactSchema } from "./artifact";

const TOLERANCE = 0.01;

export const numericReconciliationVerifier: Verifier = {
  name: "numeric_reconciliation",
  run(input: VerifierInput): Check[] {
    const parsed = QuoteArtifactSchema.safeParse(input.draftArtifact);
    if (!parsed.success) {
      return [{ name: "numeric_skipped", verifier: "numeric_reconciliation", passed: true, severity: "info", detail: "no valid quote artifact to reconcile" }];
    }
    const quote = parsed.data;
    const checks: Check[] = [];
    for (const item of quote.lineItems) {
      const expected = item.quantity * item.unitPrice;
      const ok = Math.abs(expected - item.lineTotal) <= TOLERANCE;
      checks.push({
        name: `line_total:${item.sku}`,
        verifier: "numeric_reconciliation",
        passed: ok,
        severity: ok ? "info" : "blocking",
        detail: ok
          ? `${item.sku} line total reconciles`
          : `${item.sku}: ${item.quantity} x ${item.unitPrice} = ${expected}, got ${item.lineTotal}`,
      });
    }
    const sum = quote.lineItems.reduce((acc, i) => acc + i.lineTotal, 0);
    const totalOk = Math.abs(sum - quote.total) <= TOLERANCE;
    checks.push({
      name: "quote_total",
      verifier: "numeric_reconciliation",
      passed: totalOk,
      severity: totalOk ? "info" : "blocking",
      detail: totalOk ? "quote total equals sum of line items" : `sum of line items ${sum} != total ${quote.total}`,
    });
    return checks;
  },
};
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: PASS — `schema-numeric.test.ts` 8 passed; suite total 10 passed (with `missing-info`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(verifiers): schema and numeric_reconciliation verifiers"
```

---

## Task 3: `evidence_coverage` verifier + `computeEvidenceCoverage`

**Files:**
- Create: `packages/verifiers/src/evidence-coverage.ts`, `packages/verifiers/src/evidence-coverage.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/verifiers/src/evidence-coverage.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeEvidenceCoverage, evidenceCoverageVerifier } from "./evidence-coverage";
import { makeState, makeWorkflowSpec } from "./test-helpers";
import type { EvidenceRef } from "@clarityloop/core";

const ev: EvidenceRef = { id: "e1", kind: "catalog", sourceTool: "lookup_catalog", uri: null, snippet: "price 10", confidence: 0.9 };

describe("computeEvidenceCoverage", () => {
  it("is 1 when there are no claims", () => {
    expect(computeEvidenceCoverage(makeState(), [])).toBe(1);
  });
  it("counts only claims with resolvable evidence", () => {
    const state = makeState({
      claims: [
        { id: "c1", text: "price 10", evidencePointer: "e1" },
        { id: "c2", text: "discount ok", evidencePointer: null },
      ],
    });
    expect(computeEvidenceCoverage(state, [ev])).toBe(0.5);
  });
  it("treats a dangling evidencePointer as unsupported", () => {
    const state = makeState({ claims: [{ id: "c1", text: "x", evidencePointer: "missing" }] });
    expect(computeEvidenceCoverage(state, [ev])).toBe(0);
  });
});

describe("evidenceCoverageVerifier", () => {
  it("passes the threshold check when coverage meets the minimum", () => {
    const state = makeState({ claims: [{ id: "c1", text: "price 10", evidencePointer: "e1" }] });
    const checks = evidenceCoverageVerifier.run({ state, evidence: [ev], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks.find((c) => c.name === "evidence_coverage_threshold")!.passed).toBe(true);
  });
  it("blocks the threshold check when coverage is below the minimum", () => {
    const state = makeState({
      claims: [
        { id: "c1", text: "price 10", evidencePointer: "e1" },
        { id: "c2", text: "discount", evidencePointer: null },
      ],
    });
    const checks = evidenceCoverageVerifier.run({ state, evidence: [ev], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    const threshold = checks.find((c) => c.name === "evidence_coverage_threshold")!;
    expect(threshold.passed).toBe(false);
    expect(threshold.severity).toBe("blocking");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: FAIL — `Cannot find module './evidence-coverage'`.

- [ ] **Step 3: Implement the verifier + the pure coverage helper**

`packages/verifiers/src/evidence-coverage.ts`:
```ts
import type { Check, EvidenceRef, LatentWorkflowState } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";

/** Fraction of claims backed by a RESOLVABLE EvidenceRef. No claims => fully covered (1). */
export function computeEvidenceCoverage(state: LatentWorkflowState, evidence: EvidenceRef[]): number {
  if (state.claims.length === 0) return 1;
  const ids = new Set(evidence.map((e) => e.id));
  const supported = state.claims.filter((c) => c.evidencePointer !== null && ids.has(c.evidencePointer));
  return supported.length / state.claims.length;
}

export const evidenceCoverageVerifier: Verifier = {
  name: "evidence_coverage",
  run(input: VerifierInput): Check[] {
    const min = input.workflowSpec.evidencePolicy.minimumCoverageForCommit;
    const coverage = computeEvidenceCoverage(input.state, input.evidence);
    const checks: Check[] = [];

    // Per-claim findings are advisory (warn): the THRESHOLD is the gating, blocking signal.
    const unsupported = input.state.claims.filter(
      (c) => c.evidencePointer === null || !input.evidence.some((e) => e.id === c.evidencePointer),
    );
    for (const c of unsupported) {
      checks.push({
        name: `claim_unsupported:${c.id}`,
        verifier: "evidence_coverage",
        passed: false,
        severity: "warn",
        detail: `claim "${c.text}" has no resolvable evidence`,
      });
    }

    const meets = coverage >= min;
    checks.push({
      name: "evidence_coverage_threshold",
      verifier: "evidence_coverage",
      passed: meets,
      severity: meets ? "info" : "blocking",
      detail: `coverage ${coverage.toFixed(2)} ${meets ? ">=" : "<"} required ${min}`,
    });
    return checks;
  },
};
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: PASS — `evidence-coverage.test.ts` 5 passed; suite total 15 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(verifiers): evidence_coverage verifier and computeEvidenceCoverage helper"
```

---

## Task 4: `policy` + `hallucinated_tool` verifiers

**Files:**
- Create: `packages/verifiers/src/policy.ts`, `packages/verifiers/src/hallucinated-tool.ts`
- Create: `packages/verifiers/src/policy-hallucinated.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/verifiers/src/policy-hallucinated.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { policyVerifier } from "./policy";
import { hallucinatedToolVerifier } from "./hallucinated-tool";
import { makeState, makeWorkflowSpec } from "./test-helpers";

describe("policyVerifier", () => {
  it("is clear (info) when there are no policy flags", () => {
    const checks = policyVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks[0]).toMatchObject({ name: "policy_clear", passed: true, severity: "info" });
  });
  it("blocks a forbidden action present as a policy flag", () => {
    const state = makeState({ policyFlags: [{ id: "p1", rule: "bypass_credit_check", ambiguous: false }] });
    const checks = policyVerifier.run({ state, evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks.some((c) => !c.passed && c.severity === "blocking")).toBe(true);
  });
  it("warns on an ambiguous policy", () => {
    const state = makeState({ policyFlags: [{ id: "p1", rule: "discount_tier", ambiguous: true }] });
    const checks = policyVerifier.run({ state, evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks.some((c) => c.severity === "warn")).toBe(true);
  });
  it("warns when a quote total exceeds the approval value threshold", () => {
    const checks = policyVerifier.run({
      state: makeState(),
      evidence: [],
      workflowSpec: makeWorkflowSpec(),
      draftArtifact: {
        customer: "ABC",
        currency: "MYR",
        lineItems: [{ sku: "A1", description: "c", quantity: 1, unitPrice: 20000, lineTotal: 20000 }],
        total: 20000,
        deliveryDate: null,
      },
    });
    expect(checks.some((c) => c.name === "high_value_quote" && c.severity === "warn")).toBe(true);
  });
});

describe("hallucinatedToolVerifier", () => {
  it("passes when every tool step is declared", () => {
    const checks = hallucinatedToolVerifier.run({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    expect(checks[0]).toMatchObject({ name: "all_tools_declared", passed: true });
  });
  it("blocks a step that calls an undeclared tool", () => {
    const spec = makeWorkflowSpec({ allowedTools: [{ toolName: "lookup_catalog", defaultArgs: null }] });
    const checks = hallucinatedToolVerifier.run({ state: makeState(), evidence: [], workflowSpec: spec, draftArtifact: null });
    expect(checks.some((c) => !c.passed && c.name.includes("draft_quote"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: FAIL — `Cannot find module './policy'`.

- [ ] **Step 3: Implement both verifiers**

`packages/verifiers/src/policy.ts`:
```ts
import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";
import { QuoteArtifactSchema } from "./artifact";

export const policyVerifier: Verifier = {
  name: "policy",
  run(input: VerifierInput): Check[] {
    const policy = input.workflowSpec.commitPolicy;
    const checks: Check[] = [];

    for (const flag of input.state.policyFlags) {
      if (policy.forbiddenActions.includes(flag.rule)) {
        checks.push({
          name: `forbidden_action:${flag.rule}`,
          verifier: "policy",
          passed: false,
          severity: "blocking",
          detail: `forbidden action "${flag.rule}" is present`,
        });
      } else if (flag.ambiguous) {
        checks.push({
          name: `ambiguous_policy:${flag.rule}`,
          verifier: "policy",
          passed: false,
          severity: "warn",
          detail: `policy "${flag.rule}" is ambiguous and needs human judgement`,
        });
      }
    }

    const quote = QuoteArtifactSchema.safeParse(input.draftArtifact);
    if (
      quote.success &&
      policy.requireApprovalIf.quoteValueAbove !== null &&
      quote.data.total > policy.requireApprovalIf.quoteValueAbove
    ) {
      checks.push({
        name: "high_value_quote",
        verifier: "policy",
        passed: false,
        severity: "warn",
        detail: `quote total ${quote.data.total} exceeds approval threshold ${policy.requireApprovalIf.quoteValueAbove}`,
      });
    }

    if (checks.length === 0) {
      checks.push({ name: "policy_clear", verifier: "policy", passed: true, severity: "info", detail: "no policy violations or approval triggers" });
    }
    return checks;
  },
};
```

`packages/verifiers/src/hallucinated-tool.ts`:
```ts
import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";

export const hallucinatedToolVerifier: Verifier = {
  name: "hallucinated_tool",
  run(input: VerifierInput): Check[] {
    const declared = new Set(input.workflowSpec.allowedTools.map((t) => t.toolName));
    const checks: Check[] = [];
    for (const step of input.workflowSpec.steps) {
      if (step.action.type === "tool" && !declared.has(step.action.toolName)) {
        checks.push({
          name: `unauthorized_tool:${step.action.toolName}`,
          verifier: "hallucinated_tool",
          passed: false,
          severity: "blocking",
          detail: `step "${step.id}" calls undeclared tool "${step.action.toolName}"`,
        });
      }
    }
    if (checks.length === 0) {
      checks.push({ name: "all_tools_declared", verifier: "hallucinated_tool", passed: true, severity: "info", detail: "every tool step is declared in allowedTools" });
    }
    return checks;
  },
};
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: PASS — `policy-hallucinated.test.ts` 6 passed; suite total 21 passed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(verifiers): policy and hallucinated_tool verifiers"
```

---

## Task 5: Verifier registry (`allVerifiers` + `runAllVerifiers`) + package index

**Files:**
- Create: `packages/verifiers/src/aggregate.ts`, `packages/verifiers/src/aggregate.test.ts`
- Create: `packages/verifiers/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/verifiers/src/aggregate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { allVerifiers, runAllVerifiers } from "./aggregate";
import { makeState, makeWorkflowSpec } from "./test-helpers";

describe("verifier registry", () => {
  it("registers all six verifiers by name", () => {
    expect(allVerifiers.map((v) => v.name).sort()).toEqual([
      "evidence_coverage",
      "hallucinated_tool",
      "missing_info",
      "numeric_reconciliation",
      "policy",
      "schema",
    ]);
  });

  it("runAllVerifiers concatenates checks from every verifier", () => {
    const checks = runAllVerifiers({ state: makeState(), evidence: [], workflowSpec: makeWorkflowSpec(), draftArtifact: null });
    const verifiers = new Set(checks.map((c) => c.verifier));
    expect(verifiers).toEqual(
      new Set(["schema", "numeric_reconciliation", "evidence_coverage", "policy", "hallucinated_tool", "missing_info"]),
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/verifiers test`
Expected: FAIL — `Cannot find module './aggregate'`.

- [ ] **Step 3: Implement the registry and the barrel export**

`packages/verifiers/src/aggregate.ts`:
```ts
import type { Check } from "@clarityloop/core";
import type { Verifier, VerifierInput } from "./types";
import { schemaVerifier } from "./schema";
import { numericReconciliationVerifier } from "./numeric-reconciliation";
import { evidenceCoverageVerifier } from "./evidence-coverage";
import { policyVerifier } from "./policy";
import { hallucinatedToolVerifier } from "./hallucinated-tool";
import { missingInfoVerifier } from "./missing-info";

export const allVerifiers: Verifier[] = [
  schemaVerifier,
  numericReconciliationVerifier,
  evidenceCoverageVerifier,
  policyVerifier,
  hallucinatedToolVerifier,
  missingInfoVerifier,
];

export function runAllVerifiers(input: VerifierInput): Check[] {
  return allVerifiers.flatMap((v) => v.run(input));
}
```

`packages/verifiers/src/index.ts`:
```ts
export * from "./types";
export * from "./artifact";
export * from "./schema";
export * from "./numeric-reconciliation";
export * from "./evidence-coverage";
export * from "./policy";
export * from "./hallucinated-tool";
export * from "./missing-info";
export * from "./aggregate";
```

- [ ] **Step 4: Run the full verifier suite + typecheck**

Run: `pnpm --filter @clarityloop/verifiers test && pnpm --filter @clarityloop/verifiers typecheck`
Expected: PASS — `aggregate.test.ts` 2 passed; suite total 23 passed; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(verifiers): registry (allVerifiers, runAllVerifiers) and package index"
```

---

## Task 6: Risk-tiered classification in `@clarityloop/core` (`classifyRiskClass`, L0–L4)

**Files:**
- Create: `packages/core/src/risk.ts`, `packages/core/src/risk.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/risk.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyRiskClass, type RiskSignals } from "./risk";
import type { CommitPolicy } from "./types";

const policy: CommitPolicy = {
  autoCommitAllowed: true,
  requireApprovalIf: {
    quoteValueAbove: 10000,
    discountAbovePct: 20,
    evidenceCoverageBelow: 0.8,
    deliveryUnconfirmed: true,
    externalSend: true,
    policyException: true,
  },
  forbiddenActions: [],
  commitEntropyThreshold: 0.3,
};

const base: RiskSignals = {
  structuralChange: false,
  legalSensitive: false,
  policyException: false,
  quoteValue: null,
  discountPct: null,
  externalSend: false,
  producesArtifact: false,
  reversible: true,
};

describe("classifyRiskClass (memo §17)", () => {
  it("L0 — read-only / reversible with no artifact", () => {
    expect(classifyRiskClass(base, policy)).toBe("L0");
  });
  it("L1 — internal draft artifact", () => {
    expect(classifyRiskClass({ ...base, producesArtifact: true }, policy)).toBe("L1");
  });
  it("L2 — external-facing but reversible", () => {
    expect(classifyRiskClass({ ...base, producesArtifact: true, externalSend: true }, policy)).toBe("L2");
  });
  it("L3 — high-value quote above the threshold", () => {
    expect(classifyRiskClass({ ...base, producesArtifact: true, quoteValue: 50000 }, policy)).toBe("L3");
  });
  it("L3 — discount above the threshold", () => {
    expect(classifyRiskClass({ ...base, producesArtifact: true, discountPct: 35 }, policy)).toBe("L3");
  });
  it("L3 — irreversible action", () => {
    expect(classifyRiskClass({ ...base, reversible: false }, policy)).toBe("L3");
  });
  it("L4 — structural change (promotion / new tool permission / memory-policy change)", () => {
    expect(classifyRiskClass({ ...base, structuralChange: true }, policy)).toBe("L4");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './risk'`.

- [ ] **Step 3: Implement `classifyRiskClass`**

`packages/core/src/risk.ts`:
```ts
import type { CommitPolicy, RiskClass } from "./types";

/** Signals the orchestrator derives from the proposed action + draft artifact. */
export type RiskSignals = {
  structuralChange: boolean; // workflow promotion / new tool permission / memory-policy change
  legalSensitive: boolean;
  policyException: boolean;
  quoteValue: number | null;
  discountPct: number | null;
  externalSend: boolean;
  producesArtifact: boolean; // false => read-only / reversible, no persisted artifact
  reversible: boolean;
};

/**
 * Risk-tiered classification (memo §17): L0 reversible → L4 structural. Deterministic, pure.
 * First matching tier wins (highest risk first).
 */
export function classifyRiskClass(s: RiskSignals, commitPolicy: CommitPolicy): RiskClass {
  if (s.structuralChange) return "L4";

  const r = commitPolicy.requireApprovalIf;
  const highValue = r.quoteValueAbove !== null && s.quoteValue !== null && s.quoteValue > r.quoteValueAbove;
  const bigDiscount = r.discountAbovePct !== null && s.discountPct !== null && s.discountPct > r.discountAbovePct;

  if (s.legalSensitive || s.policyException || highValue || bigDiscount || !s.reversible) return "L3";
  if (s.externalSend) return "L2";
  if (s.producesArtifact) return "L1";
  return "L0";
}
```

- [ ] **Step 4: Re-export from the core index**

`packages/core/src/index.ts`:
```ts
export const CLARITYLOOP_CORE_VERSION = "0.0.0";
export * from "./schemas";
export * from "./types";
export * from "./entropy";
export * from "./risk";
export * from "./commit-gate";
export * from "./outcome";
```

> Note: `./commit-gate` and `./outcome` are added in Tasks 7–8. If running Task 6 in isolation, add only `export * from "./risk";` now and append the other two when their files exist; the final state of `index.ts` is shown above.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS — `risk.test.ts` 7 passed; full core suite green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): risk-tiered classifyRiskClass (L0-L4) per memo §17"
```

---

## Task 7: The deterministic Commit Gate (`runCommitGate`) in `@clarityloop/core`

**Files:**
- Create: `packages/core/src/commit-gate.ts`, `packages/core/src/commit-gate.test.ts`
- Verify: `packages/core/src/index.ts` already re-exports `./commit-gate` (Task 6 Step 4)

- [ ] **Step 1: Write the failing tests (the four required cases + sandbox + entropy)**

`packages/core/src/commit-gate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runCommitGate, type CommitGateInput } from "./commit-gate";
import { scoreEntropy } from "./entropy";
import type { AuthorityBoundary, Check, CommitPolicy, LatentWorkflowState } from "./types";

const commitPolicy: CommitPolicy = {
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
};

const authority: AuthorityBoundary = {
  autoCommitMaxRiskClass: "L2",
  approvalRequiredFor: ["external_send", "high_value_quote"],
  forbiddenActions: ["bypass_credit_check"],
  allowedTools: [],
};

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

const passingChecks: Check[] = [
  { name: "artifact_schema_valid", verifier: "schema", passed: true, severity: "info", detail: "" },
  { name: "evidence_coverage_threshold", verifier: "evidence_coverage", passed: true, severity: "info", detail: "" },
];

function input(overrides: Partial<CommitGateInput> = {}): CommitGateInput {
  return {
    state: cleanState,
    entropy: scoreEntropy(cleanState),
    checks: passingChecks,
    evidenceCoverage: 1,
    commitPolicy,
    authorityBoundary: authority,
    riskClass: "L1",
    ...overrides,
  };
}

describe("runCommitGate", () => {
  it("commits when entropy is low, verifiers pass, and risk is within the ceiling", () => {
    expect(runCommitGate(input()).type).toBe("commit");
  });

  it("needs_approval for an L3 commit above the auto-commit ceiling", () => {
    const d = runCommitGate(input({ riskClass: "L3" }));
    expect(d.type).toBe("needs_approval");
    if (d.type === "needs_approval") {
      expect(d.approvalPayload.riskClass).toBe("L3");
      expect(d.approvalPayload.failedChecks).toEqual([]);
      expect(d.approvalPayload.runId).toBe(""); // orchestrator fills it later
    }
  });

  it("needs_more_info when a required field is unresolved", () => {
    const state = { ...cleanState, missingFields: [{ id: "m1", name: "delivery_date", necessity: "required" as const }] };
    const d = runCommitGate(input({ state, entropy: scoreEntropy(state) }));
    expect(d.type).toBe("needs_more_info");
    if (d.type === "needs_more_info") expect(d.missingFields).toEqual(["delivery_date"]);
  });

  it("rejects on a blocking policy violation", () => {
    const checks: Check[] = [
      ...passingChecks,
      { name: "forbidden_action:bypass_credit_check", verifier: "policy", passed: false, severity: "blocking", detail: "forbidden" },
    ];
    const d = runCommitGate(input({ checks }));
    expect(d.type).toBe("reject");
    if (d.type === "reject") expect(d.failedChecks).toHaveLength(1);
  });

  it("sandbox_only for an L4 structural action", () => {
    expect(runCommitGate(input({ riskClass: "L4" })).type).toBe("sandbox_only");
  });

  it("needs_approval when residual commit entropy is at/above threshold", () => {
    const noisy: LatentWorkflowState = {
      ...cleanState,
      claims: [{ id: "c1", text: "price 10", evidencePointer: null }],
      policyFlags: [{ id: "p1", rule: "discount_tier", ambiguous: true }],
    };
    const d = runCommitGate(input({ state: noisy, entropy: scoreEntropy(noisy), riskClass: "L1" }));
    expect(d.type).toBe("needs_approval");
  });

  it("reject takes precedence over needs_approval when both a hard failure and high risk exist", () => {
    const checks: Check[] = [
      { name: "artifact_schema_invalid", verifier: "schema", passed: false, severity: "blocking", detail: "bad shape" },
    ];
    const d = runCommitGate(input({ checks, riskClass: "L3" }));
    expect(d.type).toBe("reject");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './commit-gate'`.

- [ ] **Step 3: Implement `runCommitGate`**

`packages/core/src/commit-gate.ts`:
```ts
import type {
  ApprovalPayload,
  AuthorityBoundary,
  Check,
  CommitDecision,
  CommitPolicy,
  EntropyScore,
  LatentWorkflowState,
  RiskClass,
} from "./types";

/** Commit gate inputs (shared-contracts §7, verbatim). */
export type CommitGateInput = {
  state: LatentWorkflowState;
  entropy: EntropyScore;
  checks: Check[];
  evidenceCoverage: number; // 0..1, from the evidence_coverage verifier
  commitPolicy: CommitPolicy;
  authorityBoundary: AuthorityBoundary;
  riskClass: RiskClass;
};

const RISK_ORDER: Record<RiskClass, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

/** Blocking failures from these verifiers are HARD rejections — no approval can rescue them. */
const HARD_REJECT_VERIFIERS = new Set(["policy", "hallucinated_tool", "numeric_reconciliation", "schema"]);

/**
 * Partial approval payload the gate can build from its pure inputs. The orchestrator
 * (apps/api) fills runId / summary / evidence / proposedArtifactId before persisting.
 */
function gateApprovalPayload(input: CommitGateInput, reason: string): ApprovalPayload {
  return {
    runId: "",
    riskClass: input.riskClass,
    reason,
    summary: "",
    evidence: [],
    proposedArtifactId: null,
    failedChecks: input.checks.filter((c) => !c.passed),
  };
}

/**
 * Deterministic commit gate (design spec §7, memo §18). First matching branch wins.
 * Invariant: the model may PROPOSE a commit; this code DECIDES whether it is allowed.
 */
export function runCommitGate(input: CommitGateInput): CommitDecision {
  const { state, entropy, checks, commitPolicy, authorityBoundary, riskClass } = input;
  const blocking = checks.filter((c) => !c.passed && c.severity === "blocking");

  // 1. Hard reject — blocking schema / numeric / policy / hallucinated-tool failures.
  const hardFailures = blocking.filter((c) => HARD_REJECT_VERIFIERS.has(c.verifier));
  if (hardFailures.length > 0) {
    return { type: "reject", failedChecks: hardFailures };
  }

  // 2. Needs more info — any unresolved required field (or a blocking missing_info check).
  const missingRequired = state.missingFields.filter((m) => m.necessity === "required");
  const missingInfoBlocked = blocking.some((c) => c.verifier === "missing_info");
  if (missingRequired.length > 0 || missingInfoBlocked) {
    return { type: "needs_more_info", missingFields: missingRequired.map((m) => m.name) };
  }

  // 3. Sandbox only — L4 structural actions are governed by the promotion gate, not the
  //    commit gate; the commit gate can only sandbox-simulate them (never auto-commit).
  if (riskClass === "L4") {
    return {
      type: "sandbox_only",
      reason: "L4 structural change is governed by the promotion gate; commit gate runs sandbox only",
    };
  }

  // 4. Needs approval — risk above the auto-commit ceiling, an approval-trigger 'warn',
  //    residual commit entropy at/above threshold, or auto-commit disabled by policy.
  const reasons: string[] = [];
  if (RISK_ORDER[riskClass] > RISK_ORDER[authorityBoundary.autoCommitMaxRiskClass]) {
    reasons.push(`risk ${riskClass} exceeds auto-commit ceiling ${authorityBoundary.autoCommitMaxRiskClass}`);
  }
  for (const c of checks) {
    if (!c.passed && c.severity === "warn" && c.verifier === "policy") reasons.push(c.detail);
  }
  if (entropy.commitEntropy >= commitPolicy.commitEntropyThreshold) {
    reasons.push(`commit entropy ${entropy.commitEntropy.toFixed(2)} >= threshold ${commitPolicy.commitEntropyThreshold}`);
  }
  if (!commitPolicy.autoCommitAllowed) {
    reasons.push("auto-commit disabled by commit policy");
  }
  if (reasons.length > 0) {
    const reason = reasons.join("; ");
    return { type: "needs_approval", reason, approvalPayload: gateApprovalPayload(input, reason) };
  }

  // 5. Commit — low entropy, verifiers pass, risk within the authority boundary.
  return {
    type: "commit",
    reason: "commit entropy below threshold, verifiers passed, risk within authority boundary",
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS — `commit-gate.test.ts` 7 passed; full core suite green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): deterministic runCommitGate (commit/needs_approval/needs_more_info/reject/sandbox_only)"
```

---

## Task 8: CommitDecision → RunOutcome mapping + approval resolution

**Files:**
- Create: `packages/core/src/outcome.ts`, `packages/core/src/outcome.test.ts`
- Verify: `packages/core/src/index.ts` already re-exports `./outcome` (Task 6 Step 4)

- [ ] **Step 1: Write the failing tests**

`packages/core/src/outcome.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { applyApprovalDecision, commitDecisionToOutcome } from "./outcome";
import type { ApprovalPayload, CommitDecision } from "./types";

const ids = { runId: "run_1", traceId: "trace_1", artifactId: "art_1" };
const payload: ApprovalPayload = {
  runId: "",
  riskClass: "L3",
  reason: "high value",
  summary: "",
  evidence: [],
  proposedArtifactId: "art_1",
  failedChecks: [],
};

describe("commitDecisionToOutcome (shared-contracts §7 mapping)", () => {
  it("commit -> committed with the artifact id", () => {
    const out = commitDecisionToOutcome({ type: "commit", reason: "ok" }, ids);
    expect(out).toEqual({ type: "committed", runId: "run_1", traceId: "trace_1", artifactId: "art_1" });
  });
  it("reject -> rejected carrying the failed checks", () => {
    const decision: CommitDecision = {
      type: "reject",
      failedChecks: [{ name: "x", verifier: "policy", passed: false, severity: "blocking", detail: "d" }],
    };
    expect(commitDecisionToOutcome(decision, ids).type).toBe("rejected");
  });
  it("needs_approval -> needs_approval and stamps the runId onto the payload", () => {
    const out = commitDecisionToOutcome({ type: "needs_approval", reason: "r", approvalPayload: payload }, ids);
    expect(out.type).toBe("needs_approval");
    if (out.type === "needs_approval") expect(out.approvalPayload.runId).toBe("run_1");
  });
  it("needs_more_info -> needs_more_info with the missing fields", () => {
    const out = commitDecisionToOutcome({ type: "needs_more_info", missingFields: ["sku"] }, ids);
    expect(out.type).toBe("needs_more_info");
    if (out.type === "needs_more_info") expect(out.missingFields).toEqual(["sku"]);
  });
  it("sandbox_only -> sandbox_only", () => {
    expect(commitDecisionToOutcome({ type: "sandbox_only", reason: "x" }, ids).type).toBe("sandbox_only");
  });
});

describe("applyApprovalDecision (the approval-required path)", () => {
  it("approved -> committed", () => {
    expect(applyApprovalDecision("approved", payload, ids).type).toBe("committed");
  });
  it("rejected -> rejected carrying the payload's failed checks", () => {
    expect(applyApprovalDecision("rejected", payload, ids).type).toBe("rejected");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './outcome'`.

- [ ] **Step 3: Implement the mapping + approval resolution**

`packages/core/src/outcome.ts`:
```ts
import type { ApprovalPayload, CommitDecision, RunOutcome } from "./types";

export type RunIds = { runId: string; traceId: string; artifactId: string | null };

/** CommitDecision (verb) → RunOutcome (past-tense + IDs), shared-contracts §7 mapping. */
export function commitDecisionToOutcome(decision: CommitDecision, ids: RunIds): RunOutcome {
  switch (decision.type) {
    case "commit":
      return { type: "committed", runId: ids.runId, traceId: ids.traceId, artifactId: ids.artifactId ?? "" };
    case "needs_approval":
      return {
        type: "needs_approval",
        runId: ids.runId,
        traceId: ids.traceId,
        approvalPayload: { ...decision.approvalPayload, runId: ids.runId },
      };
    case "needs_more_info":
      return { type: "needs_more_info", runId: ids.runId, traceId: ids.traceId, missingFields: decision.missingFields };
    case "reject":
      return { type: "rejected", runId: ids.runId, traceId: ids.traceId, failedChecks: decision.failedChecks };
    case "sandbox_only":
      return { type: "sandbox_only", runId: ids.runId, traceId: ids.traceId };
  }
}

/** Resolve a human approval into a terminal RunOutcome (memo §17 authority-boundary path). */
export function applyApprovalDecision(
  decision: "approved" | "rejected",
  payload: ApprovalPayload,
  ids: RunIds,
): RunOutcome {
  if (decision === "approved") {
    return { type: "committed", runId: ids.runId, traceId: ids.traceId, artifactId: ids.artifactId ?? "" };
  }
  return { type: "rejected", runId: ids.runId, traceId: ids.traceId, failedChecks: payload.failedChecks };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @clarityloop/core test && pnpm --filter @clarityloop/core typecheck`
Expected: PASS — `outcome.test.ts` 7 passed; full core suite green; typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): commitDecisionToOutcome mapping and applyApprovalDecision"
```

---

## Task 9: API commit pipeline + `POST /commit`

**Files:**
- Modify: `apps/api/package.json` (add `@clarityloop/verifiers`, `zod`)
- Create: `apps/api/src/commit.ts`, `apps/api/src/commit-route.ts`, `apps/api/src/commit.test.ts`
- Modify: `apps/api/src/app.ts` (register commit routes)

- [ ] **Step 1: Add the new dependencies**

`apps/api/package.json` (full file):
```json
{
  "name": "@clarityloop/api",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/server.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@clarityloop/core": "workspace:*",
    "@clarityloop/qwen": "workspace:*",
    "@clarityloop/storage": "workspace:*",
    "@clarityloop/verifiers": "workspace:*",
    "@hono/node-server": "^1.12.0",
    "hono": "^4.5.0",
    "zod": "^3.23.0"
  },
  "devDependencies": { "tsx": "^4.16.0" }
}
```

Run: `pnpm install`
Expected: installs; `@clarityloop/verifiers` linked into `apps/api`.

- [ ] **Step 2: Write the failing test for `POST /commit` (FAKE provider, no live Qwen)**

`apps/api/src/commit.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeProvider: ModelProvider = {
  async complete() {
    return "Audit: approval required because the quote is high-value relative to policy.";
  },
};

const workflowSpec = {
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
    {
      id: "s2",
      name: "draft",
      purpose: "draft quote",
      action: { type: "tool", toolName: "draft_quote", args: {} },
      expectedOutputs: ["artifact"],
      evidenceProduced: null,
      entropyTarget: "commitEntropy",
    },
  ],
  allowedTools: [
    { toolName: "lookup_catalog", defaultArgs: null },
    { toolName: "draft_quote", defaultArgs: null },
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

const authorityBoundary = {
  autoCommitMaxRiskClass: "L2",
  approvalRequiredFor: ["external_send", "high_value_quote"],
  forbiddenActions: ["bypass_credit_check"],
  allowedTools: [],
};

const cleanBody = {
  runId: "run_1",
  traceId: "trace_1",
  state: {
    goal: "quote 120 cartons",
    workflowVersion: "v1",
    knownFacts: [{ id: "f1", text: "customer ABC", confidence: 0.9 }],
    missingFields: [],
    claims: [{ id: "c1", text: "price 10", evidencePointer: "e1" }],
    riskFlags: [],
    policyFlags: [],
    staleMemoryRefs: [],
    toolFailures: [],
  },
  evidence: [{ id: "e1", kind: "catalog", sourceTool: "lookup_catalog", uri: null, snippet: "unit price 10", confidence: 0.9 }],
  workflowSpec,
  authorityBoundary,
  riskSignals: {
    structuralChange: false,
    legalSensitive: false,
    policyException: false,
    quoteValue: null,
    discountPct: null,
    externalSend: false,
    producesArtifact: true,
    reversible: true,
  },
  draftArtifact: {
    customer: "ABC",
    currency: "MYR",
    lineItems: [{ sku: "A1", description: "carton", quantity: 120, unitPrice: 10, lineTotal: 1200 }],
    total: 1200,
    deliveryDate: "2026-06-20",
  },
  proposedArtifactId: "art_1",
};

describe("POST /commit", () => {
  it("commits a clean, low-risk request", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cleanBody),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.type).toBe("commit");
    expect(body.outcome.type).toBe("committed");
    expect(body.riskClass).toBe("L1");
  });

  it("returns needs_approval with a Qwen-generated summary for a high-value commit", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...cleanBody, riskSignals: { ...cleanBody.riskSignals, quoteValue: 50000 } }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision.type).toBe("needs_approval");
    expect(body.riskClass).toBe("L3");
    expect(body.decision.approvalPayload.summary).toContain("Audit:");
    expect(body.decision.approvalPayload.runId).toBe("run_1");
    expect(body.decision.approvalPayload.evidence).toHaveLength(1);
  });

  it("400s on a malformed body", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: "x" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @clarityloop/api test`
Expected: FAIL — `Cannot find module './commit-route'` (imported by the new `app.ts`), or a 404 on `/commit`.

- [ ] **Step 4: Implement the pipeline, the request schema, and the route**

`apps/api/src/commit.ts`:
```ts
import { z } from "zod";
import {
  AuthorityBoundarySchema,
  EvidenceRefSchema,
  LatentWorkflowStateSchema,
  WorkflowSpecSchema,
  classifyRiskClass,
  commitDecisionToOutcome,
  runCommitGate,
  scoreEntropy,
  type CommitDecision,
  type RunOutcome,
} from "@clarityloop/core";
import { computeEvidenceCoverage, runAllVerifiers } from "@clarityloop/verifiers";
import type { ModelProvider } from "@clarityloop/qwen";

export const RiskSignalsSchema = z.object({
  structuralChange: z.boolean(),
  legalSensitive: z.boolean(),
  policyException: z.boolean(),
  quoteValue: z.number().nullable(),
  discountPct: z.number().nullable(),
  externalSend: z.boolean(),
  producesArtifact: z.boolean(),
  reversible: z.boolean(),
});

export const CommitRequestSchema = z.object({
  runId: z.string(),
  traceId: z.string(),
  state: LatentWorkflowStateSchema,
  evidence: z.array(EvidenceRefSchema),
  workflowSpec: WorkflowSpecSchema,
  authorityBoundary: AuthorityBoundarySchema,
  riskSignals: RiskSignalsSchema,
  draftArtifact: z.unknown().nullable(),
  proposedArtifactId: z.string().nullable(),
});
export type CommitRequest = z.infer<typeof CommitRequestSchema>;

export type CommitResponse = {
  decision: CommitDecision;
  outcome: RunOutcome;
  riskClass: string;
  evidenceCoverage: number;
};

/** Compose verifiers + entropy + risk classification + commit gate; enrich any approval payload. */
export async function runCommitPipeline(provider: ModelProvider, req: CommitRequest): Promise<CommitResponse> {
  const checks = runAllVerifiers({
    state: req.state,
    evidence: req.evidence,
    workflowSpec: req.workflowSpec,
    draftArtifact: req.draftArtifact ?? null,
  });
  const entropy = scoreEntropy(req.state);
  const evidenceCoverage = computeEvidenceCoverage(req.state, req.evidence);
  const riskClass = classifyRiskClass(req.riskSignals, req.workflowSpec.commitPolicy);

  let decision = runCommitGate({
    state: req.state,
    entropy,
    checks,
    evidenceCoverage,
    commitPolicy: req.workflowSpec.commitPolicy,
    authorityBoundary: req.authorityBoundary,
    riskClass,
  });

  if (decision.type === "needs_approval") {
    const summary = await provider.complete(
      [
        { role: "system", content: "You write a concise audit narrative for a human approver. 2-3 sentences." },
        { role: "user", content: `Goal: ${req.state.goal}. Reason approval is required: ${decision.reason}.` },
      ],
      { task: "audit_narrative" },
    );
    decision = {
      ...decision,
      approvalPayload: {
        ...decision.approvalPayload,
        runId: req.runId,
        summary,
        evidence: req.evidence,
        proposedArtifactId: req.proposedArtifactId,
      },
    };
  }

  const outcome = commitDecisionToOutcome(decision, {
    runId: req.runId,
    traceId: req.traceId,
    artifactId: req.proposedArtifactId,
  });
  return { decision, outcome, riskClass, evidenceCoverage };
}
```

`apps/api/src/commit-route.ts`:
```ts
import type { Hono } from "hono";
import type { ModelProvider } from "@clarityloop/qwen";
import { CommitRequestSchema, runCommitPipeline } from "./commit";

export function registerCommitRoutes(app: Hono, provider: ModelProvider): void {
  app.post("/commit", async (c) => {
    const parsed = CommitRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const result = await runCommitPipeline(provider, parsed.data);
    return c.json(result);
  });
}
```

`apps/api/src/app.ts` (full file — adds the commit route registration):
```ts
import { Hono } from "hono";
import { LatentWorkflowStateSchema, scoreEntropy } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import { registerCommitRoutes } from "./commit-route";

export type AppDeps = { provider: ModelProvider };

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/score", async (c) => {
    const parsed = LatentWorkflowStateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(scoreEntropy(parsed.data));
  });

  // Smoke endpoint to prove live Qwen connectivity from the deployed environment.
  app.get("/qwen/ping", async (c) => {
    const reply = await deps.provider.complete([{ role: "user", content: "reply with the single word ok" }], { task: "extraction" });
    return c.json({ reply });
  });

  registerCommitRoutes(app, deps.provider);

  return app;
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @clarityloop/api test`
Expected: PASS — `app.test.ts` 2 passed + `commit.test.ts` 3 passed (5 total).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): commit pipeline (verifiers+gate) and POST /commit with Qwen audit narrative"
```

---

## Task 10: API approval-resolution endpoint `POST /approvals/resolve`

**Files:**
- Create: `apps/api/src/approval-route.ts`, `apps/api/src/approval.test.ts`
- Modify: `apps/api/src/app.ts` (register approval routes)

- [ ] **Step 1: Write the failing test**

`apps/api/src/approval.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeProvider: ModelProvider = { async complete() { return "ok"; } };

describe("POST /approvals/resolve", () => {
  it("approved resolves to a committed outcome and records the approval", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/approvals/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        approvalPayload: {
          runId: "run_1",
          riskClass: "L3",
          reason: "high value",
          summary: "audit narrative",
          evidence: [],
          proposedArtifactId: "art_1",
          failedChecks: [],
        },
        decision: "approved",
        approver: "manager@acme.com",
        note: null,
        traceId: "trace_1",
        artifactId: "art_1",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.outcome.type).toBe("committed");
    expect(body.record.decision).toBe("approved");
    expect(body.record.approver).toBe("manager@acme.com");
  });

  it("rejected resolves to a rejected outcome", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/approvals/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        approvalPayload: {
          runId: "run_2",
          riskClass: "L3",
          reason: "policy",
          summary: "s",
          evidence: [],
          proposedArtifactId: null,
          failedChecks: [],
        },
        decision: "rejected",
        approver: "manager@acme.com",
        note: "not this quarter",
        traceId: "trace_2",
        artifactId: null,
      }),
    });
    const body = await res.json();
    expect(body.outcome.type).toBe("rejected");
  });

  it("400s on a malformed body", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/approvals/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "maybe" }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/api test`
Expected: FAIL — `/approvals/resolve` returns 404 (route not registered).

- [ ] **Step 3: Implement the approval route and register it**

`apps/api/src/approval-route.ts`:
```ts
import type { Hono } from "hono";
import { z } from "zod";
import { ApprovalPayloadSchema, applyApprovalDecision, type ApprovalRecord } from "@clarityloop/core";

export const ApprovalResolveSchema = z.object({
  approvalPayload: ApprovalPayloadSchema,
  decision: z.enum(["approved", "rejected"]),
  approver: z.string(),
  note: z.string().nullable(),
  traceId: z.string(),
  artifactId: z.string().nullable(),
});

export function registerApprovalRoutes(app: Hono): void {
  app.post("/approvals/resolve", async (c) => {
    const parsed = ApprovalResolveSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const { approvalPayload, decision, approver, note, traceId, artifactId } = parsed.data;

    const outcome = applyApprovalDecision(decision, approvalPayload, {
      runId: approvalPayload.runId,
      traceId,
      artifactId,
    });

    const record: ApprovalRecord = {
      id: `appr_${approvalPayload.runId}`,
      payload: approvalPayload,
      decision,
      approver,
      decidedAt: new Date().toISOString(),
      note,
    };

    return c.json({ record, outcome });
  });
}
```

`apps/api/src/app.ts` (full file — now registers both commit and approval routes):
```ts
import { Hono } from "hono";
import { LatentWorkflowStateSchema, scoreEntropy } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import { registerCommitRoutes } from "./commit-route";
import { registerApprovalRoutes } from "./approval-route";

export type AppDeps = { provider: ModelProvider };

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/score", async (c) => {
    const parsed = LatentWorkflowStateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(scoreEntropy(parsed.data));
  });

  app.get("/qwen/ping", async (c) => {
    const reply = await deps.provider.complete([{ role: "user", content: "reply with the single word ok" }], { task: "extraction" });
    return c.json({ reply });
  });

  registerCommitRoutes(app, deps.provider);
  registerApprovalRoutes(app);

  return app;
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @clarityloop/api test && pnpm --filter @clarityloop/api typecheck`
Expected: PASS — `app.test.ts` 2 + `commit.test.ts` 3 + `approval.test.ts` 3 (8 total); typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): POST /approvals/resolve mapping approval decisions to run outcomes"
```

---

## Task 11: Web approval panel (decision view-model + approval client + component)

> **Depends on Plan 3** — the `apps/web` Vite + React + Tailwind + Vitest scaffold with `@clarityloop/core` as a workspace dependency. This task adds files into that scaffold. The two pure helpers are unit-tested (node env, no DOM); the `ApprovalPanel` React component is delivered complete and its visual render is verified manually (human-gated, like Plan 1's live checks).

**Files:**
- Create: `apps/web/src/lib/commit-view.ts`, `apps/web/src/lib/commit-view.test.ts`
- Create: `apps/web/src/lib/approval-client.ts`, `apps/web/src/lib/approval-client.test.ts`
- Create: `apps/web/src/components/ApprovalPanel.tsx`

- [ ] **Step 1: Write the failing tests for the two pure helpers**

`apps/web/src/lib/commit-view.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { commitDecisionView } from "./commit-view";

describe("commitDecisionView", () => {
  it("commit -> success tone, not requiring approval", () => {
    const v = commitDecisionView({ type: "commit", reason: "ok" });
    expect(v).toMatchObject({ tone: "success", requiresApproval: false });
  });
  it("needs_approval -> warning tone, requires approval, surfaces the risk class", () => {
    const v = commitDecisionView({
      type: "needs_approval",
      reason: "high value",
      approvalPayload: {
        runId: "r",
        riskClass: "L3",
        reason: "high value",
        summary: "",
        evidence: [],
        proposedArtifactId: null,
        failedChecks: [],
      },
    });
    expect(v.tone).toBe("warning");
    expect(v.requiresApproval).toBe(true);
    expect(v.lines.join(" ")).toContain("L3");
  });
  it("needs_more_info -> info tone, lists missing fields", () => {
    const v = commitDecisionView({ type: "needs_more_info", missingFields: ["delivery_date"] });
    expect(v.tone).toBe("info");
    expect(v.lines[0]).toContain("delivery_date");
  });
  it("reject -> danger tone, lists failed checks", () => {
    const v = commitDecisionView({
      type: "reject",
      failedChecks: [{ name: "x", verifier: "policy", passed: false, severity: "blocking", detail: "forbidden" }],
    });
    expect(v.tone).toBe("danger");
    expect(v.lines[0]).toContain("forbidden");
  });
  it("sandbox_only -> info tone", () => {
    expect(commitDecisionView({ type: "sandbox_only", reason: "structural" }).tone).toBe("info");
  });
});
```

`apps/web/src/lib/approval-client.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { submitApproval } from "./approval-client";
import type { ApprovalPayload } from "@clarityloop/core";

const payload: ApprovalPayload = {
  runId: "run_1",
  riskClass: "L3",
  reason: "high value",
  summary: "s",
  evidence: [],
  proposedArtifactId: "art_1",
  failedChecks: [],
};

describe("submitApproval", () => {
  it("posts the approval and returns the run outcome", async () => {
    let captured: { url: string; body: any } | null = null;
    const fakeFetch = (async (url: string, init: any) => {
      captured = { url, body: JSON.parse(init.body) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          record: { id: "appr_run_1" },
          outcome: { type: "committed", runId: "run_1", traceId: "t1", artifactId: "art_1" },
        }),
      };
    }) as unknown as typeof fetch;

    const outcome = await submitApproval({
      baseUrl: "http://api.test",
      approvalPayload: payload,
      decision: "approved",
      approver: "manager@acme.com",
      note: null,
      traceId: "t1",
      artifactId: "art_1",
      fetchImpl: fakeFetch,
    });

    expect(outcome).toEqual({ type: "committed", runId: "run_1", traceId: "t1", artifactId: "art_1" });
    expect(captured!.url).toBe("http://api.test/approvals/resolve");
    expect(captured!.body.decision).toBe("approved");
  });

  it("throws when the endpoint returns a non-ok status", async () => {
    const fakeFetch = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(
      submitApproval({
        baseUrl: "http://api.test",
        approvalPayload: payload,
        decision: "rejected",
        approver: "x",
        note: null,
        traceId: "t1",
        artifactId: null,
        fetchImpl: fakeFetch,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @clarityloop/web test`
Expected: FAIL — `Cannot find module './commit-view'`.

- [ ] **Step 3: Implement the helpers and the component**

`apps/web/src/lib/commit-view.ts`:
```ts
import type { CommitDecision } from "@clarityloop/core";

export type CommitDecisionTone = "success" | "warning" | "info" | "danger";

export type CommitDecisionView = {
  title: string;
  tone: CommitDecisionTone;
  lines: string[];
  requiresApproval: boolean;
};

export function commitDecisionView(decision: CommitDecision): CommitDecisionView {
  switch (decision.type) {
    case "commit":
      return { title: "Committed", tone: "success", lines: [decision.reason], requiresApproval: false };
    case "needs_approval":
      return {
        title: "Approval required",
        tone: "warning",
        lines: [decision.reason, `Risk class: ${decision.approvalPayload.riskClass}`],
        requiresApproval: true,
      };
    case "needs_more_info":
      return {
        title: "More information needed",
        tone: "info",
        lines: decision.missingFields.map((f) => `Missing: ${f}`),
        requiresApproval: false,
      };
    case "reject":
      return {
        title: "Rejected",
        tone: "danger",
        lines: decision.failedChecks.map((ch) => `${ch.verifier}: ${ch.detail}`),
        requiresApproval: false,
      };
    case "sandbox_only":
      return { title: "Sandbox only", tone: "info", lines: [decision.reason], requiresApproval: false };
  }
}
```

`apps/web/src/lib/approval-client.ts`:
```ts
import type { ApprovalPayload, RunOutcome } from "@clarityloop/core";

export type SubmitApprovalArgs = {
  baseUrl: string;
  approvalPayload: ApprovalPayload;
  decision: "approved" | "rejected";
  approver: string;
  note: string | null;
  traceId: string;
  artifactId: string | null;
  fetchImpl?: typeof fetch;
};

export async function submitApproval(args: SubmitApprovalArgs): Promise<RunOutcome> {
  const f = args.fetchImpl ?? fetch;
  const res = await f(`${args.baseUrl}/approvals/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      approvalPayload: args.approvalPayload,
      decision: args.decision,
      approver: args.approver,
      note: args.note,
      traceId: args.traceId,
      artifactId: args.artifactId,
    }),
  });
  if (!res.ok) throw new Error(`approval failed: ${res.status}`);
  const body = (await res.json()) as { record: unknown; outcome: RunOutcome };
  return body.outcome;
}
```

`apps/web/src/components/ApprovalPanel.tsx`:
```tsx
import { useState } from "react";
import type { ApprovalPayload, CommitDecision, RunOutcome } from "@clarityloop/core";
import { commitDecisionView } from "../lib/commit-view";
import { submitApproval } from "../lib/approval-client";

export type ApprovalPanelProps = {
  baseUrl: string;
  decision: CommitDecision;
  traceId: string;
  approver: string;
};

const TONE_CLASS: Record<string, string> = {
  success: "border-green-500 bg-green-50 text-green-900",
  warning: "border-amber-500 bg-amber-50 text-amber-900",
  info: "border-sky-500 bg-sky-50 text-sky-900",
  danger: "border-red-500 bg-red-50 text-red-900",
};

export function ApprovalPanel({ baseUrl, decision, traceId, approver }: ApprovalPanelProps) {
  const view = commitDecisionView(decision);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const payload: ApprovalPayload | null = decision.type === "needs_approval" ? decision.approvalPayload : null;

  async function resolve(d: "approved" | "rejected") {
    if (!payload) return;
    setBusy(true);
    try {
      setOutcome(
        await submitApproval({
          baseUrl,
          approvalPayload: payload,
          decision: d,
          approver,
          note: null,
          traceId,
          artifactId: payload.proposedArtifactId,
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`rounded-lg border p-4 ${TONE_CLASS[view.tone]}`} data-testid="approval-panel">
      <h2 className="text-lg font-semibold">{view.title}</h2>
      {payload && payload.summary ? <p className="mt-1 text-sm italic">{payload.summary}</p> : null}
      <ul className="mt-2 space-y-1 text-sm">
        {view.lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {payload && !outcome ? (
        <div className="mt-4 flex gap-2">
          <button
            disabled={busy}
            onClick={() => resolve("approved")}
            className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => resolve("rejected")}
            className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      ) : null}
      {outcome ? (
        <p className="mt-3 text-sm font-medium" data-testid="approval-outcome">
          Outcome: {outcome.type}
        </p>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @clarityloop/web test && pnpm --filter @clarityloop/web typecheck`
Expected: PASS — `commit-view.test.ts` 5 passed + `approval-client.test.ts` 2 passed; typecheck exits 0 (component compiles under the Plan 3 `react-jsx` tsconfig).

- [ ] **Step 5: (Human-gated, deferred) Visual check of the panel**

Render `ApprovalPanel` with a `needs_approval` decision in the running dashboard (`pnpm --filter @clarityloop/web dev`) and confirm Approve/Reject post to the API and the outcome line updates. Deferred until the Plan 3 dashboard + a live `/commit` run exist; not required for this plan's tests to pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): commit-decision view-model, approval client, ApprovalPanel component"
```

---

## Task 12: Docs — commit-gate/approval technical doc + README update

> Per the repo convention (update README + technical docs on new features). No automated test; verify by reading.

**Files:**
- Create: `docs/commit-gate-and-approval.md`
- Modify: `README.md`

- [ ] **Step 1: Write the technical doc**

`docs/commit-gate-and-approval.md`:
```markdown
# Commit Gate & Approval (Plan 5)

The commit gate is the governed boundary between an agent's proposed output and a real,
external/persistent business action. **The model may propose a commit; deterministic code
decides whether it is allowed** (design spec §7, memo §18).

## Pipeline

```
latent state + evidence + workflowSpec + draftArtifact
  → verifiers (packages/verifiers)        → Check[]
  → scoreEntropy (packages/core)          → EntropyScore
  → classifyRiskClass (packages/core)     → RiskClass (L0–L4)
  → runCommitGate (packages/core)         → CommitDecision
  → commitDecisionToOutcome               → RunOutcome
```

## Verifiers (`@clarityloop/verifiers`)

Deterministic, synchronous, behind a uniform `Verifier { name; run(input): Check[] }`:

| name | checks |
| --- | --- |
| `schema` | draft artifact matches `QuoteArtifactSchema` |
| `numeric_reconciliation` | each line total = qty × unitPrice; quote total = Σ line totals |
| `evidence_coverage` | claims resolve to evidence; coverage ≥ `minimumCoverageForCommit` |
| `policy` | forbidden actions (blocking); ambiguity / high-value (warn → approval) |
| `hallucinated_tool` | every tool step is declared in `allowedTools` |
| `missing_info` | no required `MissingField` remains unresolved |

`runAllVerifiers(input)` concatenates every verifier's checks; `computeEvidenceCoverage` is
exported for the gate's `evidenceCoverage` input.

## Commit gate (`runCommitGate`, `@clarityloop/core`)

First matching branch wins:

1. **reject** — a blocking `schema` / `numeric_reconciliation` / `policy` / `hallucinated_tool` failure.
2. **needs_more_info** — an unresolved required field (or blocking `missing_info` check).
3. **sandbox_only** — `riskClass === "L4"` (structural; governed by the promotion gate, Plan 6).
4. **needs_approval** — risk above `autoCommitMaxRiskClass`, a `policy` warn, residual
   `commitEntropy ≥ commitEntropyThreshold`, or `autoCommitAllowed === false`.
5. **commit** — low entropy, verifiers pass, risk within the authority boundary.

The gate emits a partial `ApprovalPayload` (runId / summary / evidence blank); the API
orchestrator fills those in and the summary is generated by Qwen (`audit_narrative` task).

## Risk tiers (`classifyRiskClass`, memo §17)

L0 read-only/reversible · L1 internal draft · L2 external reversible · L3 financial/legal/
irreversible/high-value/big-discount · L4 structural (promotion / new tool permission /
memory-policy change). Humans approve at the authority boundary, not in every loop.

## API

- `POST /commit` — runs the pipeline, returns `{ decision, outcome, riskClass, evidenceCoverage }`.
- `POST /approvals/resolve` — `approved → committed`, `rejected → rejected`; returns `{ record, outcome }`.

## Web

`ApprovalPanel` renders `commitDecisionView(decision)` and posts the human decision via
`submitApproval` to `/approvals/resolve`.
```

- [ ] **Step 2: Update the README**

Append the following section to `README.md` (after the "Architecture / Key design decisions" section, before "Development"), and update the status table row:

```markdown
### Commit gate & approval

When a run loop stops, deterministic code — never the model — decides whether the output may
commit. Six verifiers (`@clarityloop/verifiers`: schema, numeric reconciliation, evidence
coverage, policy, hallucinated-tool, missing-info) emit `Check[]`; `runCommitGate` combines them
with the entropy score, the risk class (L0–L4), and the governed commit policy / authority
boundary to return one of `commit | needs_approval | needs_more_info | reject | sandbox_only`.
High-risk decisions route to a human via `POST /commit` → `ApprovalPanel` → `POST /approvals/resolve`.
See [`docs/commit-gate-and-approval.md`](docs/commit-gate-and-approval.md).
```

Update the status table: add the rows
```markdown
| `@clarityloop/verifiers` — six deterministic verifiers | ✅ (23 tests) |
| `@clarityloop/core` — risk classifier + commit gate + outcome mapping | ✅ (+20 tests) |
| Commit gate API (`/commit`, `/approvals/resolve`) + approval panel | ✅ |
```

- [ ] **Step 3: Verify the whole workspace is green**

Run: `pnpm test && pnpm typecheck`
Expected: PASS — all packages green (`core`, `qwen`, `storage`, `verifiers`, `api`, `web`); typecheck exits 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: commit gate & approval technical doc and README update"
```

---

## Self-Review

**Spec coverage (scope items → tasks):**
- (a) `packages/verifiers` — six verifiers behind the shared `Verifier` interface, deterministic → Tasks 1–5 (missing_info T1; schema + numeric_reconciliation T2; evidence_coverage T3; policy + hallucinated_tool T4; registry T5). ✓
- (b) deterministic `runCommitGate` in `@clarityloop/core` — inputs latent state + entropy + verifier results + risk class + policy; outputs the full `CommitDecision` union; invariant "model proposes, code decides" → Task 7 (input type copied verbatim from shared-contracts §7). ✓
- (c) risk-tiered approval (L0–L4, memo §17) + approval-required path → Task 6 (`classifyRiskClass`), Task 8 (`applyApprovalDecision`), Task 10 (`POST /approvals/resolve`). ✓
- (d) wire commit decision into the loop end + approval screen in `apps/web` + a commit/approval endpoint → Task 9 (`POST /commit` pipeline), Task 10 (`/approvals/resolve`), Task 11 (`ApprovalPanel`). ✓
- Required gate cases tested → Task 7: low entropy + verifiers pass → `commit`; high-value (L3 above ceiling) → `needs_approval`; missing required field → `needs_more_info`; policy violation → `reject`; plus `sandbox_only` (L4) and the entropy-threshold path. Each verifier unit-tested in its own task. ✓

**FAKE provider / human-gated:** every API test uses a FAKE `ModelProvider`; no live Qwen call. Human-gated/deferred: Task 11 Step 5 (visual panel render) and any live `/commit` Qwen audit narrative against DashScope — deferred, not required for tests, consistent with Plan 1's deferral of live/visual checks.

**Placeholder scan:** no `TODO`/`TBD`/"similar to above"; every code block is complete; every run step states an exact command and expected output. The gate's blank `runId`/`summary`/`evidence` on the approval payload are intentional, documented hand-offs filled by the orchestrator (not placeholders).

**Type consistency:** `Verifier`/`VerifierInput`/`Check` match shared-contracts §12/§7; `CommitGateInput` and `runCommitGate` copied verbatim from §7; `CommitDecision`/`RunOutcome`/`ApprovalPayload`/`ApprovalRecord`/`RiskClass`/`AuthorityBoundary`/`CommitPolicy`/`WorkflowSpec`/`EvidenceRef` are imported from `@clarityloop/core` (Plan 2), never redefined. `RiskSignals`/`classifyRiskClass`/`commitDecisionToOutcome`/`applyApprovalDecision`/`RunIds` are the Plan 5-owned additions, used identically across core, api, and web. `computeEvidenceCoverage`/`runAllVerifiers` names are stable across Tasks 3/5/9.

**Assumed cross-plan dependencies:** Plan 2 (core schemas + inferred types listed above), Plan 4 (tools produce the `EvidenceRef[]` consumed here; soft), Plan 3 (`apps/web` scaffold for Task 11). All flagged in "Dependencies assumed from other plans".

## What later plans depend on this one
- **Plan 4 (loop controller)** calls `runCommitPipeline` / `POST /commit` at the loop's stop condition to terminate a run; `commit` is an `ActionType`.
- **Plan 6 (improvement + promotion)** reuses `RunOutcome` (committed/rejected/needs_approval) from this gate as the per-case signal feeding `ProcedureMetrics` (false-commit/safe-completion/approval-burden) and the promotion gate; `sandbox_only` (L4) is the hand-off to the promotion gate.
- **Plan 7 (ClarityLoopBench)** scores baselines on the `CommitDecision`/`RunOutcome` this plan produces (false_commit_rate, approval_burden, evidence_coverage).
</content>
</invoke>
