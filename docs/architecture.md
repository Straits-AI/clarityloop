# ClarityLoop — Architecture

ClarityLoop is an uncertainty-guided autopilot layer: Qwen generates and executes workflows
dynamically, while deterministic TypeScript scores operational entropy, gathers the next best
evidence, and gates commits and promotions.

```mermaid
flowchart TD
  U[User request] --> WD[Qwen Workflow Designer\n(Qwen Plus)]
  WD --> SV[WorkflowSpec schema validation\nreject unauthorized tools]
  SV --> EX[Qwen latent-state extraction\n(Qwen Flash, structured)]
  EX --> ENT[Deterministic Entropy Scorer\npackages/core scoreEntropy]
  ENT --> LC{Loop Controller\nargmax next-best-action}
  LC -->|gather evidence| TOOLS[Tools\nretrieve_memory · lookup_catalog · check_stock\nparse_supplier_quote · compare_quote · draft_quote]
  TOOLS --> ST[Latent State update]
  ST --> ENT
  LC -->|stop condition| VER[Verifiers\nschema · numeric · evidence_coverage\npolicy · hallucinated_tool · missing_info]
  VER --> CG[Commit Gate\ncommit · needs_approval · needs_more_info · reject · sandbox_only]
  CG -->|needs_approval| HUM[Human approval\nauthority boundary, risk-tiered]
  CG --> TRACE[Trace Store\nPostgres + OSS]
  TRACE --> FA[Qwen Failure Analysis\n+ Workflow Patch Proposal]
  FA --> RB[Replay Benchmark\nClarityLoopBench old vs new]
  RB --> PG[Promotion Gate\npromote · reject · needs_human_review]
  PG --> BPV[BusinessProcedureVersion\ngoverned, versioned, auditable]

  subgraph Deterministic kernel (packages/core)
    ENT
    VER
    CG
    PG
  end
```

**Deployment.** The judged backend runs on Alibaba Cloud ECS (Docker Compose: Hono API + Postgres),
with artifacts in OSS and models via DashScope / Model Studio. Portability seams (S3-compatible
storage, repository-pattern DB, provider abstraction) keep a Cloudflare target available
post-hackathon. See `docs/deployment-proof.md`.

**Credibility backbone.** Qwen emits structure only; every entropy number and every commit/promotion
decision is computed by the deterministic kernel in `packages/core`. The model never emits a number
that gates anything.

## Packages

- **@clarityloop/core** — pure deterministic kernel: zod schemas + types
  (`LatentWorkflowState`, `EntropyScore`, `scoreEntropy`), commit gate (`runCommitGate`),
  promotion gate (`runPromotionGate`), workflow patching (`applyPatch`), procedure versioning.
  No cloud or I/O deps.
- **@clarityloop/qwen** — `ModelProvider` interface, DashScope client,
  `generateStructured` (zod-validated JSON). The model emits structure only.
- **@clarityloop/storage** — `ArtifactStore` (in-memory + OSS/S3), repository interfaces
  and in-memory implementations for runs, traces, procedure versions, and operational memory.
- **@clarityloop/tools** — Six tools: `retrieve_memory`, `lookup_catalog`, `check_stock`,
  `parse_supplier_quote`, `compare_quote`, `draft_quote`. Uniform `Tool`/`ToolResult` interface.
- **@clarityloop/verifiers** — Six verifiers: `schema`, `numeric_reconciliation`,
  `evidence_coverage`, `policy`, `hallucinated_tool`, `missing_info`. All deterministic.
- **@clarityloop/memory** — `scoreMemoryValue`, `runMemoryWriteGate`. Pure functions.
- **@clarityloop/evals** — ClarityLoopBench (36 seeded cases, four baseline runners,
  scoring report) + replay engine + promotion comparison.

## Apps

- **apps/api** — Hono server. Loop controller (`runToolLoop`), approval gate,
  SSE streaming, routes: `/runs/stream`, `/commit`, `/approvals/resolve`, `/improve`, `/promote`.
- **apps/web** — Vite + React + Tailwind SPA. `EntropyHeatmap`, `ReplayBenchmarkPanel`,
  `VersionLineagePanel`, `ApprovalPanel`, `ThreeColumnDemo` (Baseline | ClarityLoop | Promotion).
