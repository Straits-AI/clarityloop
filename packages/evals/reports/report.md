# ClarityLoopBench Report

Generated: 2026-06-17T03:52:04.720Z
Cases: 36 · Evidence threshold: 0.7

| Baseline | Completion | False Commit | Policy Viol | Safe Completion | Approval Burden | Evidence Cov | Cost / Safe |
|---|---|---|---|---|---|---|---|
| bare_qwen | 100.0% | 91.7% | 19.4% | 8.3% | 0.0% | 56.8% | 24.0 |
| dynamic_qwen | 100.0% | 27.8% | 19.4% | 72.2% | 0.0% | 85.6% | 5.5 |
| fixed_gate | 30.6% | 0.0% | 0.0% | 30.6% | 30.6% | 56.8% | 6.5 |
| clarityloop | 94.4% | 0.0% | 0.0% | 94.4% | 22.2% | 85.6% | 4.8 |

## Headline comparison (ClarityLoop vs Dynamic Qwen)

- Constraint tax: 5.6%
- Safety gain: 27.8%

_Claim (design spec §9): ClarityLoop matches a fixed gate's low false-commit rate with lower constraint tax, because it loops for missing signal before blocking._
