# 003 — PoC: Entropy Ablation (the decisive probe)

**Date:** 2026-06-18
**Phase:** 3 (PoC) — run ahead of full literature, because its result reshapes the hypothesis.
**Status:** completed

## Context
The load-bearing assumption (000-setup) is that ClarityLoop's **entropy** mechanism drives the gate.
The session's adversarial review argued it does not (threshold 0.3 > every single-signal entropy max
0.25; the gate's hard branches fire first). This PoC tests it directly by ablation.

## Design
Run ClarityLoopBench (36 cases, deterministic provider — no LLM) twice: full (`CL_ENTROPY_THRESHOLD=0.3`)
vs **entropy-ablated** (`=1.0`, which makes the gate's `commitEntropy >= threshold` branch never
fire). Everything else identical. Compare ClarityLoop's false-commit / safe-completion / completion.
The threshold is the only knob (evaluation contract: gate config is the mutable surface; scorer frozen).

## Prediction (recorded BEFORE running, ledger `entropy-ablation-v0`)
0 pp change on all metrics; confidence high. Rationale: in this corpus every uncertain case also
trips a HARD branch (missing-required → needs_more_info; adversarial → reject; risk/authority →
needs_approval) that resolves the decision before the entropy branch is ever consulted; and no
single entropy signal reaches 0.3, so entropy could only bind on *accumulated* uncertainty, which
no current case isolates.

## Result
| metric | full (0.3) | ablated (1.0) | Δ |
|---|---|---|---|
| false-commit | 0% | 0% | **0.00 pp** |
| safe-completion | 86.11% | 86.11% | **0.00 pp** |
| completion | 86.11% | 86.11% | **0.00 pp** |

## Prediction vs. Reality
Predicted 0 pp, observed 0 pp → **signal: confirm**. The prediction *could* have been disconfirmed
(if any case had been decided by entropy), so this is a credible confirmation, not a tautology.

**Scientific reading: the load-bearing assumption is DISCONFIRMED.** The "entropy-aware /
uncertainty-guided" mechanism — the thing the thesis names — does **zero** work on this evaluation.
ClarityLoop's measured wins come entirely from (a) the deterministic **authority-boundary commit
gate** (hard branches) and (b) the **evidence loop** (resolving gaps the fixed gate bounces). This is
a clean negative result about the named mechanism.

## Diagnosis (why entropy is inert here)
1. **Branch ordering:** hard branches (reject / needs_more_info / risk-class approval) precede the
   entropy check; whenever entropy is high, a hard branch has already decided.
2. **Threshold vs single-signal mass:** max single-signal entropy = 0.25 (missing 0.25, unsupported
   0.25, risk 0.20, policy 0.15, stale 0.10, tool 0.05) < threshold 0.3. Entropy can only bind on
   ≥2 co-occurring soft signals — a regime the 36-case corpus never isolates.
3. So entropy is **structurally unreachable as the deciding signal** on this corpus.

## Decision → Phase "fix entropy" (user-chosen path)
The honest target is NOT to retrofit entropy into cases it shouldn't decide. It is to ask: **is there
a realistic regime where entropy is the *right* mechanism — accumulated SOFT uncertainty with no
single hard violation (a commit that passes every individual checklist item but is collectively too
shaky)?** If yes, add realistic cases for that regime and show (by re-ablation) that entropy reduces
false commits *there*. If such cases are contrivable-only, the honest conclusion stands: the gate +
loop suffice, and the "entropy-aware" framing must be demoted. Either outcome is a real result.

## Next steps
- Phase 1 deep literature review (running in parallel) to position the contribution honestly.
- "Fix entropy": design a soft-aggregate-uncertainty regime + cases; re-ablate; report regime-scoped
  value (or confirm entropy is unnecessary).
