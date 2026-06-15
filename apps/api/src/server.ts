import { serve } from "@hono/node-server";
import { DashScopeProvider } from "@clarityloop/qwen";
import { createApp } from "./app";

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) throw new Error("DASHSCOPE_API_KEY is required");

const app = createApp({
  provider: new DashScopeProvider({ apiKey, baseURL: process.env.DASHSCOPE_BASE_URL }),
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port }, () => console.log(`clarityloop api on :${port}`));
