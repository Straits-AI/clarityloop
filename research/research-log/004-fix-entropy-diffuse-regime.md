# 004 — "Fix Entropy": the diffuse-uncertainty regime

**Date:** 2026-06-18
**Phase:** 4 (core experiment) — the user-chosen "report the negative result, then try to fix entropy" path.
**Status:** completed
**Depends on:** 003 (entropy is decorative on the 36-case bench, 0.00pp).

## Question
003 disconfirmed the load-bearing assumption: on the shipped corpus, the commit-entropy branch never
decides — a hard branch (reject / needs_more_info / risk / authority) always fires first. The honest
follow-up: **is there a realistic regime where an aggregate soft-uncertainty signal is the *only*
mechanism that can act, and does entropy add value there?** The candidate (named in 003): *diffuse
soft uncertainty* — a commit that passes every individual hard check but is collectively shaky.

## Design (experiments/entropy_regime.ts — uses the REAL `runCommitGate` + `scoreEntropy`)
Construct three small corpora of latent states with **no hard-branch trigger** (no missing-required
field, no blocking verifier, risk ≤ L1, no high-severity risk flag, coverage above the approval
floor — so the commit-entropy branch is the only branch that can fire):
- **D** (diffuse doubt, ground-truth = *escalate*): ≥2 soft signals incl. a higher-weight one, Σ≈0.275–0.425.
- **B** (benign, ground-truth = *commit*): 0–1 soft signal, Σ<0.3.
- **W** (minor pile-up, ground-truth = *commit*): 2–3 **low-weight** signals (stale memory + tool
  failure), Σ≤0.20 but raw soft-signal **count ≥ 2**.

Three deciders read the identical states: **entropy-ON** (real gate, threshold 0.3), **entropy-OFF**
(threshold 1.0 — the ablation, entropy can never fire), **count≥2** (naive unweighted aggregate — the
Occam baseline). Metrics: false-commit on D, over-escalation on B+W. Plus a threshold sweep.

## Prediction (ledger `entropy-regime-v1`, recorded before running)
entropy-ON false-commit ≈ 0; entropy-OFF ≈ 100; entropy ≈ count (the weighting adds little). Two of
three turned out **wrong** — the valuable kind.

## Result
| decider | false-commit (D) | over-escalation (B+W) |
|---|---|---|
| entropy-ON (thr 0.3, as shipped) | **33.3%** | 0% |
| entropy-OFF (ablated) | **100%** | 0% |
| count ≥ 2 | 0% | **33.3%** |

Threshold calibration sweep (false-commit / over-escalation):
| threshold | 0.10 | 0.15 | 0.20 | **0.225** | **0.25** | **0.275** | 0.30 |
|---|---|---|---|---|---|---|---|
| false-commit (D) | 0 | 0 | 0 | **0** | **0** | **0** | 33.3 |
| over-escalation (B+W) | 83.3 | 50.0 | 16.7 | **0** | **0** | **0** | 0 |

## Prediction vs. Reality — two surprises
1. **entropy-OFF = 100% (confirm).** With entropy ablated, the gate commits *every* diffuse case — no
   hard branch catches diffuse soft uncertainty. So unlike the 36-case corpus, **entropy is
   load-bearing in this regime**: it is the only thing standing between diffuse doubt and an auto-commit.
2. **entropy-ON leaks 33% at the shipped threshold (disconfirm — surprise).** D1 (Σ=0.275) and D6
   (Σ=0.287) fall just below 0.3 and wrongly commit. This is a **calibration failure**, and it
   reproduces the literature's central critique *from our own gate*: raw entropy is uncalibrated
   (2603.06317 *From Entropy to Calibrated Uncertainty*); a naive threshold yields no reliable
   in-domain benefit (2604.02226 *When to ASK*).
3. **entropy ≠ count (disconfirm — surprise).** They are not equivalent and neither dominates at 0.3
   (entropy 33/0, count 0/33 — different operating points). But **calibrated to 0.225–0.275, entropy
   strictly dominates count≥2 (0% / 0%)**: the *weighting* separates diffuse real-doubt (D, all
   ≥0.275) from minor pile-up (W, all ≤0.20) — a separation an unweighted count structurally cannot
   make. So the aggregation's *structure*, not merely "some aggregation," carries the value here.

## Scientific reading (honest, scoped)
- **Entropy is rehabilitated, but only in a regime the shipped corpus never exercises.** Where
  uncertainty is *diffuse* (no single hard violation), the aggregate signal is the sole available
  control and a *calibrated, weighted* one beats both ablation (−100pp false-commit) and a naive count
  (dominates on the safety/burden trade-off).
- **The shipped 0.3 threshold is mis-calibrated** — it leaks a third of diffuse cases. The fix is not
  more mechanism; it is **calibration** (Platt-scaling / a validation-tuned threshold), exactly the
  literature's prescription. The honest contribution is therefore "the gate + loop handle hard
  violations; a *calibrated* aggregate-uncertainty escalation handles diffuse doubt", with calibration
  flagged as the open reliability problem (no paper yet validates calibrated uncertainty as a gate for
  *irreversible* agent actions — that gap is ClarityLoop's white space, per 005 lit review).
- **Occam caveat stated plainly:** if a reviewer rejects the "minor signals are negligible" labeling of
  W (i.e. argues any 2 signals warrant a look), the naive count suffices and entropy's weighting is
  unjustified complexity. The result is reported under both readings; the weighting's value is
  label-contingent, the calibration finding is not.

## Decision
- Keep entropy in the gate, **but** (a) re-label the headline contribution as *authority-boundary gate
  + evidence loop* (the measured wins, 003) with *calibrated diffuse-uncertainty escalation* as a
  scoped secondary; (b) record the shipped-threshold mis-calibration as a known limitation; (c) the
  paper's mechanism section must NOT claim entropy drives the headline bench — 003/004 forbid it.
- Do **not** retrofit diffuse cases into the immutable 36-case bench (that would be the rigging 003's
  honesty rule prohibits). The diffuse corpus lives in `research/experiments/` as a separate,
  clearly-scoped regime study.

## Next steps
- 005: literature review synthesis (positions vs ReDAct 2604.07036 — the one prior "uncertainty-aware
  release control" — and the calibration cluster).
- Phase 2 hypothesis: "enough certainty + enough authority ⇒ safe to commit" as the separable
  decision layer, with calibration as the named reliability mechanism for the uncertainty term.
