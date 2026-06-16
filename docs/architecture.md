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
