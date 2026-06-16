# Plan 4 — Tools + Next-Best-Action Controller (as built)

## Scoring (deterministic, `@clarityloop/core`)
- `scoreAction(a) = ER + RR − tokenCost − latencyCost − humanBurdenCost − toolCost`.
- `selectNextBestAction(candidates)` = argmax; returns `null` if no candidate scores > 0.
- `estimateActionCosts(proposed, state)` derives ER/RR from the §7 entropy weights
  (required missing field or unsupported claim ≈ 0.25; retrieve_memory +0.10 when
  stale memory is present) plus a static per-action cost table. `toCandidateAction`
  attaches costs + computes the score. The model never supplies a number.

## Tools (`@clarityloop/tools`)
Uniform `Tool { name, description, permission, inputs, run }` returning
`ToolResult { ok, data, evidence: EvidenceRef[], error, costHint }`.
| tool | permission | backing |
|---|---|---|
| retrieve_memory | read_only | `MemoryRepository` (seeded `OperationalMemory`) |
| lookup_catalog | read_only | seeded catalog fixture |
| check_stock | read_only | seeded stock fixture |
| parse_supplier_quote | read_only | Qwen-VL via `generateStructured` (fake in tests) |
| compare_quote | draft | deterministic supplier-vs-catalog reconciliation |
| draft_quote | draft | writes a draft artifact via `ArtifactStore` |

## Loop controller (`apps/api/src/loop/controller.ts`)
`runToolLoopStream(initialState, deps)` is an async generator yielding `EntropyUpdate`
frames and returning a `LoopResult { finalState, finalEntropy, steps, stopReason }`.
Stop reasons: `commit_entropy_below_threshold | no_useful_action | budget_exhausted |
approval_required`. `applyToolResult` is the deterministic state reducer; the SSE
route streams the generator unchanged from Plan 3's `EntropyUpdate` contract.

## Deferred to later plans
- Real commit/approval classification → Plan 5 (`runCommitGate` replaces the
  `approvalRequired` predicate).
- Memory **write** path + value scoring → Plan 6 (read path lands here).
- Live Qwen-VL smoke test → human-gated, Plan 7 deploy.
