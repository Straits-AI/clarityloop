# ClarityLoop — Design Spec

**Date:** 2026-06-16
**Status:** Approved (brainstorm complete, pre-implementation-plan)
**Competition:** Global AI Hackathon Series with Qwen Cloud — Track 4 "Autopilot Agent"
**Deadline:** 2026-07-09 14:00 PDT (2026-07-10 05:00 Malaysia)

---

## 1. Summary

ClarityLoop is an uncertainty-guided autopilot layer for business workflows. Qwen agents
generate and execute workflows dynamically, but ClarityLoop maintains a compact latent
workflow state, estimates operational uncertainty deterministically, gathers the next best
evidence, and only commits or promotes work when uncertainty, risk, and evidence thresholds
are satisfied.

Positioning (USP): **not** "dynamic workflows" — those exist. The differentiator is turning
dynamic agent behavior into **governed, versioned, auditable business procedures** via
uncertainty-guided loops, risk-tiered commit gates, and replay-based promotion.

Full product rationale, type sketches, and benchmark theory live in `/memo.md` (the strategy
brief). This spec is the **engineering contract** derived from it, plus the architecture
decisions made during brainstorming. Where the two differ, this spec wins.

---

## 2. Scope

**In (full memo scope — all 17 must-haves):**
1. Qwen API integration (OpenAI-compatible DashScope endpoint)
2. Alibaba Cloud backend deployment + proof
3. Dynamic WorkflowSpec generation
4. Latent state builder
5. Deterministic entropy scoring
6. Next-best-action loop controller
7. Customer-quote + supplier-quote-comparison workflows
8. Tools: memory lookup, catalog lookup, stock check, supplier-quote parser, quote drafter, compare
9. Commit gate
10. Human approval checkpoint for high-risk commit
11. Trace view
12. Replay benchmark view
13. Workflow patch proposal
14. Promotion gate
15. Public open-source repo + license
16. Architecture diagram
17. 3-minute demo video

**Should-have (build if time):** invoice-exception workflow, fixed-gate baseline, cost/token
dashboard, memory value score surfaced in UI, failure taxonomy, Qwen blog post.

**Out (do not build):** real ERP/email/payment/procurement integration, multi-tenant auth,
fine-tuning, RL, full CPV migration, full enterprise governance platform, large-scale vector
memory, OpenClaw/Hermes clone.

---

## 3. Architecture decisions (made during brainstorming)

### D1 — Deployment philosophy: portable-by-interface, ship Alibaba
The judged backend **must** run on Alibaba Cloud (mandatory rule + memo §12/Risk 8).
Cloudflare cannot be the submission deployment. We build on portable primitives so the
codebase runs on both, ship Alibaba for the submission, and keep a Cloudflare deploy as a
near-free second target and onboarding-stall fallback.

- **Submission target:** Alibaba **ECS** instance running **Docker Compose** (Hono API +
  Postgres), public IP, SSE streaming. Chosen over Function Compute because the entropy loop
  is long-running and streamed; ECS avoids serverless cold-start/timeout/streaming friction
  and gives an unambiguous "it's running on Alibaba" proof.
- **Rejected:** Cloudflare-native with Durable Objects / Workflows. Elegant for the stateful
  loop but **no Alibaba equivalent** → would make the mandatory deploy impossible. Explicitly
  avoided in the critical path.

### D2 — Frontend: Vite + React + TypeScript + Tailwind (SPA)
A dashboard with live updates, no SSR value. Pure client SPA talking to the Hono API over
SSE. Simpler and more portable than Next.js. Shared types imported from `packages/core`.
Served as static files (OSS static hosting, or by the API container).

### D3 — Entropy is deterministic over structured Qwen output (credibility backbone)
**Qwen never emits an entropy number.** Qwen returns structured latent state — `knownFacts[]`,
`missingFields[]`, `claims[]` each tagged with an `evidencePointer` (or `null`), risk/policy
flags. Deterministic TypeScript in `packages/core` computes every entropy component from that
structure using the memo §15 weights. This is what makes the "0.82 → 0.46 → 0.18" demo
trustworthy to technical judges instead of reading as LLM theater.

### D4 — Portability seams
- **Object storage:** S3-compatible adapter. OSS (Alibaba) ↔ R2 (Cloudflare), both speak S3.
- **Relational state:** repository-pattern interface. Postgres/RDS (Alibaba) ↔ SQLite/D1 (dev/CF).
- **API framework:** Hono — runs on Node (ECS) and Workers unchanged.
- **Model provider:** provider abstraction over the OpenAI-compatible client; Qwen via DashScope.

