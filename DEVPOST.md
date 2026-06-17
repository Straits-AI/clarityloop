# ClarityLoop — Uncertainty-Guided Autopilot for Governed Business Workflows

> Let agents explore freely. Loop for missing signal. Commit only when uncertainty is low enough
> for the business risk.

## Inspiration
Dynamic agents can complete business tasks, but they finalize unsafe work when the input is
ambiguous — assuming a SKU, using stale memory, missing the current price, inventing delivery, or
applying an unauthorized discount. The missing layer is the conversion from improvised agent
behavior into a governed, versioned, auditable business procedure.

## What it does
ClarityLoop maintains a compact latent workflow state, scores operational uncertainty
deterministically, chooses the next best evidence-gathering action, and only commits or promotes
work when uncertainty, risk, and evidence thresholds are satisfied. The hero visual is the live
commit-entropy reduction `0.82 → 0.46 → 0.18`.

## How we built it
A pnpm + Turborepo TypeScript monorepo: `packages/core` (deterministic entropy scorer, commit gate,
promotion gate — unit-tested), `packages/qwen` (DashScope OpenAI-compatible provider + zod-validated
structured generation), `packages/tools` + `packages/verifiers`, `packages/storage` (S3-compatible
OSS + Postgres repositories), `apps/api` (Hono loop orchestration + SSE), and `apps/web` (Vite +
React dashboard with the entropy heatmap and the three-column demo).

## Qwen
Qwen does the generative work: workflow generation (Qwen Plus), structured latent-state extraction
(Qwen Flash), supplier-quote parsing (Qwen-VL), failure analysis + workflow-patch proposal
(Qwen Plus/Max), and audit narratives. Deterministic TypeScript does all scoring and gating.

## Alibaba Cloud
The backend is deployed on Alibaba Cloud ECS (Docker Compose: Hono + Postgres) with artifacts in OSS
and models via Model Studio / DashScope. Deployment proof: `docs/deployment-proof.md`.

## ClarityLoopBench
36 seeded cases across customer-quote and supplier-comparison, twelve case types (clear, ambiguous,
"same as last time", stale memory, supplier/catalog mismatch, missing delivery, unauthorized
discount, unsupported claim, adversarial attachment, policy exception, high value). Four baselines —
Bare Qwen, Dynamic Qwen Workflow, Fixed Gate, ClarityLoop — scored on false-commit rate, safe
completion rate, constraint tax, safety gain, approval burden, and evidence coverage. Headline
result: ClarityLoop matches a fixed gate's low false-commit rate with lower constraint tax and lower
approval burden, because it loops for missing signal before blocking. Run it: `pnpm --filter
@clarityloop/evals bench`.

## Challenges, accomplishments, what's next
Keeping the model out of the scoring path was the key design discipline. Next: invoice-exception
workflow, larger memory store, and the Cloudflare portability target.

## License
Open source (see `LICENSE`).
