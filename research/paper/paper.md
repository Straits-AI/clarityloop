# Release Control for Agent Workflows: The Trust Boundary Is Extraction, Not Uncertainty

**Working paper, v2 — 2026-06-18.** Reproducible artifacts: `research/experiments/`, prediction ledger `research/results.tsv`, deterministic benchmark `packages/evals`. v2 reframes v1 in response to an adversarial paper review (the circular headline number is demoted; emission robustness is now the spine; claims are bounded and given confidence intervals).

## Abstract

Self-improving agent *harnesses* raise task success (HarnessX: +14.5% avg) while treating governance as out of scope; capability-only agents in our benchmark commit unsafe actions in 36% of risk-bearing cases. We study a deterministic **release-control layer** — the agent emits a schema-validated operational state and deterministic code decides `commit / escalate / reject / promote` — and report what is and is not load-bearing in it, with the disconfirmations foregrounded. Three results survive scrutiny. **(1) Attribution.** A fixed gate and the full system share an *identical* commit predicate, differing only by an evidence-gathering loop; the loop, not the gate's strictness and not uncertainty estimation, is what lifts completion from 31% to 86% at 0% false-commit — a clean provable decomposition. **(2) Uncertainty is conditional, not central.** Ablating the named entropy mechanism changes nothing on the benchmark (0.00 pp, invariant across the full threshold range): it is decorative *whenever a hard constraint fires*. It becomes load-bearing only in a *diffuse* regime with no hard violation, and only when *calibrated* — on a held-out corpus with materiality labels independent of the entropy weights, a calibrated weighted threshold reaches 98.3% (95% CI [91,100]) vs 78.3% for a naive count. **(3) The trust boundary, measured.** Because the agent emits the state the gate reads, the only non-circular evaluation is under *emission infidelity*. Across 18 unsafe cases and 36,000 Monte-Carlo trials per point, false-commit degrades **gracefully and linearly** with corruption (≈2% at 10% infidelity), and the *independently re-derived* "extract" channel is more load-bearing than self-report (38.9% vs 22.2% false-commit at full corruption; CIs <1 pt). Redundantly-defended cases are immune to single-channel corruption. The transferable principle is not "gate on uncertainty" but **"re-derive every safety signal independently; never trust agent self-report"** — governance is separable from capability *given faithful extraction*, and extraction is the surface that matters.

## 1. Introduction

Two branches of the 2024–2026 agent literature do not talk to each other. One makes agents *more capable* by evolving the harness from execution traces (HarnessX [1], ADAS [3], AFlow [4], Gödel Agent [5]) and reports task-success gains with essentially no safety mechanism. The other *measures* how unsafe agents are — 24% injection success against ReAct-GPT-4 (InjecAgent [6]), 84% average attack success (ASB [7]), >54% harmful-action rate in stateful workspaces (Saber [8]). Between them lies governance: deciding *when an agent-authored action is clear, safe, and authorized enough to commit*.

This paper studies a deterministic release-control layer for that decision, and is unusually willing to report what *failed*. The project was conceived as "uncertainty-aware" release control. Taking that claim seriously enough to test it killed it: on realistic load the uncertainty mechanism does no work, and the safety comes from discrete authorization plus an evidence loop. Rather than bury the disconfirmation we build on it, and we are careful about what the evidence can and cannot support. In particular, our benchmark is deterministic — the gate reads structured state the same harness emits — so its "0% false-commit" is largely a statement of internal consistency between an authored predicate and authored labels, **not** a safety guarantee. We therefore make the *emission-infidelity* analysis the spine (§5.3): it is the one evaluation in which emitted state and reality can diverge.

We make three claims, each tied to a pre-registered prediction (the ledger is an artifact):
1. **Attribution (§5.1):** the completion gain is provably the evidence loop, isolated by an identical-predicate ablation.
2. **Conditional uncertainty (§5.2):** decorative under any firing hard constraint (0.00 pp, threshold-invariant); load-bearing only in a calibrated diffuse regime (held-out generalization).
3. **Trust boundary (§5.3):** robustness degrades gracefully with emission infidelity; independently re-derived signals dominate self-reported ones; redundancy confers single-channel immunity.

