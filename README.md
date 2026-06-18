# ClarityLoop

**Uncertainty-aware release control for agent-authored business workflows.**

Agents — and harness-evolution systems like HarnessX — are getting good at *generating and
improving* workflows. ClarityLoop is the layer that decides **when an evolved workflow is clear
enough, safe enough, and authorized enough to commit, escalate, or promote** into a governed
business procedure. It maintains a compact latent workflow state, estimates operational
uncertainty **deterministically**, gathers the next best evidence, and only commits or promotes
when uncertainty, risk, and evidence thresholds are satisfied.

> **Harnesses evolve. ClarityLoop decides what ships.**
> Let agents explore freely. Loop for missing signal. Commit only when uncertainty is low
> enough for the business risk.

Built for the **Global AI Hackathon Series with Qwen Cloud — Track 4: Autopilot Agent**.
Category: **Agent Workflow Release Control** (not a harness foundry — see
[`memo.md` §HarnessX](memo.md)).

---

## Status

**Built, tested, and DEPLOYED LIVE on Alibaba Cloud.** The full vertical slice runs on
**Function Compute** (Singapore), calling Qwen via Model Studio — both mandatory competition
requirements are met (see [`docs/deployment-proof.md`](docs/deployment-proof.md)). Public
endpoint: `https://clarityloop-api-jewijtekcx.ap-southeast-1.fcapp.run`.

| Package / area | State |
| --- | --- |
| Monorepo (pnpm + Turborepo + Vitest) | ✅ |
| `@clarityloop/core` — schemas, types, entropy scorer, next-best-action scorer, risk classifier, **commit gate**, **promotion gate** | ✅ (81 tests) |
| `@clarityloop/qwen` — DashScope provider + zod-validated structured generation | ✅ (2 tests) |
| `@clarityloop/storage` — S3-compatible artifact store + run/trace/procedure/memory repositories (in-memory + `pg`) | ✅ (17 tests) |
| `@clarityloop/tools` — the six business tools + registry | ✅ (18 tests) |
| `@clarityloop/verifiers` — six deterministic verifiers | ✅ (22 tests) |
| `@clarityloop/memory` — operational-memory value score + write gate + TTL/conflict | ✅ (13 tests) |
| `@clarityloop/evals` — ClarityLoopBench (36 cases), baselines, replay benchmark, promotion gate | ✅ (34 tests) |
| `@clarityloop/api` — Hono app: workflow gen, latent loop, SSE, commit/approval/improve/promote routes | ✅ (30 tests) |
| `@clarityloop/web` — dashboard: entropy heatmap, panels, approval, replay, lineage, 3-column demo | ✅ (26 tests) |
| Docker + Compose (api + Postgres) — portable second target | ✅ (image builds) |
| **Deployed live on Alibaba Function Compute (in-memory build)** | ✅ |

### Benchmark headline (ClarityLoopBench, 36 cases — `pnpm --filter @clarityloop/evals bench`)

Every metric is measured by **one uniform scorer** applied identically to all baselines; Fixed
Gate and ClarityLoop run the **same shipped `runCommitGate`**, differing only by the evidence loop.

| Baseline | Completion | False commit | Approval |
| --- | --- | --- | --- |
| Bare Qwen | 100% | 92% | 0% |
| Dynamic Qwen Workflow | 100% | 56% | 0% |
| **Harness Evolution** (HarnessX-like, no risk gate) | 100% | **36%** | 0% |
| Fixed Gate | 31% | 0% | 22% |
| **ClarityLoop** | **86%** | **0%** | 22% |

The honest, defensible claim: ClarityLoop matches the fixed gate's **0% false-commit** but
**~triples its completion (86% vs 31%)** by resolving the gaps a fixed gate bounces; and versus a
performance-optimized *evolved harness*, it gives up just **14% completion to eliminate all 36% of
unsafe commits**. That trade — *small constraint tax for a large safety gain* — is the whole
thesis: **harness evolution buys performance; the risk gate buys safety.**

---

## Architecture

