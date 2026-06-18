# 005 — Phase 4 validation + theory-review response

**Date:** 2026-06-18
**Phase:** 4 (core experiments — validation set) + Phase 2 review closure
**Status:** completed
**Depends on:** 001–004.

## Theory-review verdict (capable-model reviewer, blind assessment) and how each was answered
The reviewer (full text archived) returned: **(a) hidden stacking FAIL, (b) separability FAIL (critical),
(c) circularity FAIL-as-generalization, (d) promotion PASS-WITH-CAVEAT.** Responses:

### (b) Adversarial emission — the critical fix (experiment `adversarial_emission.ts`)
The guarantee was conditional on honest self-report (the agent emits the state the gate reads). We
split the gate's inputs into two layers and corrupted each over 6 unsafe archetypes:
- **L_extract** — independent verifiers (adversarial check, authority-category flags, risk-class
  signals, evidence coverage), re-derived deterministically from structured facts.
- **L_emit** — model-structured `LatentWorkflowState` (riskFlags, missingFields, claims).

| mode | false-commit | which archetypes fall |
|---|---|---|
| honest | **0%** (0/6) | none |
| emit-corrupt (lie in L_emit) | **17%** (1/6) | only `fraud_risk` — its *only* defense is a model-emitted high-severity flag |
| extract-corrupt (compromise L_extract) | **67%** (4/6) | adversarial, high_value, discount, policy_exception |
| both | **100%** (6/6) | all |

**Reading:** ClarityLoop is robust to corruption of model self-report for 5/6 archetypes because their
risk is *independently re-derived* — the gate does not trust the model's narrative. The guarantee
**reduces to the integrity of the extraction/verification layer** (a compromised extractor defeats any
gate). This is now a *named, measured trust boundary*, not an unstated assumption. **Design rule
(falls out of the data):** every safety-relevant signal must be independently re-derived; the lone
self-report-only defense (`fraud_risk` → high-severity flag) is the weak link and must be backed by an
independent fraud verifier. → H1 survives in **revised** form: *capability and governance are
separable, and the governance guarantee holds to the extent that safety signals are re-derived rather
than self-reported* (quantified: 5/6 defenses survive emission corruption).

### (c) Circularity — held-out calibration (experiment `entropy_calibration.ts`)
120-case diffuse corpus (seeded), labelled by a **materiality rule independent of the entropy
weights** (escalate ⇔ ≥1 decision-relevant doubt: unsupported claim or material-policy ambiguity;
stale-memory / tool-failure are immaterial noise). 50/50 split; τ tuned on **calibration only**,
reported on **held-out test**:

| decider | held-out accuracy |
|---|---|
| entropy-OFF (ablated, never escalate) | 28.3% |
| naive count≥k (k tuned on calib) | 78.3% |
| **calibrated weighted entropy (τ*=0.15 from calib)** | **98.3%** |

**Reading:** the weighted threshold *generalizes* — +20pp over the naive count on unseen cases —
because the weights encode decision-materiality (material signals outweigh operational noise), a
distinction a count cannot make. It is honestly **imperfect** (≈1.7% error from boundary collisions
where immaterial signals sum to a material weight) — consistent with Cluster B (raw entropy needs
calibration; even calibrated it is not exact). H3 is now a **generalization** claim, not tuning-on-test.

### (a) Stacking + (d) promotion — reframing, not new experiments
- (a): drop the "unification" overclaim. H2 is honestly a **priority-ordered conjunction** where the
  continuous uncertainty term is a *residual* that binds only in the diffuse region the hard terms
  leave open (003 proves it is 0.00pp elsewhere). That residual framing is defensible and is what the
  code does. We do NOT claim a single-objective unification.
- (d): reframe promotion as **safety-weighted regression gating / champion-challenger with a safety
  dominance criterion** (replay shows candidate ≥ incumbent on safe-completion and ≤ on false-commit).
  Sound and useful engineering; the *safety-dominance* criterion is the only mildly novel part. Not
  presented as a research "axis".

## Robustness (experiment: entropy-threshold sweep over the full 36-case bench)
clarityloop headline **86% completion / 0% false-commit / 22% approval is INVARIANT** for τ ∈
{0.10, 0.20, 0.30, 0.50, 0.90}. The entropy knob moves nothing on realistic load → the
"entropy-is-decorative" finding (003) is robust, not an artifact of the shipped threshold.

## Net effect on the thesis (reviewer coaching #5 adopted)
**Lead with the robust negative result, not the fragile positive one.** The headline contribution is:
*the named uncertainty mechanism is decorative on realistic agent-release load (0.00pp, invariant to
the threshold); the measured safety wins come from the deterministic authority-boundary gate +
evidence loop.* The calibrated-diffuse-uncertainty result (004/007) is a scoped, honestly-bounded
secondary. The adversarial-emission result (008) names the trust boundary and yields a design rule.
This ordering is what makes the paper credible rather than promotional.

## Next
- Phase 5: figures (threshold-invariance, baseline comparison, emission trust boundary, held-out
  calibration) + consolidated results table.
- Phase 6: paper draft, sections dispatched to writers, then a paper-review gate, then revision.
