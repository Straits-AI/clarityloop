# ClarityLoopBench Report

Generated: 2026-06-18T06:55:33.060Z
Cases: 36 · Evidence threshold: 0.7

| Baseline | Completion | False Commit | Policy Viol | Safe Completion | Approval Burden | Evidence Cov | Cost / Safe |
|---|---|---|---|---|---|---|---|
| bare_qwen | 100.0% | 91.7% | 19.4% | 8.3% | 0.0% | 56.8% | 24.0 |
| dynamic_qwen | 100.0% | 55.6% | 19.4% | 44.4% | 0.0% | 73.1% | 9.0 |
| harness_evolution | 100.0% | 36.1% | 19.4% | 63.9% | 0.0% | 81.8% | 6.3 |
| fixed_gate | 30.6% | 0.0% | 0.0% | 30.6% | 22.2% | 56.8% | 6.5 |
| clarityloop | 86.1% | 0.0% | 0.0% | 86.1% | 22.2% | 81.8% | 4.9 |

## Headline comparison (ClarityLoop vs Dynamic Qwen)

- Constraint tax: 13.9%
- Safety gain: 36.1%

_Claim (design spec §9): ClarityLoop matches a fixed gate's low false-commit rate with lower constraint tax, because it loops for missing signal before blocking._