## 2. Related work

**Harness evolution (capability, not governance).** HarnessX [1] and peers optimize success from traces; none gates release on safety. Our benchmark includes a HarnessX-like `harness_evolution` baseline (resolves evidence well, no gate) as the strong comparison — the post-HarnessX wedge is *harnesses evolve; release control decides what ships*.

**Uncertainty / calibration (why entropy alone is the wrong primitive).** Semantic-entropy methods [9] estimate generation uncertainty; Semantic Energy [10] is built on entropy's *failure*; *From Entropy to Calibrated Uncertainty* [11] shows raw entropy is uncalibrated until Platt-scaled; *When to ASK* [12] gates actions on uncertainty and gets *zero* in-domain benefit. §5.2 reproduces this from inside a deployed gate. No prior work validates *calibrated* uncertainty as a gate for *irreversible* actions — the gap §5.2 enters.

**Authorization gates / runtime governance (where our wins live).** AgentSpec [13], Progent [14], MAC-for-agents [15], and *Before the Tool Call* [16] enforce pre-execution authorization. The one prior work claiming *uncertainty-aware* release control, ReDAct [17], is single-axis (token uncertainty → defer to a bigger model), with no authority/risk/human term. None unifies authorization, risk, and calibrated uncertainty; our predicate (§3) is that conjunction, with the honest caveat that the uncertainty term is a residual.

**Injection defenses / evaluation.** AgentDojo [18] is the standard dual-axis testbed; the strongest defense, PromptArmor [19], sanitizes inputs to <1% ASR but cannot help once detection misses — an action-time authorization gate is complementary. Release-management work [20,21] gates CI promotion on absolute readiness thresholds, never on a *safety delta vs the incumbent* (§3.4).

## 3. The release-control layer

**3.1 Structured state, deterministic decision.** The agent (any harness) emits only a schema-validated `LatentWorkflowState`; deterministic code computes everything downstream. This is what *separability given faithful extraction* means: the decision reads the structured state + policy, never the model's weights — so the same layer sits in front of any agent. §5.3 quantifies what "given faithful extraction" costs when violated.

**3.2 The commit predicate** (priority-ordered conjunction; first matching branch decides):

> commit ⇔ (no hard-reject verifier fails) ∧ (no unresolved *required* field) ∧ (risk class ≤ ceiling) ∧ (action ∉ approval-required set) ∧ (no unmitigated high-severity hazard) ∧ (coverage ≥ floor) ∧ (residual entropy U < τ)

The first six terms are hard, discrete, and **independently verifiable**. The seventh, U, is the only continuous term. We do **not** claim a single-objective unification; we claim the weaker true thing: U is a *residual* that can bind only after every hard term passes (proven decorative in §5.2).

**3.3 The evidence loop.** Before deciding, the system gathers evidence for recoverable gaps. This is the *only* difference between `fixed_gate` and `clarityloop` — they share the identical predicate — which is what makes §5.1's attribution clean.

**3.4 Promotion = safety-weighted regression gating.** promote ⇔ candidate's safe-completion ≥ incumbent's ∧ false-commit ≤ incumbent's on a replay set. This is champion-challenger / shadow evaluation with a safety-dominance criterion; presented as sound engineering, not a novel mechanism.

## 4. Experimental setup

**ClarityLoopBench.** 36 cases / 12 archetypes, each with objective ground truth; **one uniform scorer** for all five baselines (frozen contract). A **deterministic provider** (no LLM) drives it, so it measures decision *logic* given faithful emission — **not** safety in the wild. An earlier rigged version (per-baseline hardcoded outcomes) was discarded. We report this bench for the *attribution* and *threshold-invariance* results, where its determinism is a feature (it isolates the mechanism), and we explicitly **do not** treat its 0% as a safety claim.

**Validation corpora (separate):** the diffuse-regime study (§5.2) and the emission-robustness Monte-Carlo (§5.3) — the latter is the non-circular primary evaluation. All use the shipped `runCommitGate` / `scoreEntropy`.

