# ClarityLoop — Uncertainty-Aware Release Control for Agent-Authored Workflows

> **Harnesses evolve. ClarityLoop decides what ships.**
> Let agents explore freely. Loop for missing signal. Commit only when uncertainty is low enough
> for the business risk.

## Inspiration
Agents — and harness-evolution systems like **HarnessX** (arXiv:2606.14249) — are getting good at
*generating and improving* workflows. But more capable generation makes the harder question louder:
**when is an evolved workflow safe enough, clear enough, and authorized enough to actually commit
or promote into a business procedure?** Dynamic agents finalize unsafe work when the input is
ambiguous — assuming a SKU, using stale memory, missing the current price, inventing delivery,
applying an unauthorized discount, or following an adversarial attachment. ClarityLoop is the
**release-control** layer for that: harnesses optimize performance; ClarityLoop governs the
autonomy boundary.

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
The backend is **deployed live on Alibaba Cloud Function Compute** (Singapore, serverless,
scale-to-zero, in-memory build), calling Qwen via **Model Studio / DashScope**; the OSS adapter
(`packages/storage`) and the DashScope client (`packages/qwen`) demonstrate Alibaba API use in code.
Public endpoint and verification (`/health`, live `/qwen/ping`, `/workflow`): `docs/deployment-proof.md`.

## ClarityLoopBench (honest benchmark)
36 seeded cases across customer-quote and supplier-comparison, twelve case types. **Five baselines**
scored by **one uniform rubric** (no per-baseline special-casing): Bare Qwen, Dynamic Qwen Workflow,
**Harness Evolution** (a HarnessX-like, performance-optimized agent with *no risk gate*), Fixed Gate,
and ClarityLoop. Fixed Gate and ClarityLoop run the **same shipped commit gate** — the only
difference is the evidence loop.

| Baseline | Completion | False commit |
| --- | --- | --- |
| Bare Qwen | 100% | 92% |
| Dynamic Qwen Workflow | 100% | 56% |
| Harness Evolution (no gate) | 100% | 36% |
| Fixed Gate | 31% | 0% |
| **ClarityLoop** | **86%** | **0%** |

ClarityLoop matches the fixed gate's **0% false-commit** but **~triples completion (86% vs 31%)**;
versus a performance-optimized evolved harness it trades **14% completion to eliminate all 36% of
unsafe commits**. That is the thesis: *harness evolution buys performance; the risk gate buys
safety.* Run it: `pnpm --filter @clarityloop/evals bench`.

## vs HarnessX (and why we measure a different axis)
HarnessX (arXiv:2606.14249) raises **task success rate** (+14.5% avg) on capability suites
(ALFWorld, GAIA, SWE-bench…). ClarityLoop is on the **safety axis** — the AgentDojo / InjecAgent
family — so we report the AgentDojo-style **attack success rate**: a HarnessX-class evolved harness
has **100% ASR** (it follows every adversarial attachment); ClarityLoop drives it to **0%**. They
**compose** — ClarityLoop wraps an evolved agent to keep its capability and remove its unsafe
commits. Full analysis: [`docs/harnessx-vs-clarityloop.md`](docs/harnessx-vs-clarityloop.md).
**Harnesses evolve. ClarityLoop decides what ships.**

## Challenges, accomplishments, what's next
Keeping the model out of the scoring path was the key design discipline. Next: invoice-exception
workflow, larger memory store, and the Cloudflare portability target.

## License
Open source (see `LICENSE`).
