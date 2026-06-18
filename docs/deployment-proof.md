# Alibaba Cloud Deployment Proof

**Status: LIVE** — the ClarityLoop backend is deployed and running on Alibaba Cloud Function Compute.

## Deployment

- **Service:** Alibaba Cloud **Function Compute 3.0** (Web Function, Custom Runtime / Node.js 20)
- **Region:** Singapore (`ap-southeast-1`)
- **Function:** `clarityloop-api`
- **Public endpoint:** `https://clarityloop-api-jewijtekcx.ap-southeast-1.fcapp.run`
- **Scaling:** on-demand, **min instances = 0** (scales to zero → no idle cost); in-memory repositories (no VPC / no NAT gateway)
- **Build:** `apps/api/src/server-fc.ts` bundled to a single file via `pnpm --filter @clarityloop/api build:fc`

## "Use of Alibaba Cloud services and APIs" (code proof)

- **Qwen via Alibaba Model Studio / DashScope:** [`packages/qwen/src/dashscope.ts`](../packages/qwen/src/dashscope.ts) — OpenAI-compatible client pointed at the workspace's dedicated DashScope endpoint (`…maas.aliyuncs.com/compatible-mode/v1`).
- **Alibaba Object Storage Service (OSS):** [`packages/storage/src/oss-store.ts`](../packages/storage/src/oss-store.ts) — S3-compatible artifact store.

## Verification (live, against the public endpoint)

```
$ curl https://clarityloop-api-jewijtekcx.ap-southeast-1.fcapp.run/health
{"status":"ok"}

# Live Qwen call FROM the Alibaba-hosted function (Qwen Cloud requirement):
$ curl https://clarityloop-api-jewijtekcx.ap-southeast-1.fcapp.run/qwen/ping
{"reply":"ok"}

# Deterministic entropy scorer:
$ curl -X POST .../score -d '{...latent state...}'
{"taskEntropy":0,"evidenceEntropy":1,"actionEntropy":0.5,"policyEntropy":0,"memoryEntropy":0,"commitEntropy":0.25}

# Hero demo: live SSE entropy stream (the heatmap source):
$ curl ".../demo/entropy-stream?paceMs=0"
event: entropy
data: {"step":0,"phase":"scored", ... }

# Live Qwen WorkflowSpec generation (Qwen outline -> deterministic governed spec):
$ curl -X POST .../workflow -d '{"request":"need 120 cartons urgently next week...","domain":"quote"}'
{"runId":"run_...","workflowSpec":{"name":"Urgent Carton Quote Processing","trigger":{"domain":"quote"},
 "steps":[{"action":{"type":"tool","toolName":"retrieve_memory"}}, ...]}}
```

Both mandatory requirements are satisfied: the **backend runs on Alibaba Cloud**, and it **uses Qwen models via Qwen Cloud (Model Studio / DashScope)**. Every route — including live Qwen workflow generation — is verified working against the public endpoint.
