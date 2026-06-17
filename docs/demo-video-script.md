# ClarityLoop — 3-Minute Demo Video Script

**0:00–0:20 — Problem.** "Dynamic agents can complete business tasks, but they finalize unsafe work
when the input is ambiguous." Show the messy request: _"Same as last time, need 120 cartons urgently
next week. Supplier quote attached."_

**0:20–0:45 — Baseline failure.** Show the Dynamic Qwen workflow drafting a quote too confidently:
stale price, missing delivery evidence, unsupported assumption, unsafe external send.

**0:45–1:30 — ClarityLoop run.** Show the Qwen-generated WorkflowSpec, the latent state, and the
entropy heatmap dropping live via SSE: commit entropy **0.82 → 0.46 → 0.18**. Narrate the next-best
actions: retrieve memory, lookup catalog, check stock, compare supplier quote — each resolving an
uncertainty hotspot.

**1:30–2:00 — Commit gate.** Show evidence coverage, the policy result, and the commit decision:
draft internally; approval required before external send (risk-tiered, authority boundary).

**2:00–2:30 — Self-improvement.** Show Qwen proposing a workflow patch: _insert retrieve_memory
before draft_quote when the request says "same as last time."_

**2:30–2:50 — Replay promotion.** Show ClarityLoopBench replaying old vs new procedure: false commits
down, approval burden controlled, safe completion up; the promotion gate promotes v2.

**2:50–3:00 — Closing.** "ClarityLoop lets Qwen agents explore freely, loop for missing signal, and
commit only when uncertainty is low enough for the business risk."
