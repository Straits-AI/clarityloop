// Function Compute entrypoint: in-memory repositories (no Postgres / no VPC / no NAT),
// listening on the FC-provided port. This keeps the deployment serverless and cost-free
// when idle. Persistence is per-instance only — fine for the demo; the benchmark, replay,
// and loop all run in-process.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { DashScopeProvider } from "@clarityloop/qwen";
import { ToolNameSchema } from "@clarityloop/core";
import {
  InMemoryRunRepository,
  InMemoryProcedureVersionRepository,
  InMemoryTraceRepository,
} from "@clarityloop/storage";
import { SEED_CASES } from "@clarityloop/evals";
import { createApp } from "./app";

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) throw new Error("DASHSCOPE_API_KEY is required");

const app = createApp({
  provider: new DashScopeProvider({ apiKey, baseURL: process.env.DASHSCOPE_BASE_URL }),
  runs: new InMemoryRunRepository(),
  allowedTools: [...ToolNameSchema.options],
  procedureRepo: new InMemoryProcedureVersionRepository(),
  traceRepo: new InMemoryTraceRepository(),
  replayCases: SEED_CASES,
});

// Serve the built dashboard from the SAME origin so the fcapp URL is a clickable live demo and
// the UI calls the API with no CORS. API routes (registered above) take precedence; static assets
// are served from ./web in the FC zip, and any other path falls back to the SPA's index.html.
const WEB_ROOT = "web";
app.use("/*", serveStatic({ root: WEB_ROOT }));
app.get("*", serveStatic({ path: `${WEB_ROOT}/index.html` }));

// Function Compute custom runtime supplies the listen port via FC_SERVER_PORT (default 9000).
const port = Number(process.env.FC_SERVER_PORT ?? process.env.PORT ?? 9000);
serve({ fetch: app.fetch, port }, () => console.log(`clarityloop api (FC, in-memory) on :${port}`));
