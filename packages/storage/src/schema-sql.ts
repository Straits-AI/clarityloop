/**
 * Idempotent schema init for the deployed Postgres build. Run once at boot.
 * Kept in sync with packages/storage/sql/001_init.sql (the psql-runnable copy).
 */
export const INIT_SQL = `
CREATE TABLE IF NOT EXISTS procedure_versions (
  id              text PRIMARY KEY,
  parent_version  text,
  name            text NOT NULL,
  domain          text NOT NULL,
  data            jsonb NOT NULL,
  created_at      text NOT NULL,
  promoted_at     text
);
CREATE INDEX IF NOT EXISTS idx_procedure_versions_domain ON procedure_versions (domain);
CREATE INDEX IF NOT EXISTS idx_procedure_versions_name ON procedure_versions (name);

CREATE TABLE IF NOT EXISTS runs (
  id                    text PRIMARY KEY,
  procedure_version_id  text,
  domain                text NOT NULL,
  input_request         text NOT NULL,
  workflow_spec         jsonb,
  trace_id              text,
  outcome               jsonb,
  created_at            text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_procedure_version_id ON runs (procedure_version_id);
CREATE INDEX IF NOT EXISTS idx_runs_domain ON runs (domain);

CREATE TABLE IF NOT EXISTS traces (
  id                    text PRIMARY KEY,
  run_id                text NOT NULL,
  procedure_version_id  text,
  workflow_version      text NOT NULL,
  domain                text NOT NULL,
  created_at            text NOT NULL,
  steps                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  outcome               jsonb
);
CREATE INDEX IF NOT EXISTS idx_traces_run_id ON traces (run_id);
`;
