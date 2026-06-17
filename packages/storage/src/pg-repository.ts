import {
  BusinessProcedureVersionSchema, TraceSchema,
} from "@clarityloop/core";
import type {
  BusinessProcedureVersion, RunOutcome, Trace, TraceStep, WorkflowDomain,
} from "@clarityloop/core";
import {
  RunRecordSchema,
  type ProcedureVersionRepository, type RunRecord, type RunRepository, type TraceRepository,
} from "./repository";

/** Minimal structural surface of a `pg` Pool/Client — lets us test offline with a fake. */
export interface PgQueryable {
  query(text: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** jsonb columns come back parsed from `pg`; a string fallback covers other drivers. */
function asJson(v: unknown): unknown {
  return typeof v === "string" ? JSON.parse(v) : v;
}

function rowToRunRecord(row: Record<string, unknown>): RunRecord {
  return RunRecordSchema.parse({
    id: row.id,
    procedureVersionId: row.procedure_version_id ?? null,
    domain: row.domain,
    inputRequest: row.input_request,
    workflowSpec: row.workflow_spec == null ? null : asJson(row.workflow_spec),
    traceId: row.trace_id ?? null,
    outcome: row.outcome == null ? null : asJson(row.outcome),
    createdAt: row.created_at,
  });
}

export class PgRunRepository implements RunRepository {
  constructor(private readonly db: PgQueryable) {}

  async create(run: RunRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO runs (id, procedure_version_id, domain, input_request, workflow_spec, trace_id, outcome, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        run.id, run.procedureVersionId, run.domain, run.inputRequest,
        run.workflowSpec === null ? null : JSON.stringify(run.workflowSpec),
        run.traceId,
        run.outcome === null ? null : JSON.stringify(run.outcome),
        run.createdAt,
      ],
    );
  }

  async get(runId: string): Promise<RunRecord | null> {
    const { rows } = await this.db.query(`SELECT * FROM runs WHERE id = $1`, [runId]);
    if (rows.length === 0) return null;
    return rowToRunRecord(rows[0]);
  }

  async setOutcome(runId: string, outcome: RunOutcome): Promise<void> {
    await this.db.query(`UPDATE runs SET outcome = $2 WHERE id = $1`, [runId, JSON.stringify(outcome)]);
  }

  async listByProcedure(versionId: string): Promise<RunRecord[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM runs WHERE procedure_version_id = $1 ORDER BY created_at`, [versionId],
    );
    return rows.map(rowToRunRecord);
  }
}

export class PgTraceRepository implements TraceRepository {
  constructor(private readonly db: PgQueryable) {}

  async create(trace: Trace): Promise<void> {
    await this.db.query(
      `INSERT INTO traces (id, run_id, procedure_version_id, workflow_version, domain, created_at, steps, outcome)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        trace.id, trace.runId, trace.procedureVersionId, trace.workflowVersion,
        trace.domain, trace.createdAt, JSON.stringify(trace.steps),
        trace.outcome === null ? null : JSON.stringify(trace.outcome),
      ],
    );
  }

  async append(traceId: string, step: TraceStep): Promise<void> {
    await this.db.query(
      `UPDATE traces SET steps = steps || $2::jsonb WHERE id = $1`,
      [traceId, JSON.stringify([step])],
    );
  }

  async get(traceId: string): Promise<Trace | null> {
    const { rows } = await this.db.query(`SELECT * FROM traces WHERE id = $1`, [traceId]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return TraceSchema.parse({
      id: row.id,
      runId: row.run_id,
      procedureVersionId: row.procedure_version_id ?? null,
      workflowVersion: row.workflow_version,
      domain: row.domain,
      createdAt: row.created_at,
      steps: asJson(row.steps),
      outcome: row.outcome == null ? null : asJson(row.outcome),
    });
  }
}

export class PgProcedureVersionRepository implements ProcedureVersionRepository {
  constructor(private readonly db: PgQueryable) {}

  async put(version: BusinessProcedureVersion): Promise<void> {
    await this.db.query(
      `INSERT INTO procedure_versions (id, parent_version, name, domain, data, created_at, promoted_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         parent_version = EXCLUDED.parent_version, name = EXCLUDED.name,
         domain = EXCLUDED.domain, data = EXCLUDED.data,
         created_at = EXCLUDED.created_at, promoted_at = EXCLUDED.promoted_at`,
      [
        version.id, version.parentVersion, version.name,
        version.workflowSpec.trigger.domain, JSON.stringify(version),
        version.createdAt, version.promotedAt,
      ],
    );
  }

  async get(id: string): Promise<BusinessProcedureVersion | null> {
    const { rows } = await this.db.query(`SELECT data FROM procedure_versions WHERE id = $1`, [id]);
    if (rows.length === 0) return null;
    return BusinessProcedureVersionSchema.parse(asJson(rows[0].data));
  }

  async getLatest(domain: WorkflowDomain): Promise<BusinessProcedureVersion | null> {
    const { rows } = await this.db.query(
      `SELECT data FROM procedure_versions WHERE domain = $1 ORDER BY created_at DESC LIMIT 1`, [domain],
    );
    if (rows.length === 0) return null;
    return BusinessProcedureVersionSchema.parse(asJson(rows[0].data));
  }

  async listVersions(name: string): Promise<BusinessProcedureVersion[]> {
    const { rows } = await this.db.query(
      `SELECT data FROM procedure_versions WHERE name = $1 ORDER BY created_at`, [name],
    );
    return rows.map((r) => BusinessProcedureVersionSchema.parse(asJson(r.data)));
  }
}
