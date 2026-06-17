import { z } from "zod";
import { WorkflowDomainSchema, WorkflowSpecSchema, RunOutcomeSchema } from "@clarityloop/core";
import type {
  BusinessProcedureVersion, RunOutcome, Trace, TraceStep, WorkflowDomain,
} from "@clarityloop/core";

export const RunRecordSchema = z.object({
  id: z.string(),
  procedureVersionId: z.string().nullable(),
  domain: WorkflowDomainSchema,
  inputRequest: z.string(),
  workflowSpec: WorkflowSpecSchema.nullable(),
  traceId: z.string().nullable(),
  outcome: RunOutcomeSchema.nullable(),
  createdAt: z.string(),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

export interface RunRepository {
  create(run: RunRecord): Promise<void>;
  get(runId: string): Promise<RunRecord | null>;
  setOutcome(runId: string, outcome: RunOutcome): Promise<void>;
  listByProcedure(versionId: string): Promise<RunRecord[]>;
}

export interface TraceRepository {
  create(trace: Trace): Promise<void>;
  append(traceId: string, step: TraceStep): Promise<void>;
  get(traceId: string): Promise<Trace | null>;
}

export interface ProcedureVersionRepository {
  put(version: BusinessProcedureVersion): Promise<void>;
  get(id: string): Promise<BusinessProcedureVersion | null>;
  getLatest(domain: WorkflowDomain): Promise<BusinessProcedureVersion | null>;
  listVersions(name: string): Promise<BusinessProcedureVersion[]>;
}
