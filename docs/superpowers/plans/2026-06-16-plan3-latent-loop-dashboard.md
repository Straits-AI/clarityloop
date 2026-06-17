# Latent Loop + Dashboard Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entropy-aware latent loop (Qwen structured latent-state extraction → deterministic `scoreEntropy` → SSE streaming) and the Vite + React + TypeScript + Tailwind dashboard whose hero visual is the live commit-entropy heatmap animating `0.82 → 0.44 → 0.18` over SSE. For this plan the loop is a minimal skeleton (extract → score → emit) that Plans 4–5 extend with tools and the commit gate without changing the SSE contract.

**Architecture:** Qwen returns *structure only* (validated by `LatentWorkflowStateSchema` via `generateStructured`); deterministic `scoreEntropy` computes all six entropy components — the model never emits a number. The run-loop scaffold in `apps/api` is an async generator (`runLatentLoop`) that yields `EntropyUpdate` frames, streamed over SSE via `hono/streaming`. A deterministic `demoEntropySequence()` drives the canonical hero animation now (no Qwen call), so the heatmap is demoable before the tool loop exists. The dashboard in `apps/web` is a pure client SPA that consumes the SSE stream through a `useEntropyStream` EventSource hook and imports shared types/schemas from `@clarityloop/core` (design spec §D2). The `EntropyUpdate` SSE payload is a new shared contract added to `@clarityloop/core` (zod-validated, since it crosses the SSE boundary).

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Vitest. API: Hono + `hono/streaming` (`streamSSE`) + `hono/cors`, `@clarityloop/core`, `@clarityloop/qwen`. Web: Vite 5, React 18, Tailwind CSS 3, `@vitejs/plugin-react`, `@testing-library/react` + `@testing-library/jest-dom` + `jsdom`, native `EventSource`. All tests use a **fake `ModelProvider`** and a **fake `EventSource`** — no live API, no network.

---

## Dependency & decoupling decision (read first)

- **Builds on Plan 1 only.** This plan consumes the as-built `@clarityloop/core` (`LatentWorkflowStateSchema`, `scoreEntropy`, `EntropyScore`), `@clarityloop/qwen` (`ModelProvider`, `generateStructured`), and the `apps/api` Hono factory. It does **not** require Plan 2.
- **WorkflowSpec decoupling.** Scope item (a) says "request + WorkflowSpec → LatentWorkflowState". To stay buildable on Plan 1 and keep the loop a thin skeleton, the extractor accepts a **narrow projection** of a `WorkflowSpec`: `{ request, workflowVersion, goal }`. When Plan 2/4 wire real generation, the HTTP handler maps a generated `WorkflowSpec` via `{ request, workflowVersion: spec.version, goal: spec.goal }`. No `WorkflowSpec` import is introduced here (YAGNI).
- **Contract additions to `@clarityloop/core`.** This plan adds `EntropyScoreSchema` (the zod schema matching the existing `EntropyScore` type; shared-contracts §8 nominally tagged it Plan 2 — defined here because Plan 3 builds directly on Plan 1 and must validate SSE payloads; identical shape, so Plan 2 imports rather than redefines) and `EntropyUpdateSchema`/`EntropyUpdate` (new; the SSE frame). Both must be back-ported into `2026-06-16-shared-contracts.md` per that doc's amendment rule.
- **Deterministic-over-structured invariant held.** The extractor strips any model-supplied `goal`/`workflowVersion` (via `.omit`) and re-sets them from code; `nextBestAction` is a nullable placeholder string until Plan 4's `selectNextBestAction`; every entropy number comes from `scoreEntropy`.

---

## File Structure

**Create:**
```
packages/core/src/stream.ts                         # EntropyUpdateSchema + EntropyUpdate
packages/core/src/stream.test.ts
apps/api/src/latent/extract.ts                      # extractLatentState + input schema
apps/api/src/latent/extract.test.ts
apps/api/src/latent/loop.ts                         # runLatentLoop (skeleton) + demoEntropySequence
apps/api/src/latent/loop.test.ts
apps/web/package.json
apps/web/tsconfig.json
apps/web/vite.config.ts
apps/web/vitest.config.ts
apps/web/index.html
apps/web/postcss.config.js
apps/web/tailwind.config.js
apps/web/src/main.tsx
apps/web/src/index.css
apps/web/src/test-setup.ts
apps/web/src/App.tsx
apps/web/src/App.test.tsx
apps/web/src/lib/entropyColor.ts
apps/web/src/lib/entropyColor.test.ts
apps/web/src/components/EntropyHeatmap.tsx
apps/web/src/components/EntropyHeatmap.test.tsx
apps/web/src/components/RequestPanel.tsx
apps/web/src/components/WorkflowPanel.tsx
apps/web/src/components/NextBestAction.tsx
apps/web/src/components/TraceView.tsx
apps/web/src/hooks/useEntropyStream.ts
apps/web/src/hooks/useEntropyStream.test.ts
docs/architecture.md
```

**Modify:**
```
packages/core/src/schemas.ts                        # add EntropyScoreSchema
packages/core/src/index.ts                          # export ./stream
apps/api/src/app.ts                                 # add cors + /runs/stream + /demo/entropy-stream
apps/api/src/app.test.ts                            # add two SSE route tests
README.md                                            # document web app + run loop + SSE
```

---

## Task 1: Core — `EntropyScoreSchema` + `EntropyUpdate` SSE contract

**Files:**
- Modify: `packages/core/src/schemas.ts`
- Create: `packages/core/src/stream.ts`
- Create: `packages/core/src/stream.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test for the stream contract**

`packages/core/src/stream.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { EntropyUpdateSchema, EntropyScoreSchema } from "./index";

const okState = {
  goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [],
  claims: [], riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
};
const okEntropy = {
  taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0,
  policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0.5,
};

describe("EntropyScoreSchema", () => {
  it("parses the six entropy components", () => {
    const e = EntropyScoreSchema.parse(okEntropy);
    expect(Object.keys(e).length).toBe(6);
    expect(e.commitEntropy).toBe(0.5);
  });
});

