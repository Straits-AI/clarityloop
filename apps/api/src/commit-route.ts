import type { Hono } from "hono";
import type { ModelProvider } from "@clarityloop/qwen";
import { CommitRequestSchema, runCommitPipeline } from "./commit";

export function registerCommitRoutes(app: Hono, provider: ModelProvider): void {
  app.post("/commit", async (c) => {
    const parsed = CommitRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    const result = await runCommitPipeline(provider, parsed.data);
    return c.json(result);
  });
}
