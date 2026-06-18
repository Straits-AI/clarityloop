# Research Findings — Honest Evaluation of ClarityLoop

This document records the **scientific evaluation** of ClarityLoop's mechanisms, conducted with the
`sciagent` methodology (predict-then-run, pre-registered prediction ledger, adversarial review gates).
Full paper: [`research/paper/paper.md`](../research/paper/paper.md). Prediction ledger:
[`research/results.tsv`](../research/results.tsv). Reproducible experiments: `research/experiments/`.

> **One-line summary:** ClarityLoop's *measured* safety comes from the **deterministic
> authority-boundary commit gate + evidence loop**, not from the entropy/uncertainty mechanism the
> project is named for. The uncertainty term is decorative on realistic load and only earns its keep,
> calibrated, in a narrow diffuse-doubt regime.

## What the experiments show

| # | Experiment | Result | File |
|---|---|---|---|
| 1 | **Entropy ablation** (36-case bench) | Disabling the commit-entropy branch changes false-commit / safe-completion / completion by **0.00 pp**. Headline 86%/0%/22% is **invariant** across τ∈{0.1…0.9}. | `packages/evals` + `research-log/003` |
| 2 | **Baseline comparison** (uniform scorer) | bare 100%/92%, dynamic 100%/56%, harness_evolution 100%/36%, fixed_gate 31%/0%, **clarityloop 86%/0%**. The 36→0 false-commit gain is the *gate*; the 31→86 completion gain is the *evidence loop*. | `research/paper/figures/fig1` |
| 3 | **Diffuse regime, held-out calibration** | Where no hard violation exists, ablated gate commits 100% of should-escalate cases; shipped τ=0.3 leaks 33%; **held-out** calibrated weighted entropy **98.3%** vs naive count 78.3% vs ablation 28.3%. Uncertainty is real but scoped + calibration-dependent. | `research/experiments/entropy_{regime,calibration}.ts` |
| 4 | **Emission robustness (trust boundary — the non-circular spine)** | 18 unsafe cases × graded corruption, 36k trials/point, Wilson CIs. False-commit degrades **gracefully/linearly** (≈2% at 10% emission infidelity); the independently-re-derived **extract** channel is more load-bearing than self-report (**38.9% vs 22.2%** at full corruption); redundantly-defended cases (7/18) are immune to single-channel corruption. Guarantee reduces to **extraction integrity**. | `research/experiments/emission_robustness.ts` |

## Design rules that fall out of the findings

1. **Re-derive safety signals; never trust agent self-report.** Every defense backed by an independent
   verifier survived emission corruption; the one self-report-only defense (high-severity risk flag)
   was the single failure under `emit-corrupt`. Back it with an independent fraud/risk verifier.
2. **The entropy term is a residual, not the driver.** It can only bind once every hard branch passes.
   Keep it (it handles diffuse doubt) but **calibrate the threshold** (the shipped 0.3 is mis-calibrated
   and leaks); do not market it as the safety mechanism.
3. **Capability and governance are separable.** The gate reads only the structured state + policy, so
   it sits unchanged in front of any agent harness — the post-HarnessX wedge: *harnesses evolve;
   release control decides what ships.*

## Honesty notes
- An earlier version of ClarityLoopBench was **rigged** (per-baseline hardcoded outcomes, strawman
  fixed gate). It was discarded and rebuilt with one uniform scorer shared by all baselines (frozen
  evaluation contract, `research/experiments/configs/evaluation-contract.md`).
- The benchmark is **deterministic** (no LLM): it measures the decision logic given faithful structured
  emission. Experiment #4 bounds what happens when emission is *not* faithful. A live-LLM study and the
  external AgentDojo run (gate as injection defense; baseline to beat: PromptArmor <1% ASR) are
  user-gated future work.

## Open positioning question (for the maintainer)
The public README headline ("Uncertainty-aware release control … commit only when uncertainty is low")
emphasizes the mechanism these findings show is decorative. Consider reframing the headline to
**"Authority-boundary release control for agent workflows"** with calibrated uncertainty as a scoped
secondary — matching the honest result. This is a positioning decision left to the maintainer.