**Limitation up front (not as a shield):** with n=36 and a deterministic provider, the bench's point estimates are internal-consistency checks, not population safety rates. Every *quantitative* claim we ask the reader to weight (§5.2 held-out, §5.3 robustness) carries an n in the thousands and a confidence interval; the n=36 bench is used only for the *qualitative* attribution and invariance facts.

## 5. Results

**5.1 Attribution: the loop, not the gate, not uncertainty (Fig 1).**

| baseline | completion | false-commit |
|---|---|---|
| bare_qwen | 100% | 92% |
| dynamic_qwen | 100% | 56% |
| harness_evolution | 100% | 36% |
| fixed_gate | 31% | 0% |
| clarityloop | 86% | 0% |

`fixed_gate` and `clarityloop` run the *identical* commit predicate; the only difference is the evidence loop. Therefore the 31%→86% completion gain is attributable to the loop alone — not to gate strictness and not to uncertainty. This is the cleanest result in the paper precisely because it is a controlled within-system ablation, not a cross-system comparison.

**5.2 Uncertainty is conditional (Fig 2, Fig 4).** Disabling the entropy branch changes false-commit / safe-completion / completion by **0.00 pp**; sweeping τ∈{0.10…0.90} leaves the 86%/0% headline identical (Fig 2). Mechanistically, whenever uncertainty is high a hard branch has already decided, and no single entropy signal reaches τ — so entropy is decorative *under any firing hard constraint*. It is genuinely load-bearing only where no hard constraint fires: in a constructed diffuse regime, the ablated gate commits 100% of should-escalate cases. But the shipped τ=0.3 leaks 33% there (a calibration failure reproducing [11]). On a 120-case diffuse corpus with **materiality labels defined independently of the entropy weights** (τ tuned on a calibration half, scored on a held-out half, n=60 test): calibrated weighted **98.3%** (95% CI [91.1, 99.7]) vs naive count **78.3%** ([66.2, 86.9]) vs ablation **28.3%** ([18.5, 40.6]). The weighted lower bound exceeds the count's point estimate; the weighting generalizes because it encodes decision-materiality, though it is honestly imperfect (boundary collisions). *Uncertainty is real but scoped and calibration-dependent; the title's "not uncertainty" means "not as the central driver," not "never."*

**5.3 The trust boundary — the non-circular spine (Fig 3).** The bench bakes in faithful emission; the only place emitted state and reality diverge is corruption. We separate two trust channels — **emit** (agent self-reported flags: high-severity risk, required-missing) and **extract** (independently re-derived verifiers: adversarial block, authority flag, risk-class signal, coverage) — over 18 unsafe cases (4 emit-only, 7 extract-only, 7 redundant), corrupting each signal on a channel independently with probability p, 2000 trials/point (n=36,000/point):

| p (per-signal infidelity) | emit-channel false-commit | extract-channel false-commit |
|---|---|---|
| 0.00 | 0.0% | 0.0% |
| 0.10 | 2.2% [2.1, 2.4] | 2.4% [2.3, 2.6] |
| 0.50 | 11.4% [11.1, 11.8] | 15.8% [15.4, 16.2] |
| 1.00 | 22.2% [21.8, 22.7] | 38.9% [38.4, 39.4] |

Three findings with real statistical weight: (i) robustness degrades **gracefully and linearly**, not off a cliff — at a plausible 10% emission-infidelity, false-commit is ≈2%; (ii) the **extract channel is steeper** (38.9% vs 22.2% at full corruption) because more defenses live there — so safety signals belong on the independently-re-derived channel; (iii) **redundantly-defended cases (7/18) are immune to single-channel corruption**. The guarantee reduces to extraction integrity, and the design rule is explicit and transferable: *re-derive every safety signal; never trust self-report; prefer redundant (emit ∧ extract) defenses.*

