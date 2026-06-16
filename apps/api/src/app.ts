import { Hono } from "hono";
import { z } from "zod";
import {
  LatentWorkflowStateSchema, scoreEntropy, WorkflowDomainSchema,
  UnauthorizedToolError, type ToolName,
} from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import type { RunRecord, RunRepository } from "@clarityloop/storage";
import { designWorkflow } from "./workflow-designer";

export type AppDeps = {
  provider: ModelProvider;
  runs: RunRepository;
  allowedTools: ToolName[];
  newId?: () => string;
};

const WorkflowRequestSchema = z.object({
  request: z.string().min(1),
  domain: WorkflowDomainSchema.optional(),
});

export function createApp(deps: AppDeps) {
  const app = new Hono();
  const newId = deps.newId ?? (() => `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

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
      const spec = await designWorkflow(deps.provider, { request, domain, allowedTools: deps.allowedTools });
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
      await deps.runs.create(run);
      return c.json({ runId: run.id, workflowSpec: spec });
    } catch (e) {
      if (e instanceof UnauthorizedToolError) {
        return c.json({ error: "unauthorized_tool", unauthorizedTools: e.unauthorizedTools }, 422);
      }
      throw e;
    }
  });

  return app;
}
