# 001 — Literature Review (Phase 1, deep: 45+ papers across 4 clusters)

**Date:** 2026-06-18
**Phase:** 1
**Status:** completed (5 of 6 parallel searchers synthesized; 6th overlapped, no new claims)
**Method:** 6 parallel literature subagents (web + arXiv), each a distinct cluster; all arXiv IDs the
searchers could fetch were verified, 2026 preprints flagged author-claimed/unverified where noted.

## Why this review exists
003 disconfirmed the "entropy drives the gate" assumption; 004 rehabilitated entropy only in a
calibrated diffuse regime. The contribution must therefore be positioned precisely: not "uncertainty
magic", but **a separable release-control layer that maps authority + risk + (calibrated) uncertainty
→ commit / escalate / reject / promote**. This review locates that claim against four literatures.

## Cluster A — Harness evolution / self-improving agents (the thing we are NOT)
HarnessX (2606.14249, +14.5% avg task success), Agentic Harness Engineering (2604.25850, 69.7→77.0%
Terminal-Bench), ADAS (2408.08435), AFlow (2410.10762), Gödel Agent (2410.04444), Trace/OPTO
(2406.16218), DSPy (2310.03714), TPGO (2604.20714), SIPDO (2505.19514).
**Finding:** every method optimizes **task success** via trace-driven harness/workflow improvement.
**Safety/governance is essentially absent** — only Agentic Harness Engineering's "falsifiable
contracts" gesture at verification, framed for convergence not safety. → Clean wedge: *harnesses
evolve; ClarityLoop decides what ships.* Capability and governance are separable, and this cluster
owns capability and ignores governance.

## Cluster B — Uncertainty / calibration / selective prediction (the entropy critique, decisive for 004)
Semantic Uncertainty (2302.09664), Kernel Language Entropy (2405.20003), Semantic Density
(2405.13845), **Semantic Energy (2508.14496 — built on the premise that entropy *fails* in
identifiable regimes)**, UQ survey (2410.15326), **From Entropy to Calibrated Uncertainty
(2603.06317 — raw entropy is NOT calibrated; needs Platt-scaling + RL alignment to become reliable)**,
**When to ASK (2604.02226 — gates *actions* on MC-dropout uncertainty; gets reward 0.95 in transfer
but ZERO in-domain benefit; warns against "simple combination")**, decision-making w/ uncertainty
(2404.02649, Thompson sampling), cost-saving cascades w/ early abstention (2502.09054).
**Finding (directly explains 004's 33% leak):** the field does **not** support a naive aggregated
entropy threshold as a reliable action-commit signal — several papers document its failure. A
*calibrated, semantically-aggregated, decision-theoretically-embedded* signal does have support.
**Crucial gap:** *no paper validates calibrated uncertainty as a gate for irreversible agent
actions.* That is ClarityLoop's uncertainty-axis white space — and 004 shows calibration is the lever.

## Cluster C — Agent governance / commit gates / authorization (where our MEASURED wins live)
**ReDAct (2604.07036) — the single closest prior work: "uncertainty-aware deferral", token-level
uncertainty → defer to a larger model.** AgentSpec (2503.18666, ICSE'26, DSL runtime enforcement,
90%+ unsafe-exec prevented, sub-ms), Progent (2504.11703, least-privilege per tool call, SMT checks),
MAC for agents (2601.11893), **Before the Tool Call (2603.20953 — deterministic *pre-action*
authorization)**, Governance-Aware Telemetry (2604.05119, closed-loop enforce), Policies-on-Paths
(2603.16586), Trace-Based Assurance (2603.18096), Foundational Guardrail/Safiron (2510.09781,
pre-exec risk detection), SafePred (2602.01725, world-model predictive guardrail), VeriGuard
(2510.05156), Progent/AIP/SentinelAgent delegation (2603.24775, 2604.02767), Design Patterns
(2506.08837 — "user authorization / minimal privilege" as principle).
**Finding:** runtime governance is converging as a *separable* authorization+escalation layer, but
splits into two non-communicating halves — **uncertainty-gated** (ReDAct alone) vs
**authority/privilege-gated** (AgentSpec, Progent, Before-the-Tool-Call, MAC). **No framework unifies
epistemic uncertainty + risk scoring + authority boundary + human-in-the-loop approval in one decision
layer.** That unification — "enough certainty *and* enough authority ⇒ safe to commit" — is the named
missing piece (stated verbatim as an open problem by the Cluster-C synthesis). ClarityLoop sits
exactly here, and 003/004 honestly show its *current* mass is on the authority/risk half (the
AgentSpec/Progent family), with the uncertainty half scoped + calibration-dependent.

## Cluster D — Injection defenses & safety benchmarks (the external evaluation axis + baselines)
Benchmarks: InjecAgent (2403.02691, ReAct-GPT-4 ASR 24%), **AgentDojo (2406.13352, 97 tasks/629
security cases — the standard dual-axis utility+ASR testbed)**, ToolEmu (2309.15817, 23.9% residual
failure), ASB (2410.02644, avg ASR 84.3%), Agent-SafetyBench (2412.14470, no agent >60% safe),
SafeAgentBench (2412.13178, ~10% hazard refusal), OS-Harm (2506.14866), AgentAuditor (2506.00641,
human-level judge), plus 2026 stateful successors (Saber 2606.01317 >54% HSR, ClawsBench 2604.05172
7–23% unsafe-action, MUZZLE, MSB — **flagged needs-verification**).
Defenses: **PromptArmor (2507.15219 — input sanitization, <1% AgentDojo ASR, the hard number to
beat)**, Design Patterns (2506.08837, provable-by-construction but *no benchmarked ASR*), Critical
Evaluation (2505.18333 — most published defense numbers collapse under adaptive attack + utility).
**Finding:** the field overwhelmingly *measures* the problem; *defenses* are thin. PromptArmor filters
**inputs**; it cannot help once detection misses. ClarityLoop's authority gate enforces at **action**
time → residual protection where input filtering fails (the stateful/adaptive setting). **Baseline to
beat: PromptArmor's <1% AgentDojo ASR**, and the win must show (1) utility preservation per 2505.18333
methodology and (2) protection where sanitization misses.

## Novelty statement (post-review, honest)
**Two genuinely novel vectors, both surviving the 003/004 honesty audit:**
1. **A unified commit-decision layer** mapping authority-boundary + risk class + *calibrated* diffuse
   uncertainty → commit/escalate/reject — the unification Cluster C names as missing and ReDAct only
   half-implements (uncertainty only, model-to-model, no authority/risk/human axis).
2. **Replay-based, safety-*improvement*-gated promotion** — Cluster's release-management work
   (Automated Self-Testing 2603.15676, LLM Readiness Harness 2603.27355) gates on quality/readiness
   *thresholds*; AgentAssay (2603.02601) does replay regression but no promotion gate. **No system
   gates promotion on "replay shows the candidate is *safer than the incumbent*".** White space.

## What this constrains downstream (branch-of-origin notes)
- Phase 2 hypothesis must be the unification in (1), with **calibration** as the named reliability
  mechanism for the uncertainty term (not raw entropy) — or it contradicts 004 + Cluster B.
- Phase 4 strong-baseline gate: deterministic bench baselines = harness_evolution (capability-only,
  Cluster A) + fixed_gate (authorization-only, no loop); external = PromptArmor <1% on AgentDojo.
- The paper must **not** claim entropy drives the headline bench (003), and must state the
  shipped-0.3 mis-calibration + the "no validated calibrated gate for irreversible actions" gap as
  honest limitations/contributions.
