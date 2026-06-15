# Foundation & Alibaba Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the ClarityLoop monorepo, the deterministic entropy core, the cloud-portability seams (storage + DB + Qwen), and a Hono API deployed and running on Alibaba Cloud ECS — the foundation every later phase builds on.

**Architecture:** TypeScript monorepo (pnpm + Turborepo). `packages/core` holds pure, unit-tested deterministic logic (types + entropy scorer) with zero cloud dependencies. `packages/storage` and `packages/qwen` are interface-first adapters so the same code runs on Alibaba (OSS + Postgres + DashScope) or Cloudflare later. `apps/api` is a Hono server, containerized with Docker, deployed to an Alibaba ECS instance.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Vitest (test), Zod (validation), Hono (API), OpenAI SDK (DashScope client), `@aws-sdk/client-s3` (OSS via S3-compatible API), `pg` (Postgres), Docker + Docker Compose, Alibaba Cloud ECS + OSS + Model Studio.

---

## Phase 0 — Alibaba Cloud + Qwen onboarding (CRITICAL PATH, START IMMEDIATELY)

These are human actions, not code. They gate the mandatory "proof of Alibaba deployment" and can take days (KYC, billing, region enablement from Malaysia). Do them **in parallel** with Task 1 onward — do not wait.

- [ ] **P0.1** Create an Alibaba Cloud international account at https://www.alibabacloud.com and complete identity/KYC verification.
- [ ] **P0.2** Add a payment method and confirm any hackathon Qwen Cloud credits are applied (check the Devpost resources page for the credit-redemption link/code).
- [ ] **P0.3** Enable **Model Studio** (Bailian) in the console; create a **DashScope API key**. Record it as `DASHSCOPE_API_KEY` in a password manager (NOT in git).
- [ ] **P0.4** Verify the key works from your laptop:
  Run: `curl -s -X POST "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" -H "Authorization: Bearer $DASHSCOPE_API_KEY" -H "Content-Type: application/json" -d '{"model":"qwen-plus","messages":[{"role":"user","content":"reply with the single word ok"}]}'`
  Expected: a JSON response whose `choices[0].message.content` contains `ok`. (Note the `-intl` endpoint for the international account; the China endpoint is `dashscope.aliyuncs.com`.)
- [ ] **P0.5** Create an **OSS bucket** named `clarityloop-artifacts` in your chosen region (e.g. `ap-southeast-1` Singapore — low latency from Malaysia). Create a RAM user with OSS read/write, record `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, `OSS_ENDPOINT` (e.g. `https://oss-ap-southeast-1.aliyuncs.com`), `OSS_REGION`.
- [ ] **P0.6** Create a small **ECS instance** (e.g. `ecs.e-c1m1.large`, 2 vCPU / 2–4 GB, Ubuntu 22.04) in the same region. Assign a public IP. In its **security group**, open inbound TCP **22** (SSH, your IP only) and **8080** (API, 0.0.0.0/0 for the demo).
- [ ] **P0.7** SSH in and install Docker + Docker Compose plugin:
  Run on ECS: `curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER` then re-login.
- [ ] **P0.8** Capture a screenshot of the running ECS instance (console, showing region + public IP) for the deployment-proof doc. Deployment proof is finalized in Task 8.

---