describe("EntropyUpdateSchema", () => {
  it("validates a well-formed entropy update", () => {
    const u = EntropyUpdateSchema.parse({
      step: 0, phase: "scored", state: okState, entropy: okEntropy,
      nextBestAction: "retrieve_memory", note: null,
    });
    expect(u.entropy.commitEntropy).toBe(0.5);
    expect(u.phase).toBe("scored");
    expect(u.nextBestAction).toBe("retrieve_memory");
  });

  it("rejects an unknown phase", () => {
    expect(() =>
      EntropyUpdateSchema.parse({
        step: 0, phase: "bogus", state: okState, entropy: okEntropy,
        nextBestAction: null, note: null,
      }),
    ).toThrow();
  });

  it("rejects a missing nextBestAction key (must be present, may be null)", () => {
    expect(() =>
      EntropyUpdateSchema.parse({
        step: 0, phase: "done", state: okState, entropy: okEntropy, note: null,
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `stream.test.ts` cannot resolve `EntropyUpdateSchema`/`EntropyScoreSchema` (not exported yet); message like `EntropyUpdateSchema is not a function` / import is `undefined`.

- [ ] **Step 3: Add `EntropyScoreSchema` to schemas**

Append to `packages/core/src/schemas.ts`:
```ts

/** Zod schema matching the existing `EntropyScore` type. Used to validate SSE payloads. */
export const EntropyScoreSchema = z.object({
  taskEntropy: z.number(),
  evidenceEntropy: z.number(),
  actionEntropy: z.number(),
  policyEntropy: z.number(),
  memoryEntropy: z.number(),
  commitEntropy: z.number(),
});
```

- [ ] **Step 4: Create the stream contract**

`packages/core/src/stream.ts`:
```ts
import { z } from "zod";
import { LatentWorkflowStateSchema, EntropyScoreSchema } from "./schemas";

/**
 * One frame streamed by the run loop over SSE.
 * Crosses the SSE boundary, so it is zod-validated on both ends.
 * `nextBestAction` is a nullable placeholder until Plan 4's selectNextBestAction.
 * `phase` covers the full loop lifecycle; Plan 3 emits only "scored" and "done",
 * Plans 4–5 begin emitting "extracted" / "acted" / "commit_decided".
 */
export const EntropyUpdateSchema = z.object({
  step: z.number().int().nonnegative(),
  phase: z.enum(["extracted", "scored", "acted", "commit_decided", "done"]),
  state: LatentWorkflowStateSchema,
  entropy: EntropyScoreSchema,
  nextBestAction: z.string().nullable(),
  note: z.string().nullable(),
});
export type EntropyUpdate = z.infer<typeof EntropyUpdateSchema>;
```

`packages/core/src/index.ts` — add the new export line (full file):
```ts
export const CLARITYLOOP_CORE_VERSION = "0.0.0";
export * from "./schemas";
export * from "./types";
export * from "./entropy";
export * from "./stream";
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS — `stream.test.ts` 4 passed; all core test files green (Test Files passing, no failures).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): EntropyScoreSchema and EntropyUpdate SSE stream contract"
```

---

## Task 2: API — Qwen structured latent-state extractor

**Files:**
- Create: `apps/api/src/latent/extract.ts`
- Create: `apps/api/src/latent/extract.test.ts`

- [ ] **Step 1: Write the failing test (fake provider)**

`apps/api/src/latent/extract.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractLatentState } from "./extract";
import type { ModelProvider } from "@clarityloop/qwen";

describe("extractLatentState", () => {
  it("returns a validated LatentWorkflowState with code-authoritative goal/version", async () => {
    const provider: ModelProvider = {
      async complete() {
        // Model TRIES to set goal/version + emits structure. goal/version must be overridden.
        return "```json\n" + JSON.stringify({
          goal: "MODEL TRIED TO SET THIS",
          workflowVersion: "model-version",
          knownFacts: [{ id: "f1", text: "customer ABC", confidence: 0.8 }],
          missingFields: [{ id: "m1", name: "exact_sku", necessity: "required" }],
          claims: [{ id: "c1", text: "unit price 100", evidencePointer: null }],
          riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
        }) + "\n```";
      },
    };
    const state = await extractLatentState(provider, {
      request: "same as last time, 120 cartons",
      workflowVersion: "v1",
      goal: "draft a customer quote",
    });
    expect(state.goal).toBe("draft a customer quote");   // code-set, not model
    expect(state.workflowVersion).toBe("v1");            // code-set, not model
    expect(state.missingFields[0].name).toBe("exact_sku");
    expect(state.claims[0].evidencePointer).toBeNull();
  });

  it("throws when the model omits required structure", async () => {
    const provider: ModelProvider = { async complete() { return '{"knownFacts":[]}'; } };
    await expect(
      extractLatentState(provider, { request: "r", workflowVersion: "v1", goal: "g" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/api test`
Expected: FAIL — cannot resolve `./extract` (`Failed to load url ./extract` / `Cannot find module './extract'`).

- [ ] **Step 3: Implement the extractor**

`apps/api/src/latent/extract.ts`:
```ts
import { z } from "zod";
import { LatentWorkflowStateSchema, type LatentWorkflowState } from "@clarityloop/core";
import { generateStructured, type ModelProvider } from "@clarityloop/qwen";

/** Narrow projection of a WorkflowSpec the loop needs (see plan's decoupling decision). */
export const LatentExtractionInputSchema = z.object({
  request: z.string(),
  workflowVersion: z.string(),
  goal: z.string(),
});
export type LatentExtractionInput = z.infer<typeof LatentExtractionInputSchema>;

// The model returns STRUCTURE only; goal + workflowVersion are authoritative from code.
const ExtractionSchema = LatentWorkflowStateSchema.omit({ goal: true, workflowVersion: true });

const SYSTEM_PROMPT = [
  "You are ClarityLoop's latent-state extractor.",
  "Read the business request and return ONLY a JSON object describing the structured latent state.",
  "Keys: knownFacts, missingFields, claims, riskFlags, policyFlags, staleMemoryRefs, toolFailures.",
  "- knownFacts: { id, text, confidence(0..1) } established directly from the request.",
  "- missingFields: { id, name, necessity: 'required'|'optional' } facts needed before committing.",
  "- claims: { id, text, evidencePointer } — set evidencePointer to null (no tool has run yet).",
  "- riskFlags: { id, kind, severity: 'low'|'medium'|'high' }.",
  "- policyFlags: { id, rule, ambiguous: boolean }.",
  "- staleMemoryRefs: string[]; toolFailures: string[].",
  "NEVER output any entropy, score, probability, or commit decision — code computes those.",
].join("\n");

export async function extractLatentState(
  provider: ModelProvider,
  input: LatentExtractionInput,
): Promise<LatentWorkflowState> {
  const structure = await generateStructured(provider, ExtractionSchema, {
    task: "extraction",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Workflow goal: ${input.goal}\n\nBusiness request:\n${input.request}` },
    ],
  });
  // Deterministic override: goal + version come from code, never the model.
  return LatentWorkflowStateSchema.parse({
    ...structure,
    goal: input.goal,
    workflowVersion: input.workflowVersion,
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/api test`
Expected: PASS — `extract.test.ts` 2 passed; existing `app.test.ts` still green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): Qwen structured latent-state extractor with code-authoritative goal/version"
```

---

## Task 3: API — run-loop scaffold + canonical demo sequence

**Files:**
- Create: `apps/api/src/latent/loop.ts`
- Create: `apps/api/src/latent/loop.test.ts`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/latent/loop.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runLatentLoop, demoEntropySequence } from "./loop";
import { EntropyUpdateSchema } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeState = {
  knownFacts: [{ id: "f1", text: "customer ABC", confidence: 0.9 }],
  missingFields: [{ id: "m1", name: "exact_sku", necessity: "required" }],
  claims: [{ id: "c1", text: "unit price 100", evidencePointer: null }],
  riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
};
const fakeProvider: ModelProvider = { async complete() { return JSON.stringify(fakeState); } };

describe("runLatentLoop", () => {
  it("extracts, scores, and emits entropy updates (fake provider)", async () => {
    const updates = [];
    for await (const u of runLatentLoop(fakeProvider, {
      request: "quote 120 cartons", workflowVersion: "v1", goal: "draft a customer quote",
    })) {
      updates.push(u);
    }
    expect(updates.length).toBe(2);
    expect(updates[0].state.goal).toBe("draft a customer quote"); // code-set
    expect(updates[0].state.workflowVersion).toBe("v1");
    // missing required (0.25) + 1/1 unsupported claim (0.25) = 0.5
    expect(updates[0].entropy.commitEntropy).toBeCloseTo(0.5, 5);
    expect(updates[0].phase).toBe("scored");
    expect(updates[updates.length - 1].phase).toBe("done");
    for (const u of updates) expect(EntropyUpdateSchema.safeParse(u).success).toBe(true);
  });
});

describe("demoEntropySequence", () => {
  it("emits a strictly decreasing commit-entropy sequence ending in done", () => {
    const seq = demoEntropySequence();
    expect(seq.length).toBe(4);
    for (const u of seq) expect(EntropyUpdateSchema.safeParse(u).success).toBe(true);
    const commits = seq.map((u) => u.entropy.commitEntropy);
    expect(commits[0]).toBeCloseTo(0.81875, 5); // ≈0.82
    expect(commits[1]).toBeCloseTo(0.44375, 5); // ≈0.44
    expect(commits[2]).toBeCloseTo(0.18125, 5); // ≈0.18
    expect(commits[0]).toBeGreaterThan(commits[1]);
    expect(commits[1]).toBeGreaterThan(commits[2]);
    expect(seq[3].phase).toBe("done");
    expect(seq[0].nextBestAction).toBe("retrieve_memory");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @clarityloop/api test`
Expected: FAIL — cannot resolve `./loop`.

- [ ] **Step 3: Implement the loop scaffold + demo sequence**

`apps/api/src/latent/loop.ts`:
```ts
import {
  scoreEntropy,
  type Claim,
  type LatentWorkflowState,
  type EntropyUpdate,
} from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import { extractLatentState, type LatentExtractionInput } from "./extract";

/**
 * Minimal run-loop scaffold: extract latent state -> score -> emit.
 * Plan 4 extends the body (select next-best-action, run a tool, re-score, loop)
 * WITHOUT changing the EntropyUpdate SSE contract or the heatmap.
 */
export async function* runLatentLoop(
  provider: ModelProvider,
  input: LatentExtractionInput,
): AsyncGenerator<EntropyUpdate> {
  const state = await extractLatentState(provider, input);
  const entropy = scoreEntropy(state);
  yield {
    step: 0, phase: "scored", state, entropy,
    nextBestAction: null,
    note: "initial latent state extracted and scored",
  };
  // --- Plan 4 extension point: tool loop iterations emit further "acted"/"scored" frames here ---
  yield {
    step: 1, phase: "done", state, entropy,
    nextBestAction: null,
    note: "skeleton loop complete — tool loop arrives in Plan 4",
  };
}

const claim = (id: string, supported: boolean): Claim => ({
  id, text: `claim ${id}`, evidencePointer: supported ? `e-${id}` : null,
});

const baseFacts = [{ id: "f1", text: "customer is ABC", confidence: 0.9 }];

// State A — high uncertainty: missing SKU, 7/8 claims unsupported, high risk, ambiguous policy.
// scoreEntropy = 0.25(missing) + 0.25*0.875(unsup) + 0.20(contra) + 0.15(policy) = 0.81875
const stateA: LatentWorkflowState = {
  goal: "draft a customer quote", workflowVersion: "quote-v1",
  knownFacts: baseFacts,
  missingFields: [{ id: "m1", name: "exact_sku", necessity: "required" }],
  claims: [claim("c1", true), claim("c2", false), claim("c3", false), claim("c4", false),
           claim("c5", false), claim("c6", false), claim("c7", false), claim("c8", false)],
  riskFlags: [{ id: "r1", kind: "supplier_mismatch", severity: "high" }],
  policyFlags: [{ id: "p1", rule: "discount_threshold", ambiguous: true }],
  staleMemoryRefs: [], toolFailures: [],
};

// State B — mid: SKU resolved, 3/8 claims unsupported, risk + ambiguous policy remain.
// scoreEntropy = 0.25*0.375(unsup) + 0.20(contra) + 0.15(policy) = 0.44375
const stateB: LatentWorkflowState = {
  goal: "draft a customer quote", workflowVersion: "quote-v1",
  knownFacts: [...baseFacts, { id: "f2", text: "likely SKU CTN-120", confidence: 0.8 }],
  missingFields: [],
  claims: [claim("c1", true), claim("c2", true), claim("c3", true), claim("c4", true),
           claim("c5", true), claim("c6", false), claim("c7", false), claim("c8", false)],
  riskFlags: [{ id: "r1", kind: "supplier_mismatch", severity: "high" }],
  policyFlags: [{ id: "p1", rule: "discount_threshold", ambiguous: true }],
  staleMemoryRefs: [], toolFailures: [],
};

// State C — low: only 1/8 claims unsupported, no risk, ambiguous policy remains.
// scoreEntropy = 0.25*0.125(unsup) + 0.15(policy) = 0.18125
const stateC: LatentWorkflowState = {
  goal: "draft a customer quote", workflowVersion: "quote-v1",
  knownFacts: [...baseFacts, { id: "f2", text: "likely SKU CTN-120", confidence: 0.8 },
               { id: "f3", text: "current catalog price confirmed", confidence: 0.95 }],
  missingFields: [],
  claims: [claim("c1", true), claim("c2", true), claim("c3", true), claim("c4", true),
           claim("c5", true), claim("c6", true), claim("c7", true), claim("c8", false)],
  riskFlags: [],
  policyFlags: [{ id: "p1", rule: "discount_threshold", ambiguous: true }],
  staleMemoryRefs: [], toolFailures: [],
};

/**
 * Deterministic canonical demo (memo §10): commit entropy ≈0.82 → ≈0.44 → ≈0.18.
 * Every number is produced by scoreEntropy on a real LatentWorkflowState — no hardcoded scores.
 * Drives the hero heatmap animation now; Plan 4 replaces the source with the real tool loop.
 */
export function demoEntropySequence(): EntropyUpdate[] {
  return [
    { step: 0, phase: "scored", state: stateA, entropy: scoreEntropy(stateA),
      nextBestAction: "retrieve_memory",
      note: "High uncertainty: exact SKU, current price, delivery evidence, supplier mismatch." },
    { step: 1, phase: "scored", state: stateB, entropy: scoreEntropy(stateB),
      nextBestAction: "lookup_catalog",
      note: "Resolved likely SKU & customer preference; price and stock still open." },
    { step: 2, phase: "scored", state: stateC, entropy: scoreEntropy(stateC),
      nextBestAction: "commit",
      note: "Safe to draft internally; approval required before external send." },
    { step: 3, phase: "done", state: stateC, entropy: scoreEntropy(stateC),
      nextBestAction: null, note: "Loop complete." },
  ];
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/api test`
Expected: PASS — `loop.test.ts` 2 passed; `extract.test.ts` and `app.test.ts` still green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(api): run-loop scaffold generator and deterministic demo entropy sequence"
```

---

## Task 4: API — SSE routes (`/runs/stream`, `/demo/entropy-stream`) + CORS

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Add failing route tests**

Replace `apps/api/src/app.test.ts` with (existing two tests preserved + two SSE tests added):
```ts
import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import type { ModelProvider } from "@clarityloop/qwen";

const fakeProvider: ModelProvider = { async complete() { return "ok"; } };

describe("api app", () => {
  it("GET /health returns ok", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("POST /score computes commit entropy deterministically", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [],
        claims: [{ id: "c1", text: "x", evidencePointer: null }],
        riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commitEntropy).toBeCloseTo(0.25, 5);
  });

  it("POST /runs/stream streams entropy updates as SSE (fake provider)", async () => {
    const provider: ModelProvider = {
      async complete() {
        return JSON.stringify({
          knownFacts: [],
          missingFields: [{ id: "m1", name: "sku", necessity: "required" }],
          claims: [{ id: "c1", text: "price", evidencePointer: null }],
          riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
        });
      },
    };
    const app = createApp({ provider });
    const res = await app.request("/runs/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "quote 120 cartons", workflowVersion: "v1", goal: "draft a quote" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: entropy");
    expect(text).toContain('"commitEntropy":0.5'); // 0.25 missing + 0.25 unsupported
    expect(text).toContain('"phase":"done"');
  });

  it("GET /demo/entropy-stream streams the canonical 0.82->0.44->0.18 sequence", async () => {
    const app = createApp({ provider: fakeProvider });
    const res = await app.request("/demo/entropy-stream?paceMs=0");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain('"commitEntropy":0.81875');
    expect(text).toContain('"commitEntropy":0.18125');
    expect(text).toContain('"phase":"done"');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @clarityloop/api test`
Expected: FAIL — both new tests fail: `/runs/stream` and `/demo/entropy-stream` return 404 (`res.status` is 404, `content-type` is not `text/event-stream`).

- [ ] **Step 3: Implement the routes**

Replace `apps/api/src/app.ts` with:
```ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { LatentWorkflowStateSchema, scoreEntropy } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import { LatentExtractionInputSchema, type LatentExtractionInput } from "./latent/extract";
import { runLatentLoop, demoEntropySequence } from "./latent/loop";

export type AppDeps = { provider: ModelProvider };

export function createApp(deps: AppDeps) {
  const app = new Hono();
  app.use("*", cors()); // dashboard may be served from a different origin (OSS static hosting)

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/score", async (c) => {
    const parsed = LatentWorkflowStateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(scoreEntropy(parsed.data));
  });

  // Smoke endpoint to prove live Qwen connectivity from the deployed environment.
  app.get("/qwen/ping", async (c) => {
    const reply = await deps.provider.complete(
      [{ role: "user", content: "reply with the single word ok" }],
      { task: "extraction" },
    );
    return c.json({ reply });
  });

  // Run-loop scaffold: extract latent state -> score -> stream each entropy update over SSE.
  app.post("/runs/stream", async (c) => {
    const body = LatentExtractionInputSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const input: LatentExtractionInput = body.data;
    return streamSSE(c, async (stream) => {
      for await (const update of runLatentLoop(deps.provider, input)) {
        await stream.writeSSE({ event: "entropy", id: String(update.step), data: JSON.stringify(update) });
      }
    });
  });

  // Deterministic canonical demo for the hero heatmap animation. No Qwen call.
  // paceMs query param controls inter-frame delay (default 350ms; tests pass 0).
  app.get("/demo/entropy-stream", (c) => {
    const pace = Number(c.req.query("paceMs") ?? process.env.SSE_PACE_MS ?? 350);
    return streamSSE(c, async (stream) => {
      for (const update of demoEntropySequence()) {
        await stream.writeSSE({ event: "entropy", id: String(update.step), data: JSON.stringify(update) });
        if (pace > 0) await stream.sleep(pace);
      }
    });
  });

  return app;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/api test`
Expected: PASS — all `app.test.ts` (4), `extract.test.ts` (2), `loop.test.ts` (2) green.

- [ ] **Step 5: Typecheck the API**

Run: `pnpm --filter @clarityloop/api typecheck`
Expected: PASS — `tsc` exits 0, no output.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(api): SSE run-loop and demo entropy stream routes with CORS"
```

> **Deferred / human-gated:** validating `/runs/stream` against the **live** DashScope provider needs `DASHSCOPE_API_KEY` (Phase 0). Smoke it manually later with
> `DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY pnpm --filter @clarityloop/api dev` then
> `curl -N -X POST localhost:8080/runs/stream -H 'content-type: application/json' -d '{"request":"same as last time, 120 cartons","workflowVersion":"v1","goal":"draft a quote"}'`.

---

## Task 5: Web — scaffold Vite + React + TypeScript + Tailwind (buildable)

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/vitest.config.ts`
- Create: `apps/web/index.html`, `apps/web/postcss.config.js`, `apps/web/tailwind.config.js`
- Create: `apps/web/src/main.tsx`, `apps/web/src/index.css`, `apps/web/src/test-setup.ts`
- Create: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

- [ ] **Step 1: Create the package + config files**

`apps/web/package.json`:
```json
{
  "name": "@clarityloop/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@clarityloop/core": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "noEmit": true
  },
  "include": ["src"]
}
```

`apps/web/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@clarityloop/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/runs": "http://localhost:8080",
      "/demo": "http://localhost:8080",
      "/score": "http://localhost:8080",
      "/qwen": "http://localhost:8080",
    },
  },
  build: { outDir: "dist" },
});
```

`apps/web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@clarityloop/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ClarityLoop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/postcss.config.js`:
```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

`apps/web/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

`apps/web/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`apps/web/src/test-setup.ts`:
```ts
import "@testing-library/jest-dom";
```

`apps/web/src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Write the failing smoke test**

`apps/web/src/App.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the ClarityLoop title", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "ClarityLoop" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Install deps and run the test to verify it fails**

Run: `pnpm install`
Then: `pnpm --filter @clarityloop/web test`
Expected: FAIL — cannot resolve `./App` (`Failed to load url ./App`).

- [ ] **Step 4: Implement the minimal App**

`apps/web/src/App.tsx`:
```tsx
export default function App() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <h1 className="text-2xl font-bold text-slate-900">ClarityLoop</h1>
      <p className="text-slate-500">Uncertainty-guided autopilot dashboard</p>
    </main>
  );
}
```

- [ ] **Step 5: Run test, typecheck, and production build**

Run: `pnpm --filter @clarityloop/web test`
Expected: PASS — `App.test.tsx` 1 passed.

Run: `pnpm --filter @clarityloop/web typecheck`
Expected: PASS — `tsc` exits 0, no output.

Run: `pnpm --filter @clarityloop/web build`
Expected: PASS — Vite prints `vite vX.Y.Z building for production...`, `✓ built in <n>s`, emits `apps/web/dist/index.html` + `dist/assets/*`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold Vite + React + TypeScript + Tailwind dashboard"
```

---

## Task 6: Web — `entropyColor` heat mapping (pure)

**Files:**
- Create: `apps/web/src/lib/entropyColor.ts`
- Create: `apps/web/src/lib/entropyColor.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/entropyColor.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { entropyColor } from "./entropyColor";

describe("entropyColor", () => {
  it("maps low entropy to green and high to red", () => {
    expect(entropyColor(0)).toBe("hsl(120, 70%, 45%)");
    expect(entropyColor(1)).toBe("hsl(0, 70%, 45%)");
    expect(entropyColor(0.5)).toBe("hsl(60, 70%, 45%)");
  });

  it("clamps out-of-range values", () => {
    expect(entropyColor(-1)).toBe("hsl(120, 70%, 45%)");
    expect(entropyColor(2)).toBe("hsl(0, 70%, 45%)");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/web test`
Expected: FAIL — cannot resolve `./entropyColor`.

- [ ] **Step 3: Implement**

`apps/web/src/lib/entropyColor.ts`:
```ts
/** Maps an entropy component (0..1) to an HSL heat color: green(low) -> red(high). */
export function entropyColor(value: number): string {
  const v = Math.max(0, Math.min(1, value));
  const hue = Math.round((1 - v) * 120); // 120=green at 0, 0=red at 1
  return `hsl(${hue}, 70%, 45%)`;
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/web test`
Expected: PASS — `entropyColor.test.ts` 2 passed; `App.test.tsx` still green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): entropyColor heat mapping helper"
```

---

## Task 7: Web — `EntropyHeatmap` component (the hero visual)

**Files:**
- Create: `apps/web/src/components/EntropyHeatmap.tsx`
- Create: `apps/web/src/components/EntropyHeatmap.test.tsx`

- [ ] **Step 1: Write the failing component test**

`apps/web/src/components/EntropyHeatmap.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntropyHeatmap } from "./EntropyHeatmap";
import type { EntropyScore } from "@clarityloop/core";

const entropy: EntropyScore = {
  taskEntropy: 1, evidenceEntropy: 0.875, actionEntropy: 0.9,
  policyEntropy: 1, memoryEntropy: 0, commitEntropy: 0.82,
};

describe("EntropyHeatmap", () => {
  it("renders the commit entropy and all six component cells", () => {
    render(<EntropyHeatmap entropy={entropy} history={[0.82, 0.44, 0.18]} />);
    expect(screen.getByTestId("heatmap-commit").textContent).toBe("0.82");
    for (const key of [
      "taskEntropy", "evidenceEntropy", "actionEntropy",
      "policyEntropy", "memoryEntropy", "commitEntropy",
    ]) {
      expect(screen.getByTestId(`cell-${key}`)).toBeInTheDocument();
    }
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByTestId("heatmap-history").children.length).toBe(3);
  });

  it("colors a high-entropy cell differently from a zero-entropy cell", () => {
    render(<EntropyHeatmap entropy={entropy} history={[]} />);
    const high = screen.getByTestId("cell-policyEntropy").style.backgroundColor; // value 1
    const low = screen.getByTestId("cell-memoryEntropy").style.backgroundColor;  // value 0
    expect(high).not.toBe(low);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/web test`
Expected: FAIL — cannot resolve `./EntropyHeatmap`.

- [ ] **Step 3: Implement the component**

`apps/web/src/components/EntropyHeatmap.tsx`:
```tsx
import type { EntropyScore } from "@clarityloop/core";
import { entropyColor } from "../lib/entropyColor";

const COMPONENTS: { key: keyof EntropyScore; label: string }[] = [
  { key: "taskEntropy", label: "Task" },
  { key: "evidenceEntropy", label: "Evidence" },
  { key: "actionEntropy", label: "Action" },
  { key: "policyEntropy", label: "Policy" },
  { key: "memoryEntropy", label: "Memory" },
  { key: "commitEntropy", label: "Commit" },
];

export function EntropyHeatmap({ entropy, history }: { entropy: EntropyScore; history: number[] }) {
  return (
    <section className="rounded-xl bg-slate-900 p-5 text-slate-100" data-testid="entropy-heatmap">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Commit Entropy</h2>
        <span data-testid="heatmap-commit" className="text-4xl font-bold tabular-nums">
          {entropy.commitEntropy.toFixed(2)}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {COMPONENTS.map(({ key, label }) => (
          <div
            key={key}
            data-testid={`cell-${key}`}
            className="rounded-lg p-3"
            style={{ backgroundColor: entropyColor(entropy[key]) }}
          >
            <div className="text-xs font-medium text-slate-900/80">{label}</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">{entropy[key].toFixed(2)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-16 items-end gap-1" data-testid="heatmap-history">
        {history.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.round(v * 100)}%`, backgroundColor: entropyColor(v) }}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/web test`
Expected: PASS — `EntropyHeatmap.test.tsx` 2 passed; all web tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): EntropyHeatmap component with live commit-entropy hero"
```

---

## Task 8: Web — `useEntropyStream` SSE client hook

**Files:**
- Create: `apps/web/src/hooks/useEntropyStream.ts`
- Create: `apps/web/src/hooks/useEntropyStream.test.ts`

- [ ] **Step 1: Write the failing test (fake EventSource)**

`apps/web/src/hooks/useEntropyStream.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useEntropyStream } from "./useEntropyStream";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  listeners: Record<string, ((e: unknown) => void)[]> = {};
  onerror: ((e: unknown) => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: unknown) => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  emit(type: string, data: unknown) {
    for (const cb of this.listeners[type] ?? []) cb({ data: JSON.stringify(data) });
  }
  close() {
    this.closed = true;
  }
}

const update = (step: number, phase: string, commit: number) => ({
  step,
  phase,
  state: {
    goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [], claims: [],
    riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
  },
  entropy: {
    taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0,
    policyEntropy: 0, memoryEntropy: 0, commitEntropy: commit,
  },
  nextBestAction: null,
  note: null,
});

describe("useEntropyStream", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  });

  it("accumulates updates and ends on the done phase", async () => {
    const { result } = renderHook(() => useEntropyStream("/demo/entropy-stream"));
    const es = FakeEventSource.instances[0];
    act(() => es.emit("entropy", update(0, "scored", 0.82)));
    act(() => es.emit("entropy", update(1, "done", 0.18)));
    await waitFor(() => expect(result.current.status).toBe("done"));
    expect(result.current.updates.length).toBe(2);
    expect(result.current.latest?.entropy.commitEntropy).toBe(0.18);
    expect(es.closed).toBe(true);
  });

  it("is idle and opens no connection for a null url", () => {
    const { result } = renderHook(() => useEntropyStream(null));
    expect(result.current.status).toBe("idle");
    expect(FakeEventSource.instances.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/web test`
Expected: FAIL — cannot resolve `./useEntropyStream`.

- [ ] **Step 3: Implement the hook**

`apps/web/src/hooks/useEntropyStream.ts`:
```ts
import { useEffect, useState } from "react";
import { EntropyUpdateSchema, type EntropyUpdate } from "@clarityloop/core";

export type StreamStatus = "idle" | "streaming" | "done" | "error";

export function useEntropyStream(url: string | null) {
  const [updates, setUpdates] = useState<EntropyUpdate[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");

  useEffect(() => {
    if (!url) {
      setStatus("idle");
      return;
    }
    setUpdates([]);
    setStatus("streaming");
    const es = new EventSource(url);
    es.addEventListener("entropy", (event) => {
      const parsed = EntropyUpdateSchema.safeParse(JSON.parse((event as MessageEvent).data));
      if (!parsed.success) return;
      setUpdates((prev) => [...prev, parsed.data]);
      if (parsed.data.phase === "done") {
        setStatus("done");
        es.close();
      }
    });
    es.onerror = () => {
      setStatus("error");
      es.close();
    };
    return () => es.close();
  }, [url]);

  const latest = updates.length > 0 ? updates[updates.length - 1] : null;
  return { updates, latest, status };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @clarityloop/web test`
Expected: PASS — `useEntropyStream.test.ts` 2 passed; all web tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): useEntropyStream SSE client hook (EventSource)"
```

---

## Task 9: Web — panels + App composition + full verification

**Files:**
- Create: `apps/web/src/components/RequestPanel.tsx`, `WorkflowPanel.tsx`, `NextBestAction.tsx`, `TraceView.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/App.test.tsx`

- [ ] **Step 1: Extend the failing App test**

Replace `apps/web/src/App.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the dashboard panels", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "ClarityLoop" })).toBeInTheDocument();
    expect(screen.getByTestId("entropy-heatmap")).toBeInTheDocument();
    expect(screen.getByText("Input Request")).toBeInTheDocument();
    expect(screen.getByText("Generated Workflow")).toBeInTheDocument();
    expect(screen.getByText("Next Best Action")).toBeInTheDocument();
    expect(screen.getByText("Trace")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clarityloop/web test`
Expected: FAIL — `App.test.tsx` fails: `getByTestId("entropy-heatmap")` throws (the Task 5 App has no panels yet).

- [ ] **Step 3: Implement the panels**

`apps/web/src/components/RequestPanel.tsx`:
```tsx
import type { StreamStatus } from "../hooks/useEntropyStream";

const SAMPLE = "Same as last time, need 120 cartons urgently next week. Supplier quote attached.";

export function RequestPanel({ onRun, status }: { onRun: () => void; status: StreamStatus }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Input Request</h2>
      <p className="rounded-lg bg-slate-50 p-3 text-slate-800">{SAMPLE}</p>
      <button
        onClick={onRun}
        disabled={status === "streaming"}
        className="mt-3 rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
      >
        {status === "streaming" ? "Running..." : "Run ClarityLoop"}
      </button>
    </section>
  );
}
```

`apps/web/src/components/WorkflowPanel.tsx`:
```tsx
export function WorkflowPanel({ steps }: { steps: { id: string; name: string }[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Generated Workflow</h2>
      <p className="mb-3 text-xs text-slate-400">Qwen-generated WorkflowSpec (wired in Plan 2)</p>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-2 text-slate-800">
            <span className="font-mono text-slate-400">{i + 1}.</span>
            {s.name}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

`apps/web/src/components/NextBestAction.tsx`:
```tsx
export function NextBestAction({ action, note }: { action: string | null; note: string | null }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Next Best Action</h2>
      <p className="text-lg font-semibold text-slate-900">{action ?? "— (loop idle)"}</p>
      {note ? <p className="mt-1 text-sm text-slate-500">{note}</p> : null}
      <p className="mt-2 text-xs text-slate-400">Scored selection arrives in Plan 4 (selectNextBestAction).</p>
    </section>
  );
}
```

`apps/web/src/components/TraceView.tsx`:
```tsx
import type { EntropyUpdate } from "@clarityloop/core";

export function TraceView({ updates }: { updates: EntropyUpdate[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Trace</h2>
      {updates.length === 0 ? (
        <p className="text-slate-400">No steps yet. Run ClarityLoop to stream the loop.</p>
      ) : (
        <ol className="space-y-1 font-mono text-sm">
          {updates.map((u) => (
            <li key={u.step} className="flex justify-between text-slate-700">
              <span>
                #{u.step} {u.phase}
              </span>
              <span className="tabular-nums">commit {u.entropy.commitEntropy.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Compose the App**

Replace `apps/web/src/App.tsx`:
```tsx
import { useState } from "react";
import type { EntropyScore } from "@clarityloop/core";
import { useEntropyStream } from "./hooks/useEntropyStream";
import { EntropyHeatmap } from "./components/EntropyHeatmap";
import { RequestPanel } from "./components/RequestPanel";
import { WorkflowPanel } from "./components/WorkflowPanel";
import { NextBestAction } from "./components/NextBestAction";
import { TraceView } from "./components/TraceView";

const ZERO_ENTROPY: EntropyScore = {
  taskEntropy: 0, evidenceEntropy: 0, actionEntropy: 0,
  policyEntropy: 0, memoryEntropy: 0, commitEntropy: 0,
};

const DEMO_WORKFLOW = [
  { id: "s1", name: "parse_request" },
  { id: "s2", name: "retrieve_memory" },
  { id: "s3", name: "lookup_catalog + check_stock" },
  { id: "s4", name: "compare_quote" },
  { id: "s5", name: "draft_quote" },
  { id: "s6", name: "commit_gate" },
];

export default function App() {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const { updates, latest, status } = useEntropyStream(streamUrl);
  const history = updates.map((u) => u.entropy.commitEntropy);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">ClarityLoop</h1>
        <p className="text-slate-500">Uncertainty-guided autopilot — live entropy loop</p>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          {/* cache-busting query forces the effect to reconnect on each Run */}
          <RequestPanel onRun={() => setStreamUrl(`/demo/entropy-stream?ts=${Date.now()}`)} status={status} />
          <WorkflowPanel steps={DEMO_WORKFLOW} />
        </div>
        <div className="space-y-4">
          <EntropyHeatmap entropy={latest?.entropy ?? ZERO_ENTROPY} history={history} />
          <NextBestAction action={latest?.nextBestAction ?? null} note={latest?.note ?? null} />
        </div>
        <div className="space-y-4">
          <TraceView updates={updates} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run web test, typecheck, build**

Run: `pnpm --filter @clarityloop/web test`
Expected: PASS — `App.test.tsx` 1 passed; all web test files green (App, entropyColor, EntropyHeatmap, useEntropyStream).

Run: `pnpm --filter @clarityloop/web typecheck`
Expected: PASS — `tsc` exits 0, no output.

Run: `pnpm --filter @clarityloop/web build`
Expected: PASS — `✓ built in <n>s`, `apps/web/dist/` emitted.

- [ ] **Step 6: Full-monorepo verification**

Run: `pnpm test`
Expected: PASS — turbo runs every package: `@clarityloop/core`, `@clarityloop/qwen`, `@clarityloop/storage`, `@clarityloop/api`, `@clarityloop/web` — all test files green, 0 failed.

Run: `pnpm typecheck`
Expected: PASS — all packages typecheck, `tsc` exits 0.

Run: `pnpm build`
Expected: PASS — all packages build, including `apps/web` Vite bundle.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): compose dashboard panels with live SSE entropy stream"
```

---

## Task 10: Docs — README + architecture note

**Files:**
- Modify: `README.md`
- Create: `docs/architecture.md`

- [ ] **Step 1: Add the architecture technical doc**

`docs/architecture.md`:
```markdown
# ClarityLoop Architecture (as built)

## Packages
- **@clarityloop/core** — pure deterministic kernel: zod schemas + types
  (`LatentWorkflowState`, `EntropyScore`), `scoreEntropy(state)`, and the
  `EntropyUpdate` SSE contract (`EntropyUpdateSchema`). No cloud or I/O deps.
- **@clarityloop/qwen** — `ModelProvider` interface, DashScope client,
  `generateStructured` (zod-validated JSON). The model emits structure only.
- **@clarityloop/storage** — `ArtifactStore` (in-memory + OSS/S3). Repositories land in Plan 2.

## Apps
- **apps/api** — Hono server. Composition layer for the run loop:
  - `latent/extract.ts` — `extractLatentState(provider, { request, workflowVersion, goal })`
    calls Qwen for structure; goal/version are set by code, never the model.
  - `latent/loop.ts` — `runLatentLoop` async generator (extract → score → emit);
    `demoEntropySequence()` is the deterministic canonical demo (commit entropy
    ≈0.82 → ≈0.44 → ≈0.18, every value from `scoreEntropy`).
  - Routes: `POST /runs/stream` (SSE of the real loop), `GET /demo/entropy-stream`
    (SSE of the canonical demo). Both emit `event: entropy` frames validated by
    `EntropyUpdateSchema`.
- **apps/web** — Vite + React + Tailwind SPA. `useEntropyStream(url)` consumes the SSE
  stream via `EventSource`; `EntropyHeatmap` is the hero visual; panels: input request,
  generated workflow (placeholder until Plan 2), next-best-action (placeholder until
  Plan 4), trace view. Shared types import from `@clarityloop/core`.

## Run loop (Plan 3 skeleton; Plans 4–5 extend without changing the SSE contract)
```
request + {workflowVersion, goal}
  → Qwen latent-state extraction (structure only)
  → scoreEntropy (deterministic, six components)
  → EntropyUpdate frame over SSE  ──► dashboard heatmap animates
  → (Plan 4: select next-best-action → tool → re-score → loop)
  → (Plan 5: commit gate)
```

## Invariant
Qwen emits structure; deterministic TypeScript computes every entropy number and decision.
```

- [ ] **Step 2: Update the README**

Add a section to `README.md` documenting: the `apps/web` dashboard, how to run it
(`pnpm --filter @clarityloop/api dev` + `pnpm --filter @clarityloop/web dev`, Vite proxy to `:8080`),
the SSE endpoints (`POST /runs/stream`, `GET /demo/entropy-stream`), and a link to
`docs/architecture.md`. Keep wording consistent with the existing README structure.

- [ ] **Step 3: Verify docs reference real paths**

Run: `ls apps/web/src/components/EntropyHeatmap.tsx apps/api/src/latent/loop.ts docs/architecture.md`
Expected: all three paths listed (exist).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: architecture note and README update for latent loop + dashboard"
```

---

## Self-Review

**Spec coverage (Plan 3 = design spec §5 run loop, §10 UI, §12 Phase 3):**

| Scope item | Task(s) |
|---|---|
| (a) Qwen structured latent-state extraction (request + WorkflowSpec → LatentWorkflowState via `generateStructured`) | Task 2 (`extractLatentState`, narrow WorkflowSpec projection) |
| (b) run-loop scaffold: extract → score (`scoreEntropy`) → stream each entropy update over SSE | Task 3 (`runLatentLoop`) + Task 4 (`/runs/stream` via `streamSSE`) |
| (c) Vite + React + TS + Tailwind dashboard: input request, generated workflow, **live entropy heatmap (0.82→0.44→0.18 via SSE)**, next-best-action placeholder, trace view | Task 5 (scaffold), Task 7 (`EntropyHeatmap`), Task 9 (panels + App); animation source Task 3 `demoEntropySequence` + Task 4 `/demo/entropy-stream` |
| (d) SSE client hook | Task 8 (`useEntropyStream`) |
| Tests: api loop scaffold with fake provider | Task 2, Task 3, Task 4 (all use a fake `ModelProvider`) |
| Tests: component/unit test for the heatmap given entropy values | Task 7 (`EntropyHeatmap.test.tsx`) |
| Web buildable (`vite build`) + typechecked | Task 5 Step 5, Task 9 Steps 5–6 |
| Shared `EntropyUpdate` contract (crosses SSE boundary) | Task 1 (`EntropyUpdateSchema` in `@clarityloop/core`) |

**Placeholder scan:** No `TODO`/`TBD`/"similar to above". Every code block is complete and runnable. The two *labelled* product placeholders — `WorkflowPanel` ("wired in Plan 2") and `NextBestAction` ("Plan 4 selectNextBestAction") — are honest UI copy, not unfinished code; both render real components with real props. `runLatentLoop` has a commented Plan-4 extension point but is fully functional as a 2-frame skeleton.

**Type-consistency note:** `LatentWorkflowState`, `EntropyScore`, `scoreEntropy`, `ModelProvider.complete(messages, { task })`, `generateStructured(provider, schema, { task, messages })` are used verbatim from the as-built Plan 1 packages. New `EntropyUpdate`/`EntropyUpdateSchema` and `EntropyScoreSchema` live in `@clarityloop/core` and are imported identically by `apps/api` (loop + routes) and `apps/web` (hook + components). `phase` enum and `nextBestAction: string | null` match across producer (`loop.ts`, `demoEntropySequence`) and consumer (`useEntropyStream`, `TraceView`). The `LatentExtractionInput = { request, workflowVersion, goal }` projection is the single input shape for `extractLatentState`, `runLatentLoop`, and `POST /runs/stream` (`LatentExtractionInputSchema`).

**Live/human-gated steps (deferred):** validating `/runs/stream` against the real DashScope provider (needs `DASHSCOPE_API_KEY`, Phase 0) — noted in Task 4; serving the built `apps/web/dist` from the API container or OSS static hosting — Plan 7 polish. All in-plan tests use a fake `ModelProvider` and a fake `EventSource`; no live calls.

**Contract additions to back-port** into `2026-06-16-shared-contracts.md` (per its own amendment rule): `EntropyScoreSchema` (§8 — defined here, Plan 2 imports it) and `EntropyUpdateSchema`/`EntropyUpdate` (new §8a — the SSE frame).

---

## What later plans depend on this one

- **Plan 4 (tools + next-best-action):** extends `runLatentLoop`'s body (insert tool steps → re-score → emit) and replaces `/demo/entropy-stream`'s source with the real multi-step loop. The `EntropyUpdate` SSE contract, `useEntropyStream` hook, and `EntropyHeatmap`/`TraceView` stay unchanged; `NextBestAction` becomes driven by `selectNextBestAction` instead of the placeholder string. New `phase` values `"acted"`/`"commit_decided"` are already in the enum.
- **Plan 5 (commit gate + approval):** emits a `"commit_decided"` frame and adds a commit-gate panel to the dashboard alongside the existing heatmap.
- **Plan 2 (persistence):** `POST /runs/stream` gains `RunRepository`/`TraceRepository` writes (each `EntropyUpdate` → a `TraceStep`); the `LatentExtractionInput` projection is fed from a generated `WorkflowSpec` (`{ request, workflowVersion: spec.version, goal: spec.goal }`).
- **Plan 7 (demo polish):** the three-column Baseline | ClarityLoop | Promotion layout builds on these panels; `apps/web/dist` is deployed.
