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