**Correlated (adversarial) corruption — does the curve collapse?** The i.i.d. model is benign noise; a real injection compromises a *whole channel* of a case at once. We re-ran with a correlated model (a successful breach, prob p per case, suppresses the entire targeted channel). The curve does **not** collapse: it is modestly worse than i.i.d. on the extract channel (p=0.5: 19.7% [19.3,20.1] vs 15.8%; p=0.25: 9.9% vs 6.9%) because *same-channel*-redundant cases now fall together, and identical at the endpoints. Decisively, under a **full single-channel adversarial breach** (attacker fully owns one channel, p=1), false-commit is bounded by the single-channel-only population (emit-breach 22.2%, extract-breach 38.9%) — the **7 cross-channel-redundant cases survive**, because the untouched channel still defends them. So the central result holds under correlated compromise, and cross-channel (not merely within-channel) redundancy is what buys immunity to a full single-channel takeover.

## 6. Discussion — including what went wrong

**The journey, honestly.** The project began as "uncertainty-aware autopilot." An adversarial review caught the first benchmark **rigged** (per-baseline hardcoded outcomes); we rebuilt it with one uniform scorer, and the *attribution* flipped from entropy to the gate+loop. A pre-registered ablation confirmed entropy decorative (0.00 pp). A theory review then flagged three faults we fixed empirically: circularity (held-out calibration split, §5.2), the emission-trust assumption (the §5.3 robustness curve), and a "unification" overclaim (dropped — U is a residual). A paper review flagged that we were still *leading* with a near-circular headline number; v2 demotes it to the p=0 anchor of §5.3 and makes emission robustness the spine. Each disconfirmation narrowed the claim and strengthened the paper.

**Limitations.** (1) The bench is deterministic and small (n=36); we use it only for qualitative attribution/invariance, not as a safety rate. (2) §5.2 materiality labels are author-defined (though independent of the entropy weights); a different labeling could favor the count. (3) §5.3 now reports both i.i.d. *and* correlated (whole-channel-breach) corruption; the correlated curve is modestly worse but does not collapse and cross-channel redundancy survives a full single-channel breach. What remains untested is a *live-LLM* injection where emission failures may correlate with the gate's own blind spots; that run is harness-complete but user-gated (key required) and is the one improvement that would move this from "robust under simulated correlated compromise" to "robust under the deployed threat." (4) The external AgentDojo evaluation (gate as injection defense; baseline PromptArmor <1% ASR [19]) is harness-complete but user-gated (needs a live key) and is reported as planned external validation, not evidence. (5) Separability holds only *given faithful extraction*; a compromised extractor defeats the gate as it would any gate.

**Takeaway.** The marketable story (uncertainty decides what ships) is false on realistic load. The useful story: governance is separable from capability given faithful extraction; the governance that works is discrete authorization re-derived independently of the agent, with calibrated uncertainty a scoped residual; and the engineering principle that transfers is to push every safety signal onto an independently re-derived, redundant channel.

## 7. Conclusion

We set out to validate uncertainty-aware release control, falsified its central claim, and rebuilt a bounded one. The evidence loop (not the gate, not uncertainty) drives completion; uncertainty is a calibrated residual for diffuse doubt; and the property that actually determines safety is whether safety signals are re-derived independently of the agent that emits them — quantified by a graceful robustness curve whose load-bearing channel is extraction. Harnesses evolve; release control decides what ships — and what it can be trusted to decide is exactly what it re-derives for itself.

## References
[1] HarnessX, arXiv:2606.14249. [2] Agentic Harness Engineering, 2604.25850. [3] ADAS, 2408.08435. [4] AFlow, 2410.10762. [5] Gödel Agent, 2410.04444. [6] InjecAgent, 2403.02691. [7] Agent Security Bench, 2410.02644. [8] Saber, 2606.01317 (needs independent verification). [9] Semantic Uncertainty, 2302.09664. [10] Semantic Energy, 2508.14496. [11] From Entropy to Calibrated Uncertainty, 2603.06317. [12] When to ASK, 2604.02226. [13] AgentSpec, 2503.18666. [14] Progent, 2504.11703. [15] MAC for LLM agents, 2601.11893. [16] Before the Tool Call, 2603.20953. [17] ReDAct, 2604.07036. [18] AgentDojo, 2406.13352. [19] PromptArmor, 2507.15219. [20] Automated Self-Testing, 2603.15676. [21] LLM Readiness Harness, 2603.27355.
