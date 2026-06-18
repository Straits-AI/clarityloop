# 006 — Paper draft, adversarial review, and v2 revision (Phase 6)

**Date:** 2026-06-18
**Phase:** 6
**Status:** completed (v2)

## v1 → paper review (capable-model PC reviewer, blind)
Score: **weak-reject.** Correct, sharp objections:
1. **Honest-channel safety numbers are near-circular** — the deterministic gate reads the authored
   ground-truth state the scorer grades against; "0% false-commit" is internal consistency, not safety.
   The honest framing was being used as a *shield* (disclosed as limitation, still led the abstract).
2. **Title overclaims** — "Uncertainty Is Decorative" is contradicted by our own diffuse result
   (98.3% vs 28.3%). The truth is conditional: inert under a firing hard constraint, load-bearing
   otherwise.
3. **Statistical vacuity** — n=36, fractions-of-six quoted as rates (1/6→17%), no CIs.
Plus: "separable" overclaims (§5.3 shows it re-couples to extraction integrity); external numbers
(HarnessX, PromptArmor) are aspirational until AgentDojo is run.

## v2 response (branch-of-origin routing)
- **New non-circular spine (experiment `emission_robustness.ts`).** 18 unsafe cases × 2 trust channels
  (emit = self-report; extract = independently re-derived) × graded corruption p, 2000 trials/point
  (n=36,000/point), Wilson 95% CIs. Result: false-commit degrades **gracefully/linearly** (≈2% at
  p=0.10), extract channel steeper (38.9% vs 22.2% at p=1), redundant cases (7/18) immune to
  single-channel corruption. This is the evaluation where emitted-state ≠ reality, so it is the one
  that measures something real. Promoted to §5.3 and made the paper's spine.
- **Retitled** "Release Control for Agent Workflows: The Trust Boundary Is Extraction, Not Uncertainty."
- **Demoted** the 0% bench number to the p=0 anchor of the robustness curve; the n=36 bench is now used
  ONLY for the qualitative attribution (§5.1) and threshold-invariance (§5.2) facts, explicitly not as
  a safety rate.
- **Conditional uncertainty** claim throughout; held-out diffuse result now carries Wilson CIs
  (weighted [91.1,99.7] vs count [66.2,86.9], n=60).
- **"Separable" → "separable given faithful extraction"** everywhere.
- §5.3 limitation stated: i.i.d. corruption is an *optimistic* bound vs correlated adversarial injection.

## The reviewer's predicted path to weak-accept
"Reframe around the trust boundary, ground it in a non-circular evaluation, and this becomes a
weak-accept." v2 does exactly this: the trust boundary is the title and the spine; the non-circular
evaluation (n=36k, CIs) is §5.3. A confirmation re-review follows.

## Strongest, most transferable contribution (what to lead the talk with)
NOT "uncertainty is decorative." It is the pair:
1. **Provable attribution** — identical-predicate ablation isolates the evidence loop as the source of
   the completion gain (31%→86%), independent of gate strictness or uncertainty.
2. **The extraction trust boundary** — re-derive every safety signal; never trust self-report; prefer
   redundant defenses. A concrete engineering principle for agent release control, grounded in a
   curve, not an anecdote.
