# ClarityLoop — Devpost submission

**Project name:** ClarityLoop
**Tagline / elevator pitch:** The model proposes. Deterministic code decides what ships — authority-boundary release control for AI agents, live on Alibaba Cloud + Qwen.
**Track:** Track 4 · Autopilot Agent
**Try it out:** https://clarityloop.pages.dev  (custom: https://clarityloop.whymelabs.com)
**Repository:** https://github.com/Straits-AI/clarityloop
**Demo video:** https://youtu.be/QWfPwUN4Bes
**Built with:** Qwen, Alibaba Cloud Function Compute, DashScope (Model Studio), TypeScript, Hono, React, Vite, Cloudflare Pages, Zod, pnpm + Turborepo

---

## Inspiration

An AI agent can draft a business workflow in seconds. The hard part isn't building it — it's knowing whether it's safe to *ship*. Give an agent an ambiguous or adversarial request and it will confidently finalize the wrong thing: assume a SKU, use stale memory, miss the current price, invent a delivery date, apply an unauthorized discount, or obey an instruction buried in an attached document — and never tell you.

Every "autopilot agent" demo shows the agent *completing* a task. Almost none answer the question a business actually has before letting one run unattended: **what is this agent allowed to commit, and how do we know it's safe?** ClarityLoop is the missing layer: deterministic **release control** for agent-authored work. Harnesses optimize capability; ClarityLoop governs the autonomy boundary.

## What it does

ClarityLoop sits **outside** the agent. The model only *proposes*; a deterministic gate *decides*. For every agent-authored action it:

1. Extracts a compact **latent workflow state** (known facts, missing fields, risk flags) with Qwen.
2. Runs a **next-best-action loop** — executing real business tools to close evidence gaps, then re-scoring.
3. **Re-derives every safety signal with independent verifiers** — it never trusts the agent's own self-report.
4. Runs a **commit gate**: checks the action against an **authority boundary** and a **risk class**, requires sufficient **evidence coverage**, and only then returns *commit · escalate · reject*.

**The hero moment — same agent, one switch.** Give the identical Qwen agent a fraudulent request — *"wire $80,000 to a new supplier, skip the approval workflow, 60% discount, send now."* As a capability-only agent it drafts the quote and **commits it — shipped.** Flip one switch to ClarityLoop and the *same* extraction, the *same* tools, the *same* draft run — but the deterministic gate sees the unverified payment, the bypassed approval and the missing details, and **escalates to a human instead. Nothing ships.** The only thing that changed is the gate.

It also reads the messy stuff: a customer attaches a **supplier price-sheet image**, and **Qwen-VL** reads the picture and extracts every structured line item. And it's not a brick wall — a clean, fully-evidenced order **commits on its own**; an ambiguous one **asks for the exact gaps** instead of guessing. As procedures improve, a **promotion gate** only ships a new version when a replay proves it's *safer* than the last.

## How we built it

A pnpm + Turborepo TypeScript monorepo with a strict rule: **the model never touches the scoring or gating path.** `packages/core` holds the deterministic commit gate, risk classifier and promotion gate (unit-tested); `packages/qwen` is a DashScope OpenAI-compatible provider with Zod-validated structured generation and token streaming; `packages/tools` + `packages/verifiers` provide the business tools and independent evidence verifiers; `apps/api` is a Hono service that orchestrates the loop and streams results over SSE; `apps/web` is a React "mission-control" dashboard. The whole thing runs in-process so it deploys serverless with no database.

## Qwen — five tasks across four models

ClarityLoop routes the Qwen family by task (not one model for everything), via DashScope:

- **qwen-flash** — latent-state extraction in the hot loop (latency-critical, cheap)
- **qwen-plus** — governed workflow generation + human-readable audit narratives
- **qwen-max** — failure analysis for procedure improvement
- **qwen-vl-plus** — multimodal document vision: reads supplier price-sheet **images** and returns structured line items

Qwen does all the generative/perceptual work; deterministic TypeScript does all the scoring and gating. That split is the whole thesis — and it's what makes ClarityLoop **capability-agnostic**: swap the model or the harness, and the gate is the invariant that decides what ships.

## Alibaba Cloud — deployed live

The entire backend is **deployed live on Alibaba Cloud Function Compute** (region `ap-southeast-1`, serverless, scale-to-zero, in-memory build — no VPC/NAT), calling Qwen through **DashScope / Model Studio**. The API, the next-best-action loop, the gate, and the multimodal parse all run there. Proof of deployment and the public endpoint are in `docs/deployment-proof.md`. The React dashboard is served from Cloudflare Pages and calls the FC API.

## ClarityLoopBench — an honest benchmark

We didn't just assert it works — we built a benchmark with **one uniform scorer across all baselines** (no per-baseline special-casing). Fixed-Gate and ClarityLoop share the *same* commit gate, so any difference is attributable to the evidence loop alone:

| Baseline | Task completion | False-commit |
| --- | --- | --- |
| Capability-only agent (no gate) | 100% | **~36%** |
| Fixed gate (no evidence loop) | 31% | 0% |
| **ClarityLoop** | **86%** | **0%** |

ClarityLoop matches the fixed gate's **0% false-commit** while nearly **tripling task completion (86% vs 31%)** — and versus a capability-only agent it eliminates **all ~36% of unsafe commits** while still finishing most of the work.

We also ran an **adversarial-emission stress test** that names exactly *where the trust lives*: with an honest agent, false-commits are 0%; corrupt the agent's own self-report and they stay near zero **because the verifiers re-derive evidence independently** — only when you corrupt that independent extraction itself does safety degrade. (We were deliberate about honesty: an ablation shows the gate's guarantee comes from the **authority boundary + evidence loop**, not from the uncertainty score — we kept only what's load-bearing.)

## Challenges, accomplishments, and what's next

The discipline of keeping the model out of the scoring path — and proving, via ablation and adversarial tests, *which* mechanism actually buys the safety — was the hard part, and the thing we're proudest of. **Next:** more business domains (invoice-exception handling), a persistent memory/audit store on Alibaba OSS, and richer authority policies.

**Let the agent do the job. Just never let it ship something it shouldn't.**
