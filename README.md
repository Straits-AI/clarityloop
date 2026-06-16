# ClarityLoop

**Uncertainty-guided autopilot for business workflows.**

ClarityLoop lets Qwen agents generate and execute business workflows dynamically, but does
not blindly trust them. It maintains a compact latent workflow state, estimates operational
uncertainty **deterministically**, gathers the next best evidence, and only commits or promotes
work when uncertainty, risk, and evidence thresholds are satisfied.

> Let agents explore freely. Loop for missing signal. Commit only when uncertainty is low
> enough for the business risk.

Built for the **Global AI Hackathon Series with Qwen Cloud — Track 4: Autopilot Agent**.

---

## Status

Phase 1 (Foundation) is complete. The monorepo, the deterministic entropy core, the
cloud-portability seams, and a containerized Hono API are in place and tested. Later phases
(workflow generation, the live loop + dashboard, tools, commit gate, promotion/replay,
benchmark) are planned but not yet built — see `docs/superpowers/plans/`.

| Area | State |
| --- | --- |
| Monorepo (pnpm + Turborepo + Vitest) | ✅ |
| `@clarityloop/core` — schemas, types, deterministic entropy scorer | ✅ (12 tests) |
| `@clarityloop/storage` — S3-compatible artifact store (OSS / R2) | ✅ (2 tests) |
| `@clarityloop/qwen` — DashScope provider + structured generation | ✅ (2 tests) |
| `@clarityloop/api` — Hono app (`/health`, `/score`, `/qwen/ping`) | ✅ (2 tests) |
| Docker + Compose (api + Postgres) | ✅ (image builds) |
| Alibaba ECS deploy | ⏳ pending Phase 0 onboarding |
| Workflow generation, loop, dashboard, gates, benchmark | ⏳ Plans 2–7 |

---

## Architecture

A TypeScript monorepo. Everything that touches a cloud primitive sits behind an interface, so
the submission deploys to **Alibaba Cloud** (the competition's mandatory target) while a
Cloudflare deploy remains a near-free second target.

```
apps/
  api/        Hono server — /health, /score (deterministic entropy), /qwen/ping
packages/
  core/       Zod schemas, domain types, PURE deterministic entropy scorer
  qwen/       ModelProvider interface, DashScope (OpenAI-compatible) client, structured JSON gen
  storage/    ArtifactStore interface — in-memory + OSS/R2 (S3-compatible) implementations
infra/        Dockerfile, docker-compose (api + postgres), ECS deploy runbook
docs/         design spec, implementation plans, deployment proof
```

### Key design decisions

- **Deterministic entropy over structured Qwen output.** Qwen never emits an entropy number.
  It returns structured latent state (facts, missing fields, claims each tagged with an
  evidence pointer); deterministic TypeScript in `packages/core` computes every entropy
  component from that structure. This is the auditable, trustworthy core.
- **Portable by interface.** Object storage via the S3 API (OSS ↔ R2), relational state behind
  a repository pattern (Postgres ↔ SQLite/D1), the API on Hono (Node ↔ Workers), and the model
  behind a `ModelProvider` abstraction (Qwen via DashScope). Submission ships on Alibaba ECS.
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

## License

See [`LICENSE`](LICENSE).
