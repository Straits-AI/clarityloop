# Persistence + Workflow Generation (Plan 2)

**Status:** implemented. **Contracts:** `docs/superpowers/specs/2026-06-16-shared-contracts.md` §3–§9, §13.

## Workflow generation
`request → Qwen Workflow Designer (generateStructured + WorkflowSpecSchema) → assertWorkflowToolsAuthorized → persist RunRecord`.
Qwen emits structure only. All validation/rejection is deterministic TypeScript in `@clarityloop/core`
(`assertWorkflowToolsAuthorized` throws `UnauthorizedToolError`). The model never emits a score or decision.

## Persistence
Single SQL layer. Deployed build = `pg` against Postgres; tests = `InMemory*Repository`. SQLite/D1 stays
swappable behind the same interface. Structures are `jsonb`; queryable keys are indexed columns.

| Entity | Table | Queryable columns | Repository |
|---|---|---|---|
| RunRecord | `runs` | id, procedure_version_id, domain | `RunRepository` |
| Trace | `traces` | id, run_id (steps `jsonb`, append-only) | `TraceRepository` |
| BusinessProcedureVersion | `procedure_versions` | id, name, domain | `ProcedureVersionRepository` |

`Pg*Repository` takes a structural `PgQueryable` (`query(text, params)`), so it is unit-tested with a fake
client offline; the real `pg.Pool` is constructed only in `apps/api/src/server.ts`, which also runs `INIT_SQL`.

## Endpoint
`POST /workflow` — generate + validate + persist; `200 { runId, workflowSpec }` or `422 { error, unauthorizedTools }`.

## Deferred to later plans
Latent-state extraction + the live loop that fills `Trace.steps` (Plan 3/4), the commit gate that writes
`RunOutcome` (Plan 5), `MemoryRepository` + the full `OperationalMemory` union (Plan 4), promotion that fills
`evalResults`/`PromotionDecision` (Plan 6).
