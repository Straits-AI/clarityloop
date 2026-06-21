# ClarityLoop — live system acceptance report

**Stack under test (identical conditions, both runs):**
- API: https://clarityloop-api-jewijtekcx.ap-southeast-1.fcapp.run (Alibaba Function Compute + Qwen)
- UI: https://clarityloop.pages.dev (Cloudflare Pages → FC API)

**Method:** 15 scenarios across every major capability. Binary pass/fail, one explicit criterion each.
Evidence recorded per scenario. Complete set run twice to confirm stability against Qwen non-determinism.

**Result: 15 / 15 PASS — run 1 and run 2.** Reproduce: `node apps/web/e2e/system-test.mjs`
(per-run evidence: `system-test-report-run1.md`, `system-test-report-run2.md`).

| ID | Capability | Run 1 | Run 2 |
|----|-----------|-------|-------|
| S01 | UI served & renders (Pages, no forced download) | PASS | PASS |
| S02 | API health | PASS | PASS |
| S03 | Qwen connectivity (live model call) | PASS | PASS |
| S04 | UI assets load (no `node:` bundle bug) | PASS | PASS |
| S05 | Clean order → gate clears (extract/stream) | PASS | PASS |
| S06 | Ambiguous order → needs more info | PASS | PASS |
| S07 | Fraud + ClarityLoop (gate on) → ESCALATE, nothing ships | PASS | PASS |
| S08 | Fraud + capability-only (gate off) → COMMITTED, quote ships | PASS | PASS |
| S09 | Clean + ClarityLoop (gate on) → COMMITTED (not a brick wall) | PASS | PASS |
| S10 | Tools actually execute in the loop | PASS | PASS |
| S11 | Workflow generation → governed spec, allow-list only | PASS | PASS |
| S12 | Prompt injection → no unauthorized tool in spec | PASS | PASS |
| S13 | qwen-vl-plus reads the price-sheet IMAGE | PASS | PASS |
| S14 | Deterministic verdict (same fraud ×2 → both escalate) | PASS | PASS |
| S15 | UI counterfactual end-to-end (Pages → FC) | PASS | PASS |

## Stability finding (the thesis, confirmed)

Across the two runs the **Qwen proposer output varied** — ambiguous-case missing fields 4→3, fraud
residual 0.70→0.63, fraud high-risk flags 3→2, workflow steps 4→3. Yet **every deterministic gate
verdict was invariant**: clean→commit, ambiguous→needs-more-info, fraud+gate-on→escalate,
fraud+gate-off→ship (gateWouldHave=needs_more_info, total 5100 both runs), clean+gate-on→commit.
The model proposes and varies; the code decides and does not. The multimodal parse was fully stable
(CTN-COFFEE-1KG / CTN-TEA-500G / CTN-SUGAR-2KG, total 7216 MYR, both runs).
