# 000 — Research Setup

**Date:** 2026-06-18
**Phase:** 0
**Status:** in-progress

## Idea DNA

**Problem** (bedrock, not symptom):
Agent *capability* and agent *governance* are conflated. There is no principled layer that decides
**when an agent-authored workflow is clear, safe, and authorized enough to commit or promote** into
a business procedure. Documented real failures: indirect prompt injection (AgentDojo: high attack
success; InjecAgent: ReAct-GPT-4 vulnerable 24%), unsafe tool use, unauthorized financial actions.
*First-principles check:* the failure (an agent executing an unauthorized/unsafe external action) is
a real, measured phenomenon — bedrock, not a framing artifact.

**Assumption:**
- (explicit, from the project memo/USP) A *release-control gate* can preserve most of an agent's
  task completion while eliminating its unsafe commits — a favourable constraint-tax-for-safety-gain
  trade.
- (**inferred — LOAD-BEARING**) The *uncertainty/entropy* estimation is what drives the gate's
  decisions. ⚠ The adversarial review (session) flagged that the entropy threshold rarely binds and
  the wins may come from the authority-boundary gate + evidence loop, NOT entropy. **This is the
  assumption the central experiment must test.** If it is false, the honest contribution is
  "authority-boundary release control + evidence loop", and the "entropy-aware" framing must be
  dropped or demoted.

**Novelty claim:**
Uncertainty-aware *release control* as a **separable layer** — distinct from (a) harness evolution
(HarnessX: capability/success-rate) and (b) static guardrails / PI-detectors (AgentDojo defenses) —
that decides commit/escalate/reject/promote, with replay-based promotion. Post-HarnessX wedge:
"harnesses evolve; release control decides what ships."

**Domain:** LLM-agent safety / governance (systems + evaluation).

## Success criteria (specific, falsifiable)

- **PRIMARY (runnable now, deterministic — the decisive test): Entropy ablation.**
  Compare full ClarityLoop vs an *entropy-ablated* variant (identical gate + evidence loop, but the
  commit-entropy threshold removed/disabled) on ClarityLoopBench.
  - If safe-completion / false-commit differ by **< 2 pp** → the entropy mechanism is **NOT
    load-bearing** (honest finding: contribution is the gate + loop). Threshold for "decorative".
  - If they differ by **≥ 5 pp**, with a mechanistic explanation of *which cases* entropy catches
    that the hard branches miss → entropy contributes; thesis claim survives.
- **SECONDARY (external, user-gated): AgentDojo attack-success-rate.**
  Baseline agent vs ClarityLoop-gated agent on AgentDojo banking (≥1 suite). Success = ClarityLoop
  ASR materially below baseline ASR at acceptable utility-under-attack. **Requires a live LLM key
  (DASHSCOPE_API_KEY) — see constraint below.**
- **Robustness:** deterministic bench result stable across case-corpus perturbations (seeds/expansion).

## ⚠ Hard constraint — the empirical core is partly user-gated

Running real LLM agents through AgentDojo needs a live Qwen key (`DASHSCOPE_API_KEY`) in this
environment, which the orchestrator does NOT possess (it lives only in the deployed Function
Compute function). Therefore:
- **I CAN run now (no key):** the entropy ablation + all deterministic-bench experiments, literature
  positioning, theory, hypothesis, analysis, and the paper. The PRIMARY/decisive experiment is fully
  runnable.
- **User-gated (needs key):** the AgentDojo live-agent run. The harness is built (`bench/agentdojo/`);
  the user runs one command and pastes results. The paper will mark these as user-run external
  validation, not orchestrator-measured.

## Quick literature scan (3-5, from this session)

- **HarnessX** (arXiv:2606.14249) — harness evolution, +14.5% avg task **success** (capability axis).
- **AgentDojo** (Debenedetti 2024) — 629 prompt-injection cases; metric = **attack success rate** +
  utility-under-attack (the safety axis; the right family for us).
- **InjecAgent** (Zhan 2024) — 1,054 IPI cases; ReAct-GPT-4 vulnerable 24%.
- (to expand in Phase 1) ToolEmu, OS-Harm, AgentAuditor, Saber, guardrail/constitutional methods.

## Compute environment
- Local: macOS (Darwin 25.2.0), Node 20 / pnpm (TS monorepo), Python 3.11 + venv `.venv-agentdojo`.
- Deterministic bench: no GPU, no API — runs in seconds (`pnpm --filter @clarityloop/evals bench`).
- AgentDojo: needs DashScope API (user-gated).

## Evaluation contract → see `experiments/configs/evaluation-contract.md`

## Research intensity: TBD (user checkpoint)
