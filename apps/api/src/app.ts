import { Hono } from "hono";
import { LatentWorkflowStateSchema, scoreEntropy } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";

export type AppDeps = { provider: ModelProvider };

export function createApp(deps: AppDeps) {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.post("/score", async (c) => {
    const parsed = LatentWorkflowStateSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
    return c.json(scoreEntropy(parsed.data));
  });

  // Smoke endpoint to prove live Qwen connectivity from the deployed environment.
  app.get("/qwen/ping", async (c) => {
    const reply = await deps.provider.complete(
      [{ role: "user", content: "reply with the single word ok" }],
      { task: "extraction" },
    );
    return c.json({ reply });
  });

  return app;
}
