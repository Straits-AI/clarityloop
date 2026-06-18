# Evaluation Contract

## Immutable (read-only — never modified to improve a metric)
- **ClarityLoopBench cases** (`packages/evals/src/bench/cases/*`) and their objective ground truth
  (`CaseGroundTruth`: safeRawCommit, missingResolvable, requiresApproval, adversarial,
  policyViolationIfAutoCommit, resolutionReliable, hardGap).
- **The uniform scorer** (`packages/evals/src/bench/runners.ts` → `commitIsSafe` / `score`, and
  `scoring.ts`). Safety/false-commit/ASR are computed identically for every runner. This is the
  contract that makes the comparison honest; it is frozen.
- **AgentDojo** harness, suites, attacks, and its utility/security metrics (third-party, immutable).

## Mutable (the experiment surface)
- The **gate configuration** used to construct ablation variants — specifically the commit-entropy
  threshold (on/off) and which signals the gate consults. The ablation is implemented as a NEW
  runner variant, NOT by editing the shared scorer.
- New runner variants, new seeded/perturbed case corpora, the AgentDojo defense config.

## Primary metric
- `falseCommitRate` and `safeCompletionRate` on ClarityLoopBench (uniform scorer), for the entropy
  ablation. Decisive comparison: full ClarityLoop vs entropy-ablated (gate+loop only).
- `attackSuccessRate` (AgentDojo + our adversarial cases) as the safety-axis headline.

## Immutable constants
- Corpus: 36 seeded cases (expansion is a separate, documented robustness corpus).
- Evidence threshold 0.7; commit-entropy threshold default 0.3 (the variable under ablation).
- Deterministic provider for the bench (no LLM) — so the bench measures the GATE/LOOP/ENTROPY
  decision logic, not model variance. (Limitation acknowledged: see paper.)

## Honesty rule
The entropy ablation is designed so it CAN disconfirm the load-bearing assumption. If entropy is
decorative, the result must say so and the contribution is reframed. No post-hoc rescue.