A TypeScript monorepo. Everything that touches a cloud primitive sits behind an interface, so
the submission deploys to **Alibaba Cloud** (the competition's mandatory target) while a
Cloudflare deploy remains a near-free second target.

```
apps/
  api/        Hono server — workflow gen, latent loop, SSE entropy stream, commit/approval/improve/promote
  web/        Vite + React + Tailwind dashboard — entropy heatmap, panels, approval, replay, 3-column demo
packages/
  core/       Zod schemas, domain types, PURE deterministic kernel: entropy scorer, action scorer,
              risk classifier, commit gate, promotion gate
  qwen/       ModelProvider interface, DashScope (OpenAI-compatible) client, structured JSON gen
  storage/    ArtifactStore (OSS/R2, S3-compatible) + run/trace/procedure/memory repositories (in-memory + pg)
  tools/      the six business tools (catalog, memory, stock, supplier-quote parse, compare, draft) + registry
  verifiers/  six deterministic verifiers (schema, numeric, evidence coverage, policy, hallucinated-tool, missing-info)
  memory/     operational-memory value score + write gate + TTL/conflict invalidation
  evals/      ClarityLoopBench cases, baseline runners, replay benchmark, promotion gate, scoring report
infra/        Dockerfile, docker-compose (api + postgres), ECS deploy runbook
docs/         design spec, implementation plans, shared contracts, architecture diagram, deployment proof
```

See [`docs/architecture.md`](docs/architecture.md) for the full system diagram, and
[`DEVPOST.md`](DEVPOST.md) for the submission write-up.

### Key design decisions

- **Deterministic entropy over structured Qwen output.** Qwen never emits an entropy number.
  It returns structured latent state (facts, missing fields, claims each tagged with an
  evidence pointer); deterministic TypeScript in `packages/core` computes every entropy
  component from that structure. This is the auditable, trustworthy core.
- **Portable by interface.** Object storage via the S3 API (OSS ↔ R2), relational state behind
  a repository pattern (Postgres ↔ SQLite/D1), the API on Hono (Node ↔ Workers), and the model
  behind a `ModelProvider` abstraction (Qwen via DashScope). **Submission ships live on Alibaba
  Function Compute** (serverless, scale-to-zero, in-memory build); ECS/Docker is a portable target.
- **Soft autonomy in the sandbox, hard governance at the authority boundary.** Planning,
  drafting, and read-only tool use are unconstrained; only irreversible/external commits and
  workflow promotion are gated.

Full rationale: [`docs/superpowers/specs/2026-06-16-clarityloop-design.md`](docs/superpowers/specs/2026-06-16-clarityloop-design.md)
and the strategy brief [`memo.md`](memo.md).

---

## Development

Requires Node 20 and pnpm (via `corepack enable`).

```bash
pnpm install            # install workspace deps
pnpm test               # run all package tests (turbo)
pnpm typecheck          # typecheck all packages
pnpm build              # build all packages
```

### Running the API locally

The API requires a Qwen DashScope API key.

```bash
export DASHSCOPE_API_KEY=...        # from Alibaba Model Studio
pnpm --filter @clarityloop/api dev  # starts on :8080
curl localhost:8080/health          # -> {"status":"ok"}
curl localhost:8080/qwen/ping       # -> {"reply":"...ok..."}
```

Or via Docker Compose (api + Postgres):

```bash
DASHSCOPE_API_KEY=... docker compose -f infra/docker-compose.yml up --build
```

### Deploying to Alibaba Cloud

See [`infra/deploy-ecs.md`](infra/deploy-ecs.md). The judged backend must run on Alibaba Cloud;
deployment proof is recorded in [`docs/deployment-proof.md`](docs/deployment-proof.md).

---

### Workflow generation + persistence (Plan 2)

- **Qwen Workflow Designer** (`apps/api/src/workflow-designer.ts`): `designWorkflow(provider, { request, domain, allowedTools })` calls `generateStructured` with `WorkflowSpecSchema`, then `assertWorkflowToolsAuthorized` (deterministic, `@clarityloop/core`) **rejects any tool not in the allow-list** — the model proposes, code decides.
- **`POST /workflow`**: body `{ "request": string, "domain"?: WorkflowDomain }` → generates, validates, and persists a `RunRecord` with the `WorkflowSpec`; returns `{ runId, workflowSpec }`. Unauthorized tools → `422 { error: "unauthorized_tool", unauthorizedTools }`.
- **Persistence** (`@clarityloop/storage`): repository-pattern `RunRepository` / `TraceRepository` / `ProcedureVersionRepository`, each with an `InMemory*` (tests) and a `Pg*` (deployed, `pg`) implementation. Structures are stored as Postgres `jsonb`; `runId`/`domain`/`name`/`procedure_version_id` are promoted to indexed columns. Schema init: `packages/storage/sql/001_init.sql` (mirrored in `INIT_SQL`, run at API boot).

---

### Latent loop + dashboard (Plan 3)

- **Latent-state extractor** (`apps/api/src/latent/extract.ts`): `extractLatentState(provider, { request, workflowVersion, goal })` calls Qwen via `generateStructured` for structured state (facts, missing fields, claims). `goal` and `workflowVersion` are always set by code — never from the model.
- **Run-loop scaffold** (`apps/api/src/latent/loop.ts`): `runLatentLoop` async generator (extract → `scoreEntropy` → emit `EntropyUpdate` frames). `demoEntropySequence()` is a deterministic canonical demo producing commit entropy ≈0.82 → ≈0.44 → ≈0.18 using `scoreEntropy` on real `LatentWorkflowState` objects — no hardcoded numbers.
- **SSE routes** added to `apps/api`:
  - `POST /runs/stream` — streams `EntropyUpdate` frames for a real request via `runLatentLoop`.
  - `GET /demo/entropy-stream?paceMs=<ms>` — streams the canonical demo sequence (default 350ms between frames; pass `paceMs=0` for instant).
  - Both emit `event: entropy` with JSON payloads validated by `EntropyUpdateSchema`.
- **`@clarityloop/core` additions**: `EntropyUpdateSchema` / `EntropyUpdate` (the SSE frame contract, zod-validated on both ends). `EntropyScoreSchema` was already in `trace.ts` and is re-exported.
- **Dashboard** (`apps/web`): Vite 5 + React 18 + TypeScript + Tailwind CSS SPA.
  - `useEntropyStream(url)` — EventSource hook that accumulates `EntropyUpdate` frames and closes on `phase === "done"`.
  - `EntropyHeatmap` — hero visual: six entropy components as color cells + commit-entropy history sparkline.
  - Panels: Input Request (with Run button), Generated Workflow, Next Best Action, Trace.
  - Shared types imported directly from `@clarityloop/core` via Vite alias (no separate build step).

#### Running the dashboard locally

```bash
# Terminal 1 — API (entropy stream source)
export DASHSCOPE_API_KEY=...
pnpm --filter @clarityloop/api dev        # :8080

# Terminal 2 — Dashboard (Vite dev server with proxy to :8080)
pnpm --filter @clarityloop/web dev        # :5173
# Open http://localhost:5173 → click "Run ClarityLoop" to stream the canonical demo
```

The dashboard calls `GET /demo/entropy-stream` (no Qwen key needed for the demo). For the real loop (`POST /runs/stream`) set `DASHSCOPE_API_KEY`.

See [`docs/architecture.md`](docs/architecture.md) for the full architecture reference.

---

### Commit gate & approval

When a run loop stops, deterministic code — never the model — decides whether the output may
commit. Six verifiers (`@clarityloop/verifiers`: schema, numeric reconciliation, evidence
coverage, policy, hallucinated-tool, missing-info) emit `Check[]`; `runCommitGate` combines them
with the entropy score, the risk class (L0–L4), and the governed commit policy / authority
boundary to return one of `commit | needs_approval | needs_more_info | reject | sandbox_only`.
High-risk decisions route to a human via `POST /commit` → `ApprovalPanel` → `POST /approvals/resolve`.
See [`docs/commit-gate-and-approval.md`](docs/commit-gate-and-approval.md).

---

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

---

## Improvement + Promotion (Phase 6)

ClarityLoop's offline improvement loop closes the feedback cycle from failed runs to a safer, version-controlled workflow.

**Flow:** a failed/seed trace → `proposeWorkflowPatch` (Qwen via `@clarityloop/evals`, structure only) → `applyPatch` (deterministic, bumps version) → `runReplay` (deterministic replay of old vs new `WorkflowSpec` over seeded `BenchmarkCase`s) → `ProcedureMetrics` (baseline vs candidate) → `runPromotionGate` (`@clarityloop/core`, memo §19 criteria) → `PromotionDecision` (`promote` | `reject+RegressionReport` | `needs_human_review`). On `promote`, a child `BusinessProcedureVersion` is persisted with `parentVersion`, `rollbackPointer`, `promotedAt`, and candidate metrics.

**New packages:**
- `@clarityloop/evals`: `BenchmarkCase`/`SEED_CASES`, `runReplay`, `computeProcedureMetrics`, `runCase`, `proposeWorkflowPatch`, `improveAndEvaluate`.
- `@clarityloop/memory`: `scoreMemoryValue` (memo §16), `memoryWriteGate` (rejects unsupported/one-off/conflicting/below-threshold), `isExpired` (TTL), `commitMemory`.

**Core additions (`@clarityloop/core`):** `WorkflowPatch`/`WorkflowPatchOp`/`applyPatch`, `ProcedureMetrics`/`PromotionReport`/`RegressionReport`/`PromotionDecision`, `runPromotionGate`.

**New API routes (`apps/api`):**
- `POST /procedures/:id/improve` — Qwen proposes a `WorkflowPatch` from a failure context.
- `POST /procedures/:id/promote` — replay + gate + persist child version.
- `GET /procedures/:name/versions` — version lineage.

**New UI panels (`apps/web`):** `ReplayBenchmarkPanel` (old-vs-new metrics table with Δ and direction) and `VersionLineagePanel` (parent-first tree with depth indentation), both surfaced in the dashboard (`App.tsx`, "Procedure improvement & promotion" section) and covered by jsdom render tests with no live network.

All logic is deterministic except the Qwen `WorkflowPatch` proposal; all tests use fake providers and in-memory repositories. See [`docs/technical/improvement-promotion.md`](docs/technical/improvement-promotion.md).

---

## Benchmark & Demo

ClarityLoopBench (`packages/evals`) seeds 36 cases across customer-quote and supplier-comparison and
scores four baselines — Bare Qwen, Dynamic Qwen Workflow, Fixed Gate, ClarityLoop — on false-commit
rate, safe completion rate, constraint tax, safety gain, approval burden, and evidence coverage.

Run it offline (deterministic, no API key needed):

```bash
pnpm --filter @clarityloop/evals bench
```

Outputs `packages/evals/reports/report.json` and `report.md`. The `apps/web` dashboard renders the
three-column demo (Baseline | ClarityLoop | Promotion benchmark). Architecture: `docs/architecture.md`.
Submission write-up: `DEVPOST.md`. Demo script: `docs/demo-video-script.md`.

---

## License

See [`LICENSE`](LICENSE).