## Task 1: Monorepo scaffold + tooling

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.nvmrc`
- Create: `vitest.config.ts`, `packages/core/package.json`, `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`, `packages/core/src/sanity.test.ts`

- [ ] **Step 1: Create the root workspace files**

`package.json`:
```json
{
  "name": "clarityloop",
  "private": true,
  "packageManager": "pnpm@9.7.0",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`.nvmrc`:
```
20
```

`turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vitest/globals"]
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true, environment: "node" },
});
```

- [ ] **Step 2: Create the `core` package skeleton**

`packages/core/package.json`:
```json
{
  "name": "@clarityloop/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "zod": "^3.23.0" }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

`packages/core/src/index.ts`:
```ts
export const CLARITYLOOP_CORE_VERSION = "0.0.0";
```

`packages/core/src/sanity.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { CLARITYLOOP_CORE_VERSION } from "./index";

describe("core sanity", () => {
  it("exports a version string", () => {
    expect(typeof CLARITYLOOP_CORE_VERSION).toBe("string");
  });
});
```

- [ ] **Step 3: Install and run the test harness**

Run: `pnpm install && pnpm test`
Expected: turbo runs `@clarityloop/core` test; `sanity.test.ts` PASSES (1 passed).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm+turbo monorepo with core package and vitest"
```

---

## Task 2: Core domain types + Zod schemas

**Files:**
- Create: `packages/core/src/types.ts` (TS types adopted from spec §6 / memo §14)
- Create: `packages/core/src/schemas.ts` (Zod schemas for Qwen-produced structures)
- Create: `packages/core/src/schemas.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test for the latent-state schema**

`packages/core/src/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { LatentWorkflowStateSchema } from "./schemas";

describe("LatentWorkflowStateSchema", () => {
  it("parses a minimal valid latent state", () => {
    const parsed = LatentWorkflowStateSchema.parse({
      goal: "quote 120 cartons",
      workflowVersion: "v1",
      knownFacts: [{ id: "f1", text: "customer is ABC", confidence: 0.9 }],
      missingFields: [{ id: "m1", name: "exact_sku", necessity: "required" }],
      claims: [{ id: "c1", text: "price is 100", evidencePointer: null }],
      riskFlags: [],
      policyFlags: [],
      staleMemoryRefs: [],
      toolFailures: [],
    });
    expect(parsed.missingFields[0].name).toBe("exact_sku");
  });

  it("rejects a claim missing the evidencePointer key", () => {
    expect(() =>
      LatentWorkflowStateSchema.parse({
        goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [],
        claims: [{ id: "c1", text: "x" }], riskFlags: [], policyFlags: [],
        staleMemoryRefs: [], toolFailures: [],
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './schemas'`.

- [ ] **Step 3: Write the schemas**

`packages/core/src/schemas.ts`:
```ts
import { z } from "zod";

export const FactSchema = z.object({
  id: z.string(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
});

export const MissingFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  necessity: z.enum(["required", "optional"]),
});

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  // null = unsupported. A string = an evidence reference id.
  evidencePointer: z.string().nullable(),
});

export const RiskFlagSchema = z.object({
  id: z.string(),
  kind: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});

export const PolicyFlagSchema = z.object({
  id: z.string(),
  rule: z.string(),
  ambiguous: z.boolean(),
});

export const LatentWorkflowStateSchema = z.object({
  goal: z.string(),
  workflowVersion: z.string(),
  knownFacts: z.array(FactSchema),
  missingFields: z.array(MissingFieldSchema),
  claims: z.array(ClaimSchema),
  riskFlags: z.array(RiskFlagSchema),
  policyFlags: z.array(PolicyFlagSchema),
  staleMemoryRefs: z.array(z.string()),
  toolFailures: z.array(z.string()),
});
```

- [ ] **Step 4: Add derived TS types**

`packages/core/src/types.ts`:
```ts
import { z } from "zod";
import {
  FactSchema, MissingFieldSchema, ClaimSchema, RiskFlagSchema,
  PolicyFlagSchema, LatentWorkflowStateSchema,
} from "./schemas";

export type Fact = z.infer<typeof FactSchema>;
export type MissingField = z.infer<typeof MissingFieldSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type RiskFlag = z.infer<typeof RiskFlagSchema>;
export type PolicyFlag = z.infer<typeof PolicyFlagSchema>;
export type LatentWorkflowState = z.infer<typeof LatentWorkflowStateSchema>;

export type EntropyScore = {
  taskEntropy: number;
  evidenceEntropy: number;
  actionEntropy: number;
  policyEntropy: number;
  memoryEntropy: number;
  commitEntropy: number;
};
```

`packages/core/src/index.ts`:
```ts
export const CLARITYLOOP_CORE_VERSION = "0.0.0";
export * from "./schemas";
export * from "./types";
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS (3 passed total — sanity + 2 schema tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): add latent-state Zod schemas and domain types"
```

---

## Task 3: Deterministic entropy scorer (the credibility backbone)

**Files:**
- Create: `packages/core/src/entropy.ts`
- Create: `packages/core/src/entropy.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests for the scorer**

`packages/core/src/entropy.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { scoreEntropy } from "./entropy";
import type { LatentWorkflowState } from "./types";

const empty: LatentWorkflowState = {
  goal: "g", workflowVersion: "v1", knownFacts: [], missingFields: [],
  claims: [], riskFlags: [], policyFlags: [], staleMemoryRefs: [], toolFailures: [],
};

describe("scoreEntropy", () => {
  it("returns zero commit entropy for a fully-resolved state", () => {
    const s = scoreEntropy({
      ...empty,
      knownFacts: [{ id: "f1", text: "x", confidence: 1 }],
      claims: [{ id: "c1", text: "price 100", evidencePointer: "e1" }],
    });
    expect(s.commitEntropy).toBe(0);
  });

  it("raises commit entropy when a required field is missing", () => {
    const s = scoreEntropy({
      ...empty,
      missingFields: [{ id: "m1", name: "sku", necessity: "required" }],
    });
    // missingFieldScore weight is 0.25, single required field -> score 1
    expect(s.commitEntropy).toBeCloseTo(0.25, 5);
  });

  it("raises commit entropy when a claim is unsupported", () => {
    const s = scoreEntropy({
      ...empty,
      claims: [{ id: "c1", text: "price 100", evidencePointer: null }],
    });
    // unsupportedClaimScore weight is 0.25, all claims unsupported -> score 1
    expect(s.commitEntropy).toBeCloseTo(0.25, 5);
  });

  it("never returns a value above 1", () => {
    const s = scoreEntropy({
      ...empty,
      missingFields: [{ id: "m1", name: "sku", necessity: "required" }],
      claims: [{ id: "c1", text: "x", evidencePointer: null }],
      policyFlags: [{ id: "p1", rule: "discount", ambiguous: true }],
      staleMemoryRefs: ["mem1"],
      toolFailures: ["tool1"],
    });
    expect(s.commitEntropy).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @clarityloop/core test`
Expected: FAIL — `Cannot find module './entropy'`.

- [ ] **Step 3: Implement the deterministic scorer**

`packages/core/src/entropy.ts`:
```ts
import type { LatentWorkflowState, EntropyScore } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const frac = (numer: number, denom: number) => (denom === 0 ? 0 : numer / denom);

/**
 * Deterministic operational-entropy scorer.
 * The model NEVER produces these numbers — they are computed purely from the
 * structured latent state. Weights follow spec §7 / memo §15.
 */
export function scoreEntropy(state: LatentWorkflowState): EntropyScore {
  const requiredMissing = state.missingFields.filter((m) => m.necessity === "required");
  const missingFieldScore = clamp01(requiredMissing.length === 0 ? 0 : 1);

  const unsupportedClaims = state.claims.filter((c) => c.evidencePointer === null);
  const unsupportedClaimScore = frac(unsupportedClaims.length, state.claims.length);

  // Contradiction: facts with the same text but differing confidence is a proxy;
  // for v1 we treat high-severity risk flags as contradiction signal.
  const contradictionScore = clamp01(
    frac(state.riskFlags.filter((r) => r.severity === "high").length, Math.max(1, state.riskFlags.length))
  );

  const policyAmbiguityScore = clamp01(
    frac(state.policyFlags.filter((p) => p.ambiguous).length, Math.max(1, state.policyFlags.length))
  );

  const staleMemoryScore = clamp01(state.staleMemoryRefs.length > 0 ? 1 : 0);
  const toolFailureScore = clamp01(state.toolFailures.length > 0 ? 1 : 0);

  const commitEntropy = clamp01(
    0.25 * missingFieldScore +
      0.25 * unsupportedClaimScore +
      0.2 * contradictionScore +
      0.15 * policyAmbiguityScore +
      0.1 * staleMemoryScore +
      0.05 * toolFailureScore
  );

  return {
    taskEntropy: missingFieldScore,
    evidenceEntropy: unsupportedClaimScore,
    actionEntropy: clamp01(missingFieldScore * 0.5 + unsupportedClaimScore * 0.5),
    policyEntropy: policyAmbiguityScore,
    memoryEntropy: staleMemoryScore,
    commitEntropy,
  };
}
```

`packages/core/src/index.ts` — add:
```ts
export * from "./entropy";
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @clarityloop/core test`
Expected: PASS (all entropy tests green).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): deterministic entropy scorer over structured latent state"
```

---

## Task 4: Storage seam — S3-compatible artifact store + repository interface

**Files:**
- Create: `packages/storage/package.json`, `packages/storage/tsconfig.json`
- Create: `packages/storage/src/artifact-store.ts` (interface + in-memory impl)
- Create: `packages/storage/src/oss-store.ts` (S3-compatible impl for OSS/R2)
- Create: `packages/storage/src/index.ts`, `packages/storage/src/artifact-store.test.ts`

- [ ] **Step 1: Create the package**

`packages/storage/package.json`:
```json
{
  "name": "@clarityloop/storage",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "@aws-sdk/client-s3": "^3.600.0" }
}
```

`packages/storage/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing test against the interface**

`packages/storage/src/artifact-store.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore } from "./artifact-store";

describe("ArtifactStore (in-memory)", () => {
  it("round-trips a stored artifact by key", async () => {
    const store = new InMemoryArtifactStore();
    await store.put("traces/t1.json", JSON.stringify({ ok: true }));
    const got = await store.get("traces/t1.json");
    expect(JSON.parse(got!)).toEqual({ ok: true });
  });

  it("returns null for a missing key", async () => {
    const store = new InMemoryArtifactStore();
    expect(await store.get("nope")).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/storage test`
Expected: FAIL — `Cannot find module './artifact-store'`.

- [ ] **Step 4: Implement the interface + in-memory store**

`packages/storage/src/artifact-store.ts`:
```ts
export interface ArtifactStore {
  put(key: string, body: string): Promise<void>;
  get(key: string): Promise<string | null>;
}

export class InMemoryArtifactStore implements ArtifactStore {
  private readonly map = new Map<string, string>();
  async put(key: string, body: string): Promise<void> {
    this.map.set(key, body);
  }
  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
}
```

- [ ] **Step 5: Implement the OSS (S3-compatible) store**

`packages/storage/src/oss-store.ts`:
```ts
import { S3Client, PutObjectCommand, GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import type { ArtifactStore } from "./artifact-store";

export type OssConfig = {
  endpoint: string;     // e.g. https://oss-ap-southeast-1.aliyuncs.com
  region: string;       // e.g. oss-ap-southeast-1
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

/** Works against Alibaba OSS and Cloudflare R2 — both speak the S3 API. */
export class OssArtifactStore implements ArtifactStore {
  private readonly client: S3Client;
  constructor(private readonly cfg: OssConfig) {
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
  }
  async put(key: string, body: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, Body: body }));
  }
  async get(key: string): Promise<string | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return (await res.Body?.transformToString()) ?? null;
    } catch (e) {
      if (e instanceof NoSuchKey) return null;
      throw e;
    }
  }
}
```

`packages/storage/src/index.ts`:
```ts
export * from "./artifact-store";
export * from "./oss-store";
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter @clarityloop/storage test`
Expected: PASS (2 passed). The OSS store is exercised live later from the API; here we only unit-test the in-memory impl against the shared interface.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(storage): ArtifactStore interface with in-memory and OSS/S3 implementations"
```

---

## Task 5: Qwen seam — provider interface + DashScope client

**Files:**
- Create: `packages/qwen/package.json`, `packages/qwen/tsconfig.json`
- Create: `packages/qwen/src/provider.ts` (interface + model routing)
- Create: `packages/qwen/src/dashscope.ts` (OpenAI-compatible client)
- Create: `packages/qwen/src/structured.ts` (zod-validated JSON generation)
- Create: `packages/qwen/src/index.ts`, `packages/qwen/src/structured.test.ts`

- [ ] **Step 1: Create the package**

`packages/qwen/package.json`:
```json
{
  "name": "@clarityloop/qwen",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "openai": "^4.56.0", "zod": "^3.23.0" }
}
```

`packages/qwen/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: Define the provider interface + model routing**

`packages/qwen/src/provider.ts`:
```ts
export type QwenTask =
  | "extraction"
  | "workflow_generation"
  | "failure_analysis"
  | "document_parse"
  | "audit_narrative";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface ModelProvider {
  complete(messages: ChatMessage[], opts: { task: QwenTask }): Promise<string>;
}

/** Model routing per spec §8. Overridable for tests. */
export function modelForTask(task: QwenTask): string {
  switch (task) {
    case "extraction": return "qwen-flash";
    case "workflow_generation": return "qwen-plus";
    case "failure_analysis": return "qwen-max";
    case "document_parse": return "qwen-vl-plus";
    case "audit_narrative": return "qwen-plus";
  }
}
```

- [ ] **Step 3: Implement the DashScope client**

`packages/qwen/src/dashscope.ts`:
```ts
import OpenAI from "openai";
import { type ChatMessage, type ModelProvider, type QwenTask, modelForTask } from "./provider";

export type DashScopeConfig = {
  apiKey: string;
  // International endpoint by default; override for China region.
  baseURL?: string;
};

export class DashScopeProvider implements ModelProvider {
  private readonly client: OpenAI;
  constructor(cfg: DashScopeConfig) {
    this.client = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    });
  }
  async complete(messages: ChatMessage[], opts: { task: QwenTask }): Promise<string> {
    const res = await this.client.chat.completions.create({
      model: modelForTask(opts.task),
      messages,
      temperature: 0.2,
    });
    return res.choices[0]?.message?.content ?? "";
  }
}
```

- [ ] **Step 4: Write the failing test for structured generation**

`packages/qwen/src/structured.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generateStructured } from "./structured";
import type { ModelProvider } from "./provider";

const fakeProvider = (reply: string): ModelProvider => ({
  async complete() { return reply; },
});

const Schema = z.object({ sku: z.string(), qty: z.number() });

describe("generateStructured", () => {
  it("parses fenced JSON from the model reply", async () => {
    const provider = fakeProvider("```json\n{\"sku\":\"A1\",\"qty\":120}\n```");
    const out = await generateStructured(provider, Schema, {
      task: "extraction", messages: [{ role: "user", content: "x" }],
    });
    expect(out).toEqual({ sku: "A1", qty: 120 });
  });

  it("throws on output that fails schema validation", async () => {
    const provider = fakeProvider("{\"sku\":\"A1\"}");
    await expect(
      generateStructured(provider, Schema, { task: "extraction", messages: [] })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/qwen test`
Expected: FAIL — `Cannot find module './structured'`.

- [ ] **Step 6: Implement structured generation**

`packages/qwen/src/structured.ts`:
```ts
import type { z } from "zod";
import type { ChatMessage, ModelProvider, QwenTask } from "./provider";

/** Extracts the first JSON object from a model reply, tolerating ```json fences. */
export function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found in model reply");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateStructured<T>(
  provider: ModelProvider,
  schema: z.ZodType<T>,
  args: { task: QwenTask; messages: ChatMessage[] },
): Promise<T> {
  const reply = await provider.complete(args.messages, { task: args.task });
  return schema.parse(extractJson(reply));
}
```

`packages/qwen/src/index.ts`:
```ts
export * from "./provider";
export * from "./dashscope";
export * from "./structured";
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter @clarityloop/qwen test`
Expected: PASS (2 passed). Live DashScope calls are validated manually via P0.4 and the API smoke test in Task 6.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(qwen): provider interface, DashScope client, zod-validated structured generation"
```

---

## Task 6: Hono API — health, score, and Qwen smoke endpoints

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`
- Create: `apps/api/src/app.ts` (Hono app factory, takes deps)
- Create: `apps/api/src/server.ts` (Node entrypoint wiring real deps from env)
- Create: `apps/api/src/app.test.ts`

- [ ] **Step 1: Create the package**

`apps/api/package.json`:
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
    "@hono/node-server": "^1.12.0",
    "hono": "^4.5.0"
  },
  "devDependencies": { "tsx": "^4.16.0" }
}
```

`apps/api/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing test for the app factory**

`apps/api/src/app.test.ts`:
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
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @clarityloop/api test`
Expected: FAIL — `Cannot find module './app'`.

- [ ] **Step 4: Implement the app factory**

`apps/api/src/app.ts`:
```ts
import { Hono } from "hono";
import { LatentWorkflowStateSchema, scoreEntropy } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";

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
    const reply = await deps.provider.complete(
      [{ role: "user", content: "reply with the single word ok" }],
      { task: "extraction" },
    );
    return c.json({ reply });
  });

  return app;
}
```

`apps/api/src/server.ts`:
```ts
import { serve } from "@hono/node-server";
import { DashScopeProvider } from "@clarityloop/qwen";
import { createApp } from "./app";

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) throw new Error("DASHSCOPE_API_KEY is required");

const app = createApp({
  provider: new DashScopeProvider({ apiKey, baseURL: process.env.DASHSCOPE_BASE_URL }),
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => console.log(`clarityloop api on :${port}`));
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @clarityloop/api test`
Expected: PASS (2 passed).

- [ ] **Step 6: Local smoke test against live Qwen**

Run: `DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY pnpm --filter @clarityloop/api dev` then in another shell `curl -s localhost:8080/qwen/ping`
Expected: `{"reply":"ok"}` (or a reply containing `ok`). Stop the dev server after.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(api): Hono app with health, deterministic /score, and Qwen ping endpoints"
```

---

## Task 7: Containerize (Docker + Docker Compose)

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `infra/docker-compose.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Write the Dockerfile**

`apps/api/Dockerfile` (built from repo root context so the workspace is available):
```dockerfile
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /app

# Install deps using the workspace manifests for cache efficiency
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/core/package.json packages/core/
COPY packages/qwen/package.json packages/qwen/
COPY packages/storage/package.json packages/storage/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false

# Copy sources and build
COPY . .
RUN pnpm --filter @clarityloop/api... build

EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
```

`.dockerignore`:
```
node_modules
**/node_modules
**/dist
.git
*.log
```

`infra/docker-compose.yml`:
```yaml
services:
  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    ports:
      - "8080:8080"
    environment:
      DASHSCOPE_API_KEY: ${DASHSCOPE_API_KEY}
      DASHSCOPE_BASE_URL: ${DASHSCOPE_BASE_URL:-https://dashscope-intl.aliyuncs.com/compatible-mode/v1}
      DATABASE_URL: postgres://clarityloop:clarityloop@db:5432/clarityloop
      PORT: "8080"
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: clarityloop
      POSTGRES_PASSWORD: clarityloop
      POSTGRES_DB: clarityloop
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 2: Build and run locally**

Run: `DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY docker compose -f infra/docker-compose.yml up --build -d`
Then: `curl -s localhost:8080/health`
Expected: `{"status":"ok"}`. Also `curl -s localhost:8080/qwen/ping` returns a reply containing `ok`.

- [ ] **Step 3: Tear down**

Run: `docker compose -f infra/docker-compose.yml down`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "build: Dockerfile and docker-compose for api + postgres"
```

---

## Task 8: Deploy to Alibaba ECS + capture proof

**Files:**
- Create: `infra/deploy-ecs.md` (runbook)
- Create: `docs/deployment-proof.md`

- [ ] **Step 1: Write the deploy runbook**

`infra/deploy-ecs.md`:
```markdown
# Deploy ClarityLoop API to Alibaba ECS

Prereqs: Phase 0 complete (ECS up, Docker installed, ports 22/8080 open).

1. From your laptop, sync the repo to the instance (replace IP):
   `rsync -az --exclude node_modules --exclude .git ./ ubuntu@<ECS_PUBLIC_IP>:~/clarityloop/`
2. SSH in: `ssh ubuntu@<ECS_PUBLIC_IP>`
3. Create `~/clarityloop/.env` with `DASHSCOPE_API_KEY=...` (and `DASHSCOPE_BASE_URL` if China region).
4. Launch: `cd ~/clarityloop && docker compose -f infra/docker-compose.yml --env-file .env up --build -d`
5. Verify from your laptop:
   - `curl -s http://<ECS_PUBLIC_IP>:8080/health` -> `{"status":"ok"}`
   - `curl -s http://<ECS_PUBLIC_IP>:8080/qwen/ping` -> reply containing `ok`
```

- [ ] **Step 2: Execute the deploy**

Follow `infra/deploy-ecs.md` steps 1–5 against the Phase 0 ECS instance.
Expected: both curl commands succeed against the **public Alibaba IP** (not localhost).

- [ ] **Step 3: Capture deployment proof**

`docs/deployment-proof.md`:
```markdown
# Alibaba Cloud Deployment Proof

- **Provider:** Alibaba Cloud ECS, region <REGION>, instance <INSTANCE_ID>
- **Public endpoint:** http://<ECS_PUBLIC_IP>:8080
- **Health check:** `curl http://<ECS_PUBLIC_IP>:8080/health` -> `{"status":"ok"}` (screenshot below)
- **Live Qwen call from Alibaba:** `curl http://<ECS_PUBLIC_IP>:8080/qwen/ping` -> reply containing `ok`
- **Model Studio:** Qwen models accessed via DashScope from the deployed container.

![ECS console](./img/ecs-console.png)
![Health response](./img/health-curl.png)
```
Add the two screenshots (Phase 0 ECS console + the health curl) under `docs/img/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: Alibaba ECS deploy runbook and deployment proof"
```

---

## Self-Review

**Spec coverage (Plan 1 = spec §3 D1–D5, §4 structure, §12 Phase 0–1, §11 testing):**
- D1 deploy-Alibaba/portable → Tasks 4, 7, 8, Phase 0 ✓
- D2 Vite SPA → deferred to Plan 3 (UI) — out of foundation scope, noted below ✓
- D3 deterministic entropy → Task 3 ✓
- D4 portability seams (storage/db/model) → Tasks 4, 5; Postgres container in Task 7 (repository code lands in Plan 2 when first persisted entity exists) ✓
- D5 monorepo tooling → Task 1 ✓
- §11 deterministic-core unit tests + zod schema tests → Tasks 2, 3, 5, 6 ✓
- Phase 0 critical path → Phase 0 section ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** `LatentWorkflowState` / `EntropyScore` / `scoreEntropy` / `ModelProvider.complete(messages, {task})` / `ArtifactStore.put/get` are used identically across Tasks 2–6. ✓

**Deferred to later plans (by design, not gaps):** the Postgres repository implementation (Plan 2, first persisted entity), the Vite dashboard + SSE heatmap (Plan 3), workflow generation (Plan 2), tools/loop controller (Plan 4), commit gate (Plan 5), promotion/replay (Plan 6), ClarityLoopBench (Plan 7).

---

## Next plans in the sequence

1. **Plan 2 — Workflow generation + persistence:** WorkflowSpec schema, Qwen workflow designer, schema validation + unauthorized-tool rejection, Postgres repository implementation, run/trace persistence. (Spec §5 first half, §12 Phase 2.)
2. **Plan 3 — Latent loop + dashboard:** Qwen structured latent-state extraction, the SSE-streamed loop scaffold, Vite+React+Tailwind dashboard with the live entropy heatmap. (Spec §5, §10, §12 Phase 3.)
3. **Plan 4 — Tools + next-best-action controller:** the six tools, action scorer, loop-until-stop. (Spec §7, §12 Phase 4.)
4. **Plan 5 — Commit gate + approval:** evidence/numeric/policy verifiers, commit decision, approval screen, risk-tiered approval. (Spec §7, §12 Phase 5.)
5. **Plan 6 — Improvement + promotion:** trace-driven Qwen patch proposal, replay benchmark, promotion gate, procedure version history. (Spec §5 second half, §12 Phase 6.)
6. **Plan 7 — ClarityLoopBench + demo polish:** 30–50 cases, baseline runners, scoring, architecture diagram, 3-min video, README + Devpost text. (Spec §9, §12 Phase 7, §14 DoD.)
