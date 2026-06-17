import type {
  BusinessProcedureVersion, RunOutcome, Trace, TraceStep, WorkflowDomain,
} from "@clarityloop/core";
import type {
  ProcedureVersionRepository, RunRecord, RunRepository, TraceRepository,
} from "./repository";

export class InMemoryRunRepository implements RunRepository {
  private readonly runs = new Map<string, RunRecord>();
  async create(run: RunRecord): Promise<void> {
    this.runs.set(run.id, run);
  }
  async get(runId: string): Promise<RunRecord | null> {
    return this.runs.get(runId) ?? null;
  }
  async setOutcome(runId: string, outcome: RunOutcome): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`run not found: ${runId}`);
    this.runs.set(runId, { ...run, outcome });
  }
  async listByProcedure(versionId: string): Promise<RunRecord[]> {
    return [...this.runs.values()].filter((r) => r.procedureVersionId === versionId);
  }
}

export class InMemoryTraceRepository implements TraceRepository {
  private readonly traces = new Map<string, Trace>();
  async create(trace: Trace): Promise<void> {
    this.traces.set(trace.id, { ...trace, steps: [...trace.steps] });
  }
  async append(traceId: string, step: TraceStep): Promise<void> {
    const trace = this.traces.get(traceId);
    if (!trace) throw new Error(`trace not found: ${traceId}`);
    trace.steps.push(step);
  }
  async get(traceId: string): Promise<Trace | null> {
    return this.traces.get(traceId) ?? null;
  }
}

export class InMemoryProcedureVersionRepository implements ProcedureVersionRepository {
  private readonly versions = new Map<string, BusinessProcedureVersion>();
  async put(version: BusinessProcedureVersion): Promise<void> {
    this.versions.set(version.id, version);
  }
  async get(id: string): Promise<BusinessProcedureVersion | null> {
    return this.versions.get(id) ?? null;
  }
  async getLatest(domain: WorkflowDomain): Promise<BusinessProcedureVersion | null> {
    const matches = [...this.versions.values()]
      .filter((v) => v.workflowSpec.trigger.domain === domain)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ?? null;
  }
  async listVersions(name: string): Promise<BusinessProcedureVersion[]> {
    return [...this.versions.values()]
      .filter((v) => v.name === name)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
