import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import {
  LatentWorkflowStateSchema, scoreEntropy, WorkflowDomainSchema,
  UnauthorizedToolError, applyPatch, runPromotionGate, WorkflowPatchSchema,
  type ToolName, type BusinessProcedureVersion, type ProcedureMetrics,
} from "@clarityloop/core";
import {
  FailureContextSchema,
  proposeWorkflowPatch,
  runReplay,
  type BenchmarkCase,
} from "@clarityloop/evals";
import type { ModelProvider } from "@clarityloop/qwen";
import type { RunRecord, RunRepository, ProcedureVersionRepository, TraceRepository } from "@clarityloop/storage";
import { InMemoryRunRepository, InMemoryMemoryRepository, InMemoryArtifactStore } from "@clarityloop/storage";
import { seedMemoryRepository } from "@clarityloop/tools";
import { designWorkflow } from "./workflow-designer";
import { LatentExtractionInputSchema, extractLatentStateStream, type LatentExtractionInput } from "./latent/extract";
import { ExecuteInputSchema, executeRunStream } from "./execute/run";
import { ParseDocumentInputSchema, parseDocumentStream } from "./document/parse";
import { runLatentLoop, demoEntropySequence } from "./latent/loop";
import { registerCommitRoutes } from "./commit-route";
import { registerApprovalRoutes } from "./approval-route";

export type AppDeps = {
  provider: ModelProvider;
  runs?: RunRepository;
  allowedTools?: ToolName[];
  newId?: () => string;
  procedureRepo?: ProcedureVersionRepository;
  traceRepo?: TraceRepository;
  replayCases?: BenchmarkCase[];
};

function metricsToEvalResults(m: ProcedureMetrics): { caseId: string; metric: string; value: number }[] {
  return Object.entries(m).map(([metric, value]) => ({ caseId: "replay", metric, value: value as number }));
}

