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

## License

See [`LICENSE`](LICENSE).