### D5 — Monorepo tooling
pnpm workspaces + Turborepo. TypeScript throughout. zod for all model-output validation.

---

## 4. Repository structure

```
clarityloop/
  apps/
    web/        Vite + React + Tailwind dashboard (SPA, SSE client)
    api/        Hono server — loop orchestration, SSE stream, REST endpoints
  packages/
    core/       Types, CommitGate, PromotionGate, entropy scorer (DETERMINISTIC, unit-tested)
    qwen/       DashScope OpenAI-compatible client, structured-JSON gen, zod validation, model routing
    tools/      retrieve_memory, lookup_catalog, check_stock, parse_supplier_quote, compare_quote, draft_quote
    verifiers/  schema, numeric reconciliation, evidence coverage, policy, hallucinated-tool, missing-info
    memory/     operational memory store, value scoring, TTL / conflict invalidation
    evals/      ClarityLoopBench cases, baseline runners, scoring reports
    storage/    S3-compatible storage adapter + repository-pattern DB layer
  docs/         architecture diagram, deployment proof, specs
  infra/        docker-compose, ECS deploy scripts, Cloudflare adapter (optional second target)
```

Design for isolation: each `packages/*` unit has one clear purpose, a typed interface, and is
testable independently. `core/` depends on nothing cloud-specific. Tools/verifiers depend on
`core/` types only. The loop controller (in `apps/api`) composes them.

---

## 5. Data flow

### Run loop (live, streamed)
```
user request
  → Qwen Workflow Designer        (Qwen Plus: generate WorkflowSpec)
  → WorkflowSpec schema validation (reject unauthorized tools)
  → Qwen latent-state extraction  (Qwen Flash: structured facts/missing/claims/flags)
  → deterministic entropy scorer  (core/: §15 weighted components)
  → loop controller               (argmax next-best-action: ΔentropyΔrisk − costs)
  → tool / verifier / memory / approval action
  → latent-state update → re-score
  → (repeat until stop condition)
  → Commit Gate                   (commit | needs_approval | needs_more_info | reject | sandbox_only)
  → Trace Store (OSS + Postgres)
```
Each entropy re-score is emitted over **SSE** so the dashboard heatmap animates in real time.

Stop condition: `commitEntropy < threshold` OR no useful info-gathering action remains OR
budget exhausted OR human approval required OR must ask for missing info.

### Improvement loop (offline)
```
failed/seed traces
  → Qwen failure analysis + patch proposal   (Qwen Plus/Max)
  → patch schema validation
  → Replay Benchmark (old vs new on seeded cases)
  → Promotion Gate (promote | reject | needs_human_review)
  → new BusinessProcedureVersion
```

---

## 6. Data model

Authoritative type sketches are in `/memo.md` §14 and are adopted as-is: `WorkflowSpec`,
`WorkflowStep`, `EvidencePolicy`, `CommitPolicy`, `EntropyScore`, `CandidateAction`,
`LatentWorkflowState`, `BusinessProcedureVersion`, `OperationalMemory`, `RunOutcome`,
`CommitDecision`, `PromotionDecision`.

Spec-level refinement on top of the memo:
- Every `claim` in latent state carries `evidencePointer: EvidenceRef | null` so evidence
  coverage and `unsupportedClaimScore` are computed, not guessed.
- Entropy components are a pure function `score(LatentWorkflowState): EntropyScore` in `core/`,
  no I/O, fully unit-tested against fixtures.
- `Trace` is append-only; each step records input, action chosen, tool output, entropy before/after.

---

## 7. Entropy & decision rules (deterministic, from memo §15)

```
commitEntropy =
    0.25 * missingFieldScore
  + 0.25 * unsupportedClaimScore
  + 0.20 * contradictionScore
  + 0.15 * policyAmbiguityScore
  + 0.10 * staleMemoryScore
  + 0.05 * toolFailureScore

actionScore = expectedEntropyReduction + expectedRiskReduction
            − tokenCost − latencyCost − humanBurdenCost − toolCost
```
Commit when `commitEntropy < threshold AND verifiers pass AND risk class allows AND no
blocking policy violation`. Risk-tiered approval (memo §17): human at the authority boundary,
not in every loop. Commit gate invariant: **the model may propose a commit; code decides
whether it is allowed.**

---

## 8. Qwen usage (depth drives the 30% innovation score)

Qwen does the generative work; deterministic code does the scoring/gating.

| Task | Model |
|---|---|
| extraction / classification / latent state | Qwen Flash |
| workflow generation, audit narrative | Qwen Plus |
| failure analysis, patch proposal | Qwen Plus / Max |
| supplier-quote parsing (PDF/image) | Qwen-VL |