const WorkflowRequestSchema = z.object({
  request: z.string().min(1),
  domain: WorkflowDomainSchema.optional(),
});

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const runs = deps.runs ?? new InMemoryRunRepository();
  const allowedTools: ToolName[] = deps.allowedTools ?? [
    "retrieve_memory", "lookup_catalog", "check_stock",
    "parse_supplier_quote", "compare_quote", "draft_quote",
  ];
  const newId = deps.newId ?? (() => `run_${randomUUID()}`);

  app.use("*", cors()); // dashboard may be served from a different origin (OSS static hosting)

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/score", async (c) => {
    const parsed = LatentWorkflowStateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(scoreEntropy(parsed.data));
  });

  app.get("/qwen/ping", async (c) => {
    const reply = await deps.provider.complete(
      [{ role: "user", content: "reply with the single word ok" }],
      { task: "extraction" },
    );
    return c.json({ reply });
  });

  // Generate a WorkflowSpec from a messy request, validate it (schema + allow-list), persist the run.
  app.post("/workflow", async (c) => {
    const parsed = WorkflowRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const { request, domain } = parsed.data;
    try {
      const spec = await designWorkflow(deps.provider, { request, domain, allowedTools });
      const run: RunRecord = {
        id: newId(),
        procedureVersionId: null,
        domain: spec.trigger.domain,
        inputRequest: request,
        workflowSpec: spec,
        traceId: null,
        outcome: null,
        createdAt: new Date().toISOString(),
      };
      await runs.create(run);
      return c.json({ runId: run.id, workflowSpec: spec });
    } catch (e) {
      if (e instanceof UnauthorizedToolError) {
        return c.json({ error: "unauthorized_tool", unauthorizedTools: e.unauthorizedTools }, 422);
      }
      throw e;
    }
  });

  // Run-loop scaffold: extract latent state -> score -> stream each entropy update over SSE.
  app.post("/runs/stream", async (c) => {
    const body = LatentExtractionInputSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const input: LatentExtractionInput = body.data;
    return streamSSE(c, async (stream) => {
      for await (const update of runLatentLoop(deps.provider, input)) {
        await stream.writeSSE({ event: "entropy", id: String(update.step), data: JSON.stringify(update) });
      }
    });
  });

  // Live extraction: stream the RAW model tokens as Qwen writes the structured state,
  // then emit the parsed state + deterministic entropy. Lets the UI show real LLM output.
  app.post("/extract/stream", async (c) => {
    const body = LatentExtractionInputSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const input: LatentExtractionInput = body.data;
    return streamSSE(c, async (stream) => {
      for await (const ev of extractLatentStateStream(deps.provider, input)) {
        if (ev.type === "token") {
          await stream.writeSSE({ event: "token", data: JSON.stringify({ token: ev.token }) });
        } else {
          const entropy = scoreEntropy(ev.state);
          await stream.writeSSE({
            event: "entropy", id: "0",
            data: JSON.stringify({ step: 0, phase: "done", state: ev.state, entropy, nextBestAction: null, note: "latent state extracted and scored" }),
          });
        }
      }
    });
  });

  // Counterfactual execution: run the REAL next-best-action tool loop end-to-end, then either
  // respect the deterministic commit gate (gate=on → ClarityLoop: commit only if cleared, else
  // escalate) or ignore it (gate=off → capability-only: ship the drafted quote regardless).
  // Same Qwen extraction + same tools + same draft both ways; the gate is the only difference.
  // Streams: token (raw Qwen) → step (each tool firing) → verdict (committed vs escalated + draft).
  app.post("/execute/stream", async (c) => {
    const body = ExecuteInputSchema.safeParse(await c.req.json());
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    const memory = new InMemoryMemoryRepository();
    await seedMemoryRepository(memory); // so retrieve_memory has the seeded prior-order knowledge
    const runtime = { memory, store: new InMemoryArtifactStore() };
    return streamSSE(c, async (stream) => {
      for await (const ev of executeRunStream(deps.provider, body.data, runtime)) {
        if (ev.type === "token") await stream.writeSSE({ event: "token", data: JSON.stringify({ token: ev.token }) });
        else if (ev.type === "step") await stream.writeSSE({ event: "step", data: JSON.stringify(ev) });
        else await stream.writeSSE({ event: "verdict", data: JSON.stringify(ev) });
      }
    });
  });

  // Multimodal: stream qwen-vl-plus reading the supplier price-sheet IMAGE (sent as a real
  // image_url content part), then emit the structured SupplierQuote it extracted from the picture.
  app.post("/parse-document/stream", async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const body = ParseDocumentInputSchema.safeParse(raw);
    if (!body.success) return c.json({ error: body.error.flatten() }, 400);
    return streamSSE(c, async (stream) => {
      for await (const ev of parseDocumentStream(deps.provider, body.data)) {
        if (ev.type === "token") await stream.writeSSE({ event: "token", data: JSON.stringify({ token: ev.token }) });
        else await stream.writeSSE({ event: "quote", data: JSON.stringify(ev.quote) });
      }
    });
  });

  // Deterministic canonical demo for the hero heatmap animation. No Qwen call.
  // paceMs query param controls inter-frame delay (default 350ms; tests pass 0).
  app.get("/demo/entropy-stream", (c) => {
    const pace = Number(c.req.query("paceMs") ?? process.env.SSE_PACE_MS ?? 350);
    return streamSSE(c, async (stream) => {
      for (const update of demoEntropySequence()) {
        await stream.writeSSE({ event: "entropy", id: String(update.step), data: JSON.stringify(update) });
        if (pace > 0) await stream.sleep(pace);
      }
    });
  });

  registerCommitRoutes(app, deps.provider);
  registerApprovalRoutes(app);

  // ---- Improvement + promotion (Phase 6) ----
  const { procedureRepo, replayCases } = deps;
  if (procedureRepo) {
    app.post("/procedures/:id/improve", async (c) => {
      const version = await procedureRepo.get(c.req.param("id"));
      if (!version) return c.json({ error: "procedure version not found" }, 404);
      const body = await c.req.json();
      const ctx = FailureContextSchema.safeParse(body.failureContext);
      if (!ctx.success) return c.json({ error: ctx.error.flatten() }, 400);
      const patch = await proposeWorkflowPatch(deps.provider, ctx.data);
      return c.json({ patch });
    });

    app.post("/procedures/:id/promote", async (c) => {
      const old = await procedureRepo.get(c.req.param("id"));
      if (!old) return c.json({ error: "procedure version not found" }, 404);
      const body = await c.req.json();
      const patch = WorkflowPatchSchema.safeParse(body.patch);
      if (!patch.success) return c.json({ error: patch.error.flatten() }, 400);
      const cases = replayCases ?? [];

      const oldSpec = old.workflowSpec;
      const newSpec = applyPatch(oldSpec, patch.data);
      const report = runReplay({
        fromVersion: oldSpec.version,
        toVersion: newSpec.version,
        oldSpec,
        newSpec,
        cases,
      });
      const decision = runPromotionGate({
        fromVersion: oldSpec.version,
        toVersion: newSpec.version,
        baseline: report.baseline,
        candidate: report.candidate,
        caseCount: report.caseCount,
      });

      if (decision.type !== "promote") {
        return c.json({ decision, report, newVersionId: null });
      }

      const now = new Date().toISOString();
      const child: BusinessProcedureVersion = {
        ...old,
        id: `${old.id}-${newSpec.version}`,
        parentVersion: old.id,
        workflowSpec: newSpec,
        commitPolicy: newSpec.commitPolicy,
        evalResults: metricsToEvalResults(report.candidate),
        approvalRecord: null,
        rollbackPointer: old.id,
        runTraces: [],
        createdAt: now,
        promotedAt: now,
      };
      await procedureRepo.put(child);
      return c.json({ decision, report, newVersionId: child.id });
    });

    app.get("/procedures/:name/versions", async (c) => {
      const versions = await procedureRepo.listVersions(c.req.param("name"));
      return c.json({ versions });
    });

    app.get("/procedures/by-id/:id", async (c) => {
      const version = await procedureRepo.get(c.req.param("id"));
      if (!version) return c.json({ error: "procedure version not found" }, 404);
      return c.json({ version });
    });
  }

  return app;
}
