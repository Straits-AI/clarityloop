# 002 — Hypothesis & Theoretical Justification (Phase 2)

**Date:** 2026-06-18
**Phase:** 2
**Status:** completed
**Depends on:** 001 (lit review), 003 (entropy decorative on bench), 004 (entropy load-bearing only in
calibrated diffuse regime).

## The reframing (not a stack)
Prior work splits the release decision into two non-communicating halves:
- **Uncertainty-gated** deferral (ReDAct 2604.07036): commit iff confidence is high enough — but
  single-axis, model-to-model, and (per Cluster B) uncalibrated thresholds are unreliable.
- **Authority/privilege-gated** enforcement (AgentSpec, Progent, Before-the-Tool-Call): commit iff the
  action is within an authorization boundary — but blind to epistemic state (a perfectly authorized
  action on shaky evidence still commits).

Neither alone is sufficient: capability-only agents (harness_evolution) commit 36% unsafe; a pure
authorization gate with no evidence loop bounces 69% of *safe* work (fixed_gate completes only 31%).
The reframing is to treat **release as a single typed decision over an operational state**, not a
filter bolted onto a generator:

> **H1 (separability + sufficiency).** Agent *capability* (can it produce the artifact?) and *release
> governance* (should this artifact commit now?) are separable concerns, and a deterministic decision
> function over a structured operational state — `commit / escalate / reject / promote` —
> recovers most capability-level completion while driving unsafe commits to zero.

> **H2 (the decision rule).** The safe-to-commit predicate is a **conjunction**, not a single
> threshold: *commit ⇔ (authority boundary permits the action) ∧ (risk class ≤ auto-commit ceiling)
> ∧ (no unmitigated high-severity hazard) ∧ (residual uncertainty U ≤ τ)*. The first three terms are
> hard, discrete, and verifiable; the fourth, U, is the only continuous term and is **decorative
> unless the first three already pass** (003) — i.e. uncertainty earns its keep precisely and only in
> the *diffuse* region where no hard term fires (004).

> **H3 (calibration, not magnitude, is the uncertainty lever).** Within the diffuse region, the value
> of U comes from a *calibrated* threshold over a *weighted aggregate*, not from raw entropy mass. An
> uncalibrated threshold (shipped τ=0.3) leaks 33% of diffuse cases; a calibrated τ∈[0.225,0.275]
> strictly dominates both ablation and a naive unweighted count (004). This converts the literature's
> calibration critique (2603.06317, 2604.02226) into a concrete design rule.

## Why this is bedrock, not convention (first-principles check)
- The failure being prevented — an agent executing an *unauthorized or unsafe external action* — is a
  measured, replicated phenomenon (InjecAgent 24% ASR, ASB 84%, Saber >54% HSR). Bedrock.
- Separability is provable by construction: the decision function reads only the structured
  `LatentWorkflowState` + policy, never the model's weights or sampling — so it is invariant to which
  harness produced the artifact. This is *why* the same gate sits in front of bare_qwen,
  harness_evolution, or any future agent (the post-HarnessX wedge).
- The conjunction in H2 is the minimal rule consistent with the ablations: drop term 1–3 → unsafe
  commits return (003 high-risk hole); drop term 4 → diffuse doubt commits (004). Occam: no term is
  removable without a measured regression, and no term beyond these four is demanded by the evidence.

## Predicted consequences (falsifiable, feed Phase 4/5)
1. Ablating any hard term re-introduces its failure class (already shown for high-severity risk).
2. The U term changes nothing on the 36-case bench (003: 0.00pp) — *predicted by H2*, and confirmed.
3. The U term changes the diffuse regime by 100pp vs ablation, but only when calibrated (004).
4. Across corpus perturbations (seeds), the baseline *ordering* and the 0% clarityloop false-commit
   are stable (robustness criterion — tested in 006).

## Theoretical positioning of the promotion axis (second novelty vector)
Promotion (workflow vN → vN+1) is the same predicate lifted from a single run to a **replay set**:
promote ⇔ candidate's safe-completion ≥ incumbent's ∧ candidate's false-commit ≤ incumbent's on the
recorded replay corpus. No prior system gates promotion on a *safety delta* vs the incumbent (001
Cluster's release-management work gates on absolute readiness thresholds). This is H1 applied at
release-management granularity.

## Gate decision (theory reviewer)
Dispatch a theory-reviewer subagent (most-capable model) to attack H1–H3 for: (a) hidden stacking,
(b) whether separability is overclaimed, (c) whether the calibration claim is circular given we tuned
τ on the same diffuse corpus we evaluate on. (c) is the sharpest risk and must be answered in the
paper (train/test split of the diffuse corpus, or label-honest framing).