Deterministic (never Qwen): entropy scoring, numeric reconciliation, evidence coverage, policy
checks, commit gate, promotion gate, memory TTL/conflict.

---

## 9. Benchmark — ClarityLoopBench

30–50 cases across customer-quote + supplier-comparison. Case types: clear, ambiguous, "same
as last time" memory, stale memory, supplier mismatch, catalog mismatch, missing delivery,
unauthorized discount, unsupported claim, adversarial attachment, policy exception, high-value
requiring approval.

Baselines: Bare Qwen | Dynamic Qwen Workflow | Fixed Gate | ClarityLoop.
Headline metrics: `false_commit_rate`, `safe_completion_rate`, `constraint_tax`,
`approval_burden`, `evidence_coverage`, `cost_per_safe_completion`.

Target claim: ClarityLoop matches a fixed gate's low false-commit rate **with lower constraint
tax**, because it loops for missing signal before blocking.

---

## 10. UI (15% presentation; the heatmap is the hero)

Dashboard panels: input request, generated workflow, latent-state / uncertainty heatmap,
next-best-action, evidence map, tool-call trace, commit-gate decision, workflow-patch proposal,
replay benchmark, procedure version history. Three-column demo layout: Baseline | ClarityLoop |
Promotion benchmark. Single most important visual: `commit entropy 0.82 → 0.46 → 0.18`,
animated live via SSE.

---

## 11. Testing strategy

- **Deterministic core** (entropy scorer, commit/promotion gates, verifiers, memory scoring):
  real unit tests against fixtures. These are the auditable kernel and must be provably correct.
- **Qwen-dependent steps:** zod schema-validation tests + small fixture set; assert structure
  and invariants, not output equality.
- **End-to-end:** the ClarityLoopBench runner doubles as integration coverage for the loop.

---

## 12. Phasing & critical path

**Phase 0 (DAY 1, CRITICAL PATH — top submission risk):** stand up Alibaba Cloud account,
enable Model Studio + obtain Qwen/DashScope API key, provision a small ECS instance, deploy a
"hello world" Hono container, capture deployment proof. Nothing else is real until the
mandatory deploy target exists. Malaysia-based onboarding/KYC/billing can be slow — start now.

1. **Phase 1 — Repo + Qwen + Alibaba skeleton:** monorepo, Qwen client, storage/repository
   adapters, ECS hello-world deploy, license, proof-of-deployment file.
2. **Phase 2 — Workflow generation:** WorkflowSpec, Qwen generation, schema validation, unauthorized-tool rejection.
3. **Phase 3 — Latent state + entropy:** structured extraction, deterministic scorer, heatmap UI.
4. **Phase 4 — Tool loop:** the six tools, next-best-action scorer, loop until stop.
5. **Phase 5 — Commit gate:** evidence/numeric/policy verifiers, commit decision, approval screen.
6. **Phase 6 — Improvement:** trace store, Qwen patch proposal, replay benchmark, promotion gate.
7. **Phase 7 — Polish:** ClarityLoopBench seed cases, baseline comparison, architecture diagram, 3-min video, README + Devpost text.

---

## 13. Risks (from memo §28, plus deployment)

- **"Just Claude Code dynamic workflows":** differentiate on governed-procedure promotion,
  commit readiness, replay, risk-tiered approval, bounded memory.
- **"Safety makes agents dumb":** only authority-boundary actions are gated; benchmark measures
  constraint tax explicitly.
- **"Qwen usage superficial":** Qwen visibly generates workflows, builds latent state, parses
  documents, analyzes failures, proposes patches, writes audit narratives.
- **"Alibaba deployment friction":** mitigated by Phase 0 critical path + portable-by-interface
  design with Cloudflare fallback.
- **"Too abstract":** concrete vertical slice (unsafe quote prevented, uncertainty reduced,
  workflow improved, benchmark shown).

---

## 14. Definition of done (submission-ready)

- [ ] Public repo with OSI license
- [ ] Backend deployed and running on Alibaba Cloud, with recorded proof + code file
- [ ] Live customer-quote demo: baseline vs ClarityLoop vs promotion, entropy heatmap animating
- [ ] Commit gate + human approval checkpoint working
- [ ] Workflow patch proposal + replay benchmark + promotion producing a new procedure version
- [ ] ClarityLoopBench (30–50 cases) with baseline comparison numbers
- [ ] Architecture diagram
- [ ] 3-minute demo video
- [ ] README + Devpost write-up
