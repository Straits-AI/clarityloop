import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { DashScopeProvider } from "@clarityloop/qwen";
import { ToolNameSchema } from "@clarityloop/core";
import { PgRunRepository, INIT_SQL, InMemoryProcedureVersionRepository, InMemoryTraceRepository } from "@clarityloop/storage";
import { SEED_CASES } from "@clarityloop/evals";
import { createApp } from "./app";

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) throw new Error("DASHSCOPE_API_KEY is required");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl });
await pool.query(INIT_SQL);

const app = createApp({
  provider: new DashScopeProvider({ apiKey, baseURL: process.env.DASHSCOPE_BASE_URL }),
  runs: new PgRunRepository(pool),
  allowedTools: [...ToolNameSchema.options],
  // NOTE: in-memory repositories are used until the Pg* repositories are wired
  // via DATABASE_URL. Swapping is a one-line change behind the repository interface.
  procedureRepo: new InMemoryProcedureVersionRepository(),
  traceRepo: new InMemoryTraceRepository(),
  replayCases: SEED_CASES,
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => console.log(`clarityloop api on :${port}`));
