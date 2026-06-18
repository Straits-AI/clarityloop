# ClarityLoop Memo

## Uncertainty-Guided Autopilot for Governed Business Workflows

### Qwen Cloud Global AI Hackathon Strategy Memo

### Updated: 16 June 2026

---

## 1. Executive Summary

ClarityLoop is an uncertainty-guided autopilot layer for business workflows. It lets Qwen agents generate, execute, improve, and reuse business workflows, but it does not blindly trust those workflows. Instead, it maintains a compact latent workflow state, estimates operational uncertainty, gathers the next best evidence, and only commits or promotes workflows when uncertainty, risk, and evidence thresholds are satisfied.

The core product thesis is:

> Let agents explore freely. Loop only when uncertainty matters. Commit only when the business risk is justified.

The updated USP is not “dynamic workflows.” Claude Code already has dynamic workflows. The USP is:

> ClarityLoop turns dynamic agent behavior into governed, versioned, auditable business procedures using uncertainty-guided loops, risk-tiered commit gates, and replay-based workflow promotion.

For the Qwen hackathon, the strongest target is **Track 4: Autopilot Agent**. The demo should not be an abstract governance platform. It should be a concrete, visual demonstration where a normal dynamic Qwen workflow finalizes unsafe business work, while ClarityLoop detects uncertainty, gathers missing evidence, avoids unnecessary human interruption, and safely commits or escalates.

The winning demo should show:

1. A messy business request.
2. Qwen generating a workflow dynamically.
3. The latent state showing uncertainty hotspots.
4. The system choosing the next best action to reduce uncertainty.
5. Commit gating at the authority boundary.
6. Qwen proposing a workflow improvement.
7. Replay benchmark comparing old vs new workflow.
8. Safe promotion into a reusable business procedure.

The product category is best described as:

> Risk-adjusted autonomy for agentic business workflows.

---

## 2. Why the Name Changed from ProofPilot to ClarityLoop

The old name, ProofPilot, over-emphasized proof, verification, and evidence. That made sense when the concept was mostly about evidence-grounded commits. The current concept is broader:

* uncertainty-aware autonomy;
* adaptive looping;
* dynamic workflow generation;
* bounded memory;
* risk-tiered approval;
* workflow promotion;
* replay-based non-regression;
* governed business procedures.

The name ClarityLoop fits better because the system loops until the operational situation is clear enough to act.

External product name:

> ClarityLoop

Tagline:

> Uncertainty-guided autopilot for business workflows.

Technical mechanism:

> Entropy-Aware Latent Loop

Category:

> Risk-adjusted autonomy layer for agentic workflows.

---

## 3. The Core Problem

The market is moving from chatbots to agents. The leading agent systems are no longer fixed workflows. They can read files, use tools, spawn subagents, write scripts, create reusable skills, and execute long-horizon tasks. This is powerful, but it creates a new enterprise problem.

The problem is not merely:

> Can the agent do the task?

The harder business question is:

> When the agent invents a way of doing the task, can the organization safely reuse that behavior tomorrow?

Dynamic agents are good at improvisation. Businesses need repeatable procedures. The missing layer is the conversion from improvised agent behavior to governed operational procedure.

A business procedure needs more than an answer. It needs:

* versioning;
* authority boundaries;
* audit trail;
* tool permissions;
* risk classification;
* evidence obligations;
* rollback;
* approval records;
* workflow memory;
* measurable non-regression;
* cost and latency tracking.

This is where ClarityLoop sits.

---

## 4. What Is a Governed, Versioned, Auditable Business Procedure?

A governed, versioned, auditable business procedure is a reusable operational workflow that an organization can trust, inspect, approve, compare, roll back, and defend after the fact.

A normal dynamic agent says:

> I solved this task.

A governed business procedure says:

> This is the approved way this organization allows an agent to solve this class of task.

A procedure version should contain:

```ts
type BusinessProcedureVersion = {
  id: string
  parentVersion?: string
  name: string
  goal: string

  workflowSpec: WorkflowSpec
  allowedTools: ToolPermission[]
  authorityBoundary: AuthorityBoundary

  evidencePolicy: EvidencePolicy
  riskClass: RiskClass
  commitPolicy: CommitPolicy
  memoryPolicy: MemoryPolicy

  evalResults: EvaluationResult[]
  approvalRecord?: ApprovalRecord
  rollbackPointer?: string

  runTraces: TraceReference[]
  createdAt: string
  promotedAt?: string
}
```

A procedure is **governed** when it defines what the agent can do, what it cannot do, what requires approval, and what evidence is required.

A procedure is **versioned** when every behavior change is immutable, comparable, replayable, and reversible.

A procedure is **auditable** when every run can answer:

* what input did the agent receive?
* what workflow version ran?
* what tools were called?
* what evidence supported each committed claim?
* what risks were detected?
* what uncertainty remained?
* what was committed, rejected, escalated, or deferred?
* who approved it?
* what changed between procedure versions?
* can the run be replayed?

---

## 5. Why This Is Needed Now

There are three converging pressures.

First, agent systems are becoming more capable and more autonomous. Modern systems like Claude Code dynamic workflows show that agents can now write orchestration scripts, spawn many subagents, execute background tasks, and save workflows for reuse. That means the frontier is no longer only model capability. The frontier is operational control over agent-authored behavior.

Second, agent security risk is no longer theoretical. Prompt injection, excessive agency, tool misuse, memory poisoning, and unsafe skill execution become more serious when agents can act through tools, files, browsers, APIs, email, CRMs, or enterprise systems.

Third, AI governance is moving toward lifecycle management. Standards and regulatory frameworks increasingly emphasize risk management, traceability, transparency, documentation, monitoring, human oversight, and continuous improvement. This does not mean ClarityLoop should become a compliance product immediately, but it means the direction is commercially relevant.

The opportunity is:

> Agents are becoming useful enough to deploy, but not safe or stable enough to reuse blindly.

ClarityLoop addresses this gap by converting dynamic agent runs into governed procedure versions.

---

## 6. What Makes ClarityLoop Different?

The strongest USP is:

> ClarityLoop is not another agent runtime. It is a risk-adjusted autonomy layer that decides when a dynamic agent workflow is clear enough to commit and reliable enough to promote.

A sharper version:

> Agents may explore. Evidence and risk decide what gets committed. Replay decides what gets promoted.

Comparison against existing categories:

| Existing category              | What it does                                                                         | ClarityLoop difference                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Claude Code dynamic workflows  | Lets agents write and run workflow scripts with subagents                            | ClarityLoop focuses on business procedure promotion, commit risk, uncertainty reduction, and auditability                    |
| Hermes / OpenClaw-style agents | Always-on execution environments with tools, memory, skills, and local/system access | ClarityLoop is not trying to be the broadest runtime; it controls when workflow behavior becomes reusable business procedure |
| LangGraph / AutoGen / CrewAI   | Developer-authored orchestration graphs and multi-agent workflows                    | ClarityLoop supports agent-authored workflows, but validates and promotes them through governance and replay                 |
| Guardrails                     | Checks outputs or blocks unsafe responses                                            | ClarityLoop controls workflow versions, authority boundaries, commit decisions, and promotion decisions                      |
| AgentOps / observability       | Logs and monitors agent runs                                                         | ClarityLoop uses traces to decide next actions, commit readiness, and workflow promotion                                     |
| RPA / workflow automation      | Fixed deterministic business processes                                               | ClarityLoop handles ambiguous semi-structured workflows and evolves procedure versions                                       |
| CPV prototype                  | Verification-gated runtime for structured tasks                                      | ClarityLoop generalizes CPV into uncertainty-guided dynamic workflow control                                                 |

The key distinction from Claude Code dynamic workflows is this:

> Claude moves the plan into code. ClarityLoop moves the plan into a governed business procedure lifecycle.

---

## 7. Important Strategic Correction: Safety Can Make Agents Dumb

A naive safety system will reduce model usefulness. It will over-refuse, over-escalate, over-constrain, and slow everything down.

Therefore ClarityLoop must not be designed as “more constraints everywhere.”

The principle is:

> Soft autonomy inside the sandbox. Hard governance at the authority boundary.

The system should not constrain thinking. It should not over-constrain drafting. It should constrain irreversible commitment, external-facing actions, financial/legal actions, memory writes, tool permission changes, and workflow promotion.

Four autonomy zones:

| Zone                                 | Constraint level | Reason                    |
| ------------------------------------ | ---------------: | ------------------------- |
| Planning / exploration               |              Low | Preserve model capability |
| Read-only tool use                   |    Low to medium | Gather context cheaply    |
| Drafting / simulation                |           Medium | Errors are reversible     |
| External commit / workflow promotion |             High | Real-world risk           |

This is the core design response to the “safe = dumb” problem.

---

## 8. Entropy-Aware Latent Loop

The internal mechanism is the Entropy-Aware Latent Loop.

This is not a true neural latent state because we do not access Qwen’s hidden activations. It is a structured latent workspace maintained by Qwen plus deterministic scoring.

The system maintains a compact representation of:

* what is known;
* what is missing;
* what is uncertain;
* which claims are unsupported;
* which memories conflict;
* which policies are ambiguous;
* what evidence is required;
* what actions could reduce uncertainty;
* whether the system is ready to commit.

Core object:

```ts
type LatentWorkflowState = {
  goal: string
  workflowVersion: string

  knownFacts: Fact[]
  missingFields: MissingField[]
  competingHypotheses: Hypothesis[]

  evidenceMap: EvidenceLink[]
  riskState: RiskState
  policyState: PolicyState
  memoryState: MemoryState

  entropy: {
    taskEntropy: number
    evidenceEntropy: number
    actionEntropy: number
    policyEntropy: number
    memoryEntropy: number
    commitEntropy: number
  }

  nextBestActions: CandidateAction[]
}
```

Operational entropy types:

| Entropy type     | Meaning                                              |
| ---------------- | ---------------------------------------------------- |
| Task entropy     | Is the user goal ambiguous?                          |
| Evidence entropy | Are key claims unsupported or contradictory?         |
| Action entropy   | Is the next action unclear?                          |
| Policy entropy   | Is it unclear whether the action is allowed?         |
| Memory entropy   | Are retrieved memories stale, conflicting, or noisy? |
| Commit entropy   | Is it risky to finalize now?                         |

The system loops only when the next action is expected to reduce decision-relevant uncertainty.

Simplified decision rule:

```text
next_action =
  argmax(
    expected_uncertainty_reduction
    + expected_risk_reduction
    - token_cost
    - latency_cost
    - human_interruption_cost
    - tool_cost
  )
```

Stop condition:

```text
Commit if:
  commitEntropy < threshold
  AND required verifiers pass
  AND risk class does not require approval
  AND no blocking policy violation exists
```

Escalation condition:

```text
Request approval if:
  the system has gathered enough evidence to explain the decision
  BUT authority boundary requires human sign-off
```

Ask-more-info condition:

```text
Ask user/customer only if:
  missing field is necessary
  AND no cheaper internal tool can resolve it
  AND asking will materially reduce commit entropy
```

This is the mechanism that prevents safety from making the model dumb.

---

## 9. Product Flow

The end-to-end product flow is:

```text
User request
  ↓
Qwen Workflow Designer
  ↓
WorkflowSpec generation
  ↓
Latent State Builder
  ↓
Entropy Estimator
  ↓
Loop Controller
  ↓
Tool / Memory / Verifier / Human Action
  ↓
Latent State Update
  ↓
Commit Gate
  ↓
Trace Store
  ↓
Failure Analysis
  ↓
Workflow Patch Proposal
  ↓
Replay Benchmark
  ↓
Promotion Gate
  ↓
Reusable Business Procedure Version
```

The key idea is that every workflow run produces both an output and learning material.

A run can end as:

```ts
type RunOutcome =
  | { type: "committed"; artifactId: string }
  | { type: "needs_approval"; reason: string }
  | { type: "needs_more_info"; missingFields: string[] }
  | { type: "rejected"; failedChecks: Check[] }
  | { type: "sandbox_only"; traceId: string }
```

A workflow improvement can end as:

```ts
type PromotionDecision =
  | { type: "promote"; fromVersion: string; toVersion: string }
  | { type: "reject"; regressionReport: RegressionReport }
  | { type: "needs_human_review"; reason: string }
```

---

## 10. Main Hackathon Demo Scenario

The primary demo should be a customer quote workflow.

Input:

> “Same as last time, need 120 cartons urgently next week. Supplier quote attached.”

A normal dynamic Qwen agent may:

* assume the SKU;
* use stale memory;
* miss current catalog price;
* invent delivery availability;
* draft or finalize a quote too confidently.

ClarityLoop should:

1. Parse the request.
2. Build a latent state.
3. Detect uncertainty around SKU, previous order, current price, stock, delivery date, and supplier quote.
4. Choose retrieve_previous_order as the next best action.
5. Update latent state.
6. Choose lookup_catalog and check_stock.
7. Compare supplier quote against current price.
8. Draft quote.
9. Detect whether delivery commitment or discount requires approval.
10. Commit draft internally or request human approval before external send.
11. Store trace.
12. Propose a workflow patch: for future “same as last time” requests, retrieve memory before drafting.
13. Replay old vs new workflow on synthetic cases.
14. Promote the improved workflow if false commits reduce without unacceptable completion loss.

The demo should show three columns:

| Baseline dynamic agent | ClarityLoop run                  | Promotion benchmark         |
| ---------------------- | -------------------------------- | --------------------------- |
| Fast but unsafe quote  | Uncertainty-guided evidence loop | Old vs new procedure result |

The key visual should be the uncertainty heatmap:

```text
Commit entropy: 0.82
Main gaps:
- exact SKU
- current price
- delivery evidence
- supplier quote mismatch

Next best action:
retrieve previous order
```

Then after retrieval:

```text
Commit entropy: 0.46
Resolved:
- likely SKU
- customer preference

Remaining:
- current price
- stock availability

Next best action:
lookup catalog and stock
```

Final:

```text
Commit entropy: 0.18
Decision:
safe to draft internally
approval required before external send
```

---

## 11. MVP Feature Scope

Must-have for Qwen submission:

1. Qwen API integration.
2. Alibaba Cloud backend deployment proof.
3. Dynamic WorkflowSpec generation.
4. Latent state builder.
5. Entropy scoring.
6. Next-best-action loop controller.
7. At least one business workflow: customer quote / supplier quote comparison.
8. Tool calls: memory lookup, catalog lookup, supplier quote parser, quote drafter.
9. Commit gate.
10. Human approval checkpoint for high-risk commit.
11. Trace view.
12. Replay benchmark view.
13. Workflow patch proposal.
14. Promotion gate.
15. Public open-source repo.
16. Architecture diagram.
17. 3-minute demo video.

Should-have:

1. Invoice exception workflow.
2. Supplier comparison workflow.
3. Fixed-gate baseline comparison.
4. Cost and token dashboard.
5. Memory value score.
6. Failure taxonomy.
7. Blog post for the Qwen blog/social prize.

Do-not-build for hackathon:

1. Full ERP integration.
2. Real email sending.
3. Multi-tenant auth.
4. Complex fine-tuning.
5. RL.
6. Full CPV migration.
7. Full enterprise governance platform.
8. Real payment or procurement API.
9. Large-scale vector memory.
10. Full OpenClaw/Hermes clone.

---

## 12. Technical Architecture

Recommended architecture:

```text
Frontend
  Next.js / Vite dashboard

Backend
  Alibaba Cloud Function Compute or ECS
  Hono / Fastify / Express API

Model Layer
  Qwen Cloud / Alibaba Model Studio
  OpenAI-compatible client adapter

Storage
  Alibaba OSS for artifacts
  SQLite/Postgres/RDS/Tablestore for run state
  Optional vector store for small memory retrieval

Core Runtime
  Workflow Designer
  Latent State Builder
  Entropy Estimator
  Loop Controller
  Tool Router
  Verifier Registry
  Commit Gate
  Promotion Gate
  Trace Store
  Memory Store
```

Post-hackathon portability:

```text
Alibaba backend adapter
  ↓
Cloudflare Workers adapter later

Alibaba OSS
  ↓
R2 adapter later

Alibaba DB
  ↓
D1 adapter later

Qwen client
  ↓
Provider-router abstraction later
```

The judged backend must run on Alibaba Cloud. Cloudflare should remain a post-competition portability target, not the submission deployment.

---

## 13. Suggested Monorepo Structure

```text
clarityloop/
  apps/
    web/
      Next.js dashboard
    api-alibaba/
      Alibaba Cloud backend adapter

  packages/
    core/
      WorkflowSpec
      LatentWorkflowState
      Trace
      CommitGate
      PromotionGate

    qwen/
      Qwen provider
      structured JSON generation
      model routing

    tools/
      catalog lookup
      memory lookup
      quote parser
      quote drafter
      supplier quote comparison

    verifiers/
      schema verifier
      numeric reconciliation verifier
      evidence coverage verifier
      policy verifier
      hallucinated tool verifier
      missing info verifier

    memory/
      operational memory store
      memory scoring
      TTL / conflict invalidation

    evals/
      ClarityLoopBench cases
      baseline runners
      scoring reports

    ui-types/
      shared frontend/backend types
```

---

## 14. Core Type Definitions

### WorkflowSpec

```ts
type WorkflowSpec = {
  id: string
  name: string
  goal: string
  version: string

  trigger: {
    domain: "quote" | "supplier_comparison" | "invoice_exception" | "hr_policy"
    naturalLanguagePatterns: string[]
  }

  steps: WorkflowStep[]

  allowedTools: ToolRef[]
  evidencePolicy: EvidencePolicy
  commitPolicy: CommitPolicy
  memoryPolicy: MemoryPolicy
  budgetPolicy: BudgetPolicy
}
```

### WorkflowStep

```ts
type WorkflowStep = {
  id: string
  name: string
  purpose: string
  action:
    | { type: "model"; promptTemplate: string }
    | { type: "tool"; toolName: string; args: Record<string, unknown> }
    | { type: "verifier"; verifierName: string }
    | { type: "approval"; approvalType: string }

  expectedOutputs: string[]
  evidenceProduced?: string[]
  entropyTarget?: keyof LatentWorkflowState["entropy"]
}
```

### EvidencePolicy

```ts
type EvidencePolicy = {
  requiredForClaims: {
    price: "catalog_or_supplier_quote"
    discount: "pricing_policy"
    delivery: "stock_or_logistics_source"
    customerPreference: "approved_memory_or_prior_order"
    supplierComparison: "uploaded_supplier_quote"
  }

  minimumCoverageForCommit: number
}
```

### CommitPolicy

```ts
type CommitPolicy = {
  autoCommitAllowed: boolean

  requireApprovalIf: {
    quoteValueAbove?: number
    discountAbovePct?: number
    evidenceCoverageBelow?: number
    deliveryUnconfirmed?: boolean
    externalSend?: boolean
    policyException?: boolean
  }

  forbiddenActions: string[]
}
```

### EntropyScore

```ts
type EntropyScore = {
  taskEntropy: number
  evidenceEntropy: number
  actionEntropy: number
  policyEntropy: number
  memoryEntropy: number
  commitEntropy: number
}
```

### CandidateAction

```ts
type CandidateAction = {
  id: string
  actionType:
    | "retrieve_memory"
    | "lookup_catalog"
    | "parse_document"
    | "ask_customer"
    | "ask_manager"
    | "draft_artifact"
    | "run_verifier"
    | "propose_workflow_patch"
    | "commit"

  expectedEntropyReduction: number
  expectedRiskReduction: number
  tokenCost: number
  latencyCost: number
  humanBurdenCost: number
  toolCost: number

  score: number
}
```

---

## 15. Entropy Scoring Formula

For hackathon MVP, use operational entropy, not true information-theoretic entropy.

Example:

```ts
commitEntropy =
  0.25 * missingFieldScore
  + 0.25 * unsupportedClaimScore
  + 0.20 * contradictionScore
  + 0.15 * policyAmbiguityScore
  + 0.10 * staleMemoryScore
  + 0.05 * toolFailureScore
```

Action score:

```ts
actionScore =
  expectedEntropyReduction
  + expectedRiskReduction
  - tokenCost
  - latencyCost
  - humanBurdenCost
  - toolCost
```

The loop runs until:

```text
commitEntropy < threshold
OR no useful information-gathering action remains
OR budget exhausted
OR human approval is required
OR workflow must ask for missing info
```

---

## 16. Memory Design

Do not store chat memory.

Store operational memory only.

The memory rule is:

> Store only memories that are expected to reduce future uncertainty or improve future action selection.

Allowed memory types:

```ts
type OperationalMemory =
  | CustomerPreferenceMemory
  | WorkflowFailurePatchMemory
  | PolicyExceptionMemory
  | EvidenceSourceMemory
  | VerifierFindingMemory
```

Example:

```json
{
  "type": "CustomerPreference",
  "entity": "Customer ABC",
  "fact": "Prefers delivery before Thursday noon",
  "source": "approved_quote_2026_06_10",
  "confidence": 0.86,
  "scope": "logistics",
  "ttlDays": 180,
  "lastUsedAt": "2026-06-16T10:00:00Z"
}
```

Example workflow patch memory:

```json
{
  "type": "WorkflowFailurePatch",
  "trigger": "customer says 'same as last time'",
  "patch": "insert retrieve_previous_order before draft_quote",
  "sourceTrace": "trace_001",
  "validatedByReplay": true,
  "scope": "quote_workflows",
  "expectedEntropyReduction": 0.31
}
```

Memory write gate:

```text
Raw trace
  → candidate memory
  → evidence validation
  → scope assignment
  → TTL assignment
  → conflict check
  → memory value score
  → write or reject
```

Memory value score:

```text
memory_value =
  expected_future_entropy_reduction
  × expected_reuse_frequency
  × evidence_confidence
  - retrieval_noise_cost
  - staleness_risk
  - storage_cost
```

Reject memory if:

* it is unsupported by evidence;
* it is one-off trivia;
* it does not change future action selection;
* it conflicts with stronger memory;
* it has unclear scope;
* it increases retrieval noise.

This prevents memory bloat.

---

## 17. Human Approval Strategy

Human approval must not become the bottleneck.

Use risk-tiered approval.

| Level | Action type                                                   | Approval policy        |
| ----- | ------------------------------------------------------------- | ---------------------- |
| L0    | Read-only / reversible                                        | No approval, log only  |
| L1    | Internal draft / low-risk artifact                            | Auto-commit with trace |
| L2    | External-facing but reversible                                | Approval by exception  |
| L3    | Financial, legal, irreversible, policy exception              | Explicit approval      |
| L4    | Workflow promotion, new tool permission, memory policy change | Owner approval         |

Humans approve boundaries, not every step.

Approval should be required for:

* external send;
* high-value quote;
* discount above threshold;
* legal-sensitive response;
* new workflow promotion;
* new tool permission;
* policy exception;
* persistent memory rule change.

Approval should not be required for:

* retrieval;
* parsing;
* drafting;
* internal calculation;
* low-risk summarization;
* sandbox simulation.

The goal is:

> Human at the authority boundary, not human in every loop.

---

## 18. Commit Gate

The commit gate determines whether an output can become an external or persistent business action.

Commit decisions:

```ts
type CommitDecision =
  | { type: "commit"; reason: string }
  | { type: "needs_approval"; reason: string; approvalPayload: ApprovalPayload }
  | { type: "needs_more_info"; missingFields: string[] }
  | { type: "reject"; failedChecks: Check[] }
  | { type: "sandbox_only"; reason: string }
```

Commit gate inputs:

* current latent state;
* evidence coverage;
* verifier results;
* policy state;
* risk class;
* tool outputs;
* memory confidence;
* workflow version;
* user-specified constraints.

Commit gate invariant:

> The model may propose a commit, but code decides whether the commit is allowed.

---

## 19. Promotion Gate

The promotion gate decides whether a workflow improvement becomes a reusable business procedure version.

Promotion is different from commit.

A commit is about one task output.

A promotion is about future behavior.

Promotion should require replay tests.

Promotion criteria:

```text
Promote new workflow only if:
  safe_completion_rate >= old workflow
  false_commit_rate <= old workflow
  policy_violation_rate <= old workflow
  approval_burden <= acceptable threshold
  cost_per_safe_completion <= budget
  latency <= budget
  memory_bloat <= threshold
  no critical regression on historical cases
```

Promotion decision:

```ts
type PromotionDecision =
  | { type: "promote"; from: string; to: string; report: PromotionReport }
  | { type: "reject"; reason: string; regressionReport: RegressionReport }
  | { type: "needs_human_review"; reason: string }
```

The slogan:

> Agents can propose better workflows. Evidence promotes them.

---

## 20. Benchmark Strategy

We should not benchmark “is ClarityLoop smarter than Claude Code?”

That is the wrong fight.

We should benchmark:

> Does uncertainty-guided governance reduce unsafe business commits with lower constraint tax than fixed gating?

Benchmark name:

> ClarityLoopBench

Domains:

1. customer quote workflow;
2. supplier quote comparison;
3. invoice exception resolution;
4. HR policy response;
5. customer support refund/cancellation.

For hackathon MVP, implement only 30 to 50 cases across the first two domains.

Case types:

* normal clear request;
* ambiguous request;
* “same as last time” memory case;
* stale memory case;
* supplier quote mismatch;
* catalog price mismatch;
* missing delivery date;
* unauthorized discount;
* unsupported claim;
* adversarial attachment instruction;
* policy exception;
* high-value quote requiring approval.

Baselines:

| Baseline              | Description                                                           |
| --------------------- | --------------------------------------------------------------------- |
| Bare Qwen             | Single prompt or simple tool call, no workflow                        |
| Dynamic Qwen Workflow | Qwen generates and executes workflow, no commit/promotion governance  |
| Fixed Gate            | Deterministic gate applied broadly, likely safer but more restrictive |
| ClarityLoop           | Dynamic workflow + entropy-aware loop + commit/promotion gate         |
| Human SOP             | Optional reference baseline                                           |

Primary metrics:

```text
task_completion_rate
false_commit_rate
policy_violation_rate
safe_completion_rate
approval_burden
evidence_coverage
constraint_tax
safety_gain
cost_per_safe_completion
latency_per_safe_completion
memory_bloat_rate
promotion_precision
promotion_recall
```

Core formulas:

```text
Safe Completion Rate =
  completed_task
  AND no false commit
  AND no policy violation
  AND evidence_coverage >= threshold
```

```text
Constraint Tax =
  task_completion_rate(dynamic_agent)
  - task_completion_rate(clarityloop)
```

```text
Safety Gain =
  false_commit_rate(dynamic_agent)
  - false_commit_rate(clarityloop)
```

Target hackathon result:

```text
Dynamic Qwen Workflow:
  task completion: high
  false commit: meaningfully non-zero

Fixed Gate:
  false commit: low
  task completion: lower
  approval burden: high

ClarityLoop:
  false commit: similarly low
  task completion: better than fixed gate
  approval burden: lower than fixed gate
```

This is the most important benchmark claim:

> ClarityLoop is not just safer. It is less dumb than fixed safety because it loops for missing signal before blocking.

---

## 21. Demo Video Structure

Target length: 3 minutes.

### 0:00–0:20 — Problem

“Dynamic agents can complete business tasks, but they may finalize unsafe work when the input is ambiguous.”

Show the messy quote request.

### 0:20–0:45 — Baseline failure

Show normal Qwen dynamic workflow drafting a quote too confidently.

Highlight:

* wrong/stale price;
* missing delivery evidence;
* unsupported assumption;
* unsafe external send.

### 0:45–1:30 — ClarityLoop run

Show:

* WorkflowSpec generated by Qwen;
* latent state;
* entropy heatmap;
* next best action;
* memory lookup;
* catalog lookup;
* supplier comparison;
* entropy reduction.

### 1:30–2:00 — Commit gate

Show:

* evidence coverage;
* policy result;
* commit entropy;
* decision: draft internally / approval required before send.

### 2:00–2:30 — Self-improvement

Show Qwen proposing a workflow patch:

```yaml
insert_step:
  after: parse_inquiry
  step: retrieve_previous_order
condition: inquiry contains "same as last time" or "repeat order"
```

### 2:30–2:50 — Replay promotion

Show old vs new workflow on 20 test cases.

Metrics:

* false commit reduced;
* approval burden controlled;
* safe completion improved.

### 2:50–3:00 — Closing

“ClarityLoop lets Qwen agents explore freely, loop for missing signal, and commit only when uncertainty is low enough for the business risk.”

---

## 22. UI Requirements

The UI must make the abstract idea obvious.

Recommended dashboard panels:

1. Input request.
2. Generated workflow.
3. Latent state / uncertainty heatmap.
4. Next best action.
5. Evidence map.
6. Tool call trace.
7. Commit gate decision.
8. Workflow patch proposal.
9. Replay benchmark.
10. Procedure version history.

The single most important visual:

```text
Commit entropy: 0.82 → 0.46 → 0.18
```

This lets judges understand that ClarityLoop is not blindly blocking. It is reducing uncertainty.

---

## 23. Qwen-Specific Usage

Qwen should be used deeply, not superficially.

Use Qwen for:

1. workflow generation;
2. structured latent state extraction;
3. uncertainty explanation;
4. next-best-action proposal;
5. document understanding / supplier quote parsing;
6. failure analysis;
7. workflow patch proposal;
8. human-readable audit summary;
9. benchmark explanation.

Use deterministic code for:

1. entropy scoring;
2. numeric reconciliation;
3. evidence coverage;
4. policy checks;
5. commit gate;
6. promotion gate;
7. memory TTL and conflict checks.

Model routing:

| Task                        | Suggested model                         |
| --------------------------- | --------------------------------------- |
| extraction / classification | Qwen Flash / low-cost model             |
| workflow generation         | Qwen Plus                               |
| failure analysis            | Qwen Plus / Max                         |
| supplier quote parsing      | Qwen VL if image/PDF screenshot is used |
| audit narrative             | Qwen Plus                               |
| verifier explanation        | Qwen Flash / Plus                       |

---

## 24. Relationship to CPV

CPV should not be the visible product.

CPV is useful as an internal design influence:

* verification specs;
* commit gates;
* audit trails;
* do-no-harm repair;
* deterministic verifiers;
* policy-selected execution.

But CPV has not proven broad benchmark superiority. Its strongest lesson is narrower:

> Verification helps when the domain has high-coverage, trustworthy, non-leaking signals. It does not magically solve open-ended agent capability.

Therefore, ClarityLoop should not claim:

> CPV proves agents perform better.

It should claim:

> We apply verification and governance only at the right boundaries, and use entropy-aware loops to avoid over-constraining the model.

CPV becomes the safety kernel inspiration, not the product narrative.

---

## 25. Technical Implementation Plan

### Phase 1: Repo and Qwen setup

* Create new repo: `clarityloop`.
* Set open-source license.
* Add monorepo structure.
* Implement Qwen OpenAI-compatible client.
* Deploy simple backend on Alibaba Cloud.
* Add proof-of-deployment file.

### Phase 2: Workflow generation

* Implement `WorkflowSpec`.
* Prompt Qwen to generate workflow from messy request.
* Validate workflow schema.
* Reject workflows requesting unauthorized tools.

### Phase 3: Latent state and entropy

* Implement `LatentWorkflowState`.
* Use Qwen to extract known facts, missing fields, evidence gaps, risk flags.
* Implement deterministic entropy scoring.
* Show entropy heatmap in UI.

### Phase 4: Tool loop

* Implement tools:

  * retrieve memory;
  * lookup catalog;
  * parse supplier quote;
  * compare quote;
  * draft quote;
  * ask approval.

* Implement next-best-action scorer.

* Run loop until stop condition.

### Phase 5: Commit gate

* Implement evidence coverage verifier.
* Implement numeric verifier.
* Implement policy verifier.
* Implement commit decision.
* Implement approval screen.

### Phase 6: Workflow improvement

* Store failed trace.
* Ask Qwen to propose workflow patch.
* Validate patch schema.
* Replay old vs new workflow on small benchmark.
* Promote or reject.

### Phase 7: Demo polish

* Seed 20–30 benchmark cases.
* Build baseline comparison.
* Create architecture diagram.
* Record 3-minute video.
* Write README and Devpost text.

---

## 26. Timeline

Assuming work starts immediately on 16 June 2026.

| Date         | Focus               | Deliverable                                           |
| ------------ | ------------------- | ----------------------------------------------------- |
| Jun 16–17    | Setup               | Repo, Qwen client, Alibaba backend skeleton           |
| Jun 18–20    | Workflow generation | WorkflowSpec, schema validation, basic UI             |
| Jun 21–23    | Latent loop         | Latent state builder, entropy scoring, next action    |
| Jun 24–26    | Tools               | catalog, memory, supplier quote parser, quote drafter |
| Jun 27–29    | Commit gate         | evidence, numeric, policy, approval screen            |
| Jun 30–Jul 2 | Replay benchmark    | baseline runners, ClarityLoopBench v0                 |
| Jul 3–5      | Workflow promotion  | patch proposal, replay report, version history        |
| Jul 6–7      | UI polish           | heatmap, trace view, benchmark view                   |
| Jul 8        | Video and docs      | demo video, README, architecture diagram              |
| Jul 9        | Submission          | Final Devpost submission                              |

Deadline is July 9, 2026, 2:00 PM PDT, equivalent to July 10, 2026, 5:00 AM Malaysia time.

---

## 27. Team and Budget

Ideal team:

| Role                   | Responsibility                                      |
| ---------------------- | --------------------------------------------------- |
| Tech lead              | architecture, backend, Qwen integration, deployment |
| Agent/runtime engineer | workflow spec, latent loop, commit/promotion gates  |
| UI/demo engineer       | dashboard, visualizations, video, docs              |

Lean team is possible with two people if scope is cut to one main workflow.

Estimated effort:

| Mode         | Team |   Hours | Outcome                 |
| ------------ | ---: | ------: | ----------------------- |
| Lean MVP     |    2 | 120–180 | Submit-worthy           |
| Strong entry |    3 | 220–350 | Competitive             |
| Winner-grade |  3–4 | 350–500 | Strong if demo polished |

Estimated cost:

| Item            |               Estimate |
| --------------- | ---------------------: |
| Qwen API        | $30–150 beyond credits |
| Alibaba backend |                $20–100 |
| Storage / DB    |                  $0–50 |
| Domain / misc   |                  $0–30 |
| Total expected  |                $50–250 |
| Hard cap        |                   $300 |

---

## 28. Adversarial Review

### Risk 1: “This is just Claude Code dynamic workflows.”

Valid.

Response:

ClarityLoop is not claiming to invent dynamic workflows. The differentiation is uncertainty-guided business procedure governance: commit readiness, replay-based promotion, risk-tiered approval, and bounded operational memory.

### Risk 2: “Safety makes the agent dumb.”

Valid.

Response:

ClarityLoop does not constrain exploration. It gates only authority-boundary actions. The benchmark explicitly measures constraint tax and compares entropy-aware control against fixed gates.

### Risk 3: “Evidence does not always improve performance.”

Valid.

Response:

ClarityLoop does not claim evidence improves model intelligence. It claims evidence reduces unsafe finalization in domains where business facts are externally checkable.

### Risk 4: “Human approval becomes bottleneck.”

Valid.

Response:

Approval is risk-tiered. Humans approve high-risk commits, workflow promotion, policy exceptions, and new permissions, not every step.

### Risk 5: “Memory will bloat.”

Valid.

Response:

Memory stores only validated operational deltas expected to reduce future entropy. Raw chat history is not memory.

### Risk 6: “Too abstract for a hackathon.”

Critical.

Response:

The demo must be concrete: unsafe quote prevented, uncertainty reduced, workflow improved, benchmark shown.

### Risk 7: “Qwen usage is too superficial.”

Critical.

Response:

Qwen must visibly generate the workflow, build latent state, analyze failures, propose workflow patches, and generate audit explanations.

### Risk 8: “Alibaba deployment requirement causes friction.”

Critical.

Response:

Judged backend must run on Alibaba Cloud. Cloudflare is only a post-hackathon portability adapter.

---

## 29. Final USP

Main USP:

> ClarityLoop is an uncertainty-guided autonomy layer for business agents. It lets agents generate workflows dynamically, but uses entropy-aware loops, risk-tiered commit gates, replay promotion, and bounded memory to turn successful agent behavior into governed business procedures.

Shorter USP:

> From dynamic agent runs to approved business procedures.

Hackathon tagline:

> Let agents explore freely. Loop for missing signal. Commit only when uncertainty is low enough.

Technical tagline:

> Entropy-aware latent loops for risk-adjusted agent autonomy.

Commercial angle:

> ClarityLoop helps businesses deploy agentic workflows without choosing between brittle fixed automation and unsafe free-form autonomy.

---

## 30. Recommended Final Build Direction

Proceed with ClarityLoop for Qwen Track 4.

Do not build a generic agent framework.

Do not build a full governance SaaS.

Do not lead with CPV.

Build one polished vertical slice:

```text
messy customer quote request
→ Qwen-generated workflow
→ latent uncertainty heatmap
→ entropy-guided evidence loop
→ commit gate
→ workflow patch proposal
→ replay benchmark
→ promoted business procedure
```

The winning story:

> A normal dynamic agent tries to finish the task. ClarityLoop knows when the task is not clear enough to safely finish, gathers the missing signal, and only commits or promotes when the business risk is justified.

This is specific, current, technically differentiated, and demoable within the Qwen hackathon timeline.

---

## 31. Research Update: HarnessX (and the repositioning it forces)

HarnessX (*A Composable, Adaptive, and Evolvable Agent Harness Foundry*, arXiv:2606.14249, 12 June
2026) introduces typed harness primitives, a substitution algebra, and **AEGIS**, a trace-driven
multi-agent harness-evolution engine, reporting **+14.5% average** (up to +44%) across ALFWorld,
GAIA, WebShop, tau³-Bench, and SWE-bench Verified. Its codebase is not yet released.

**Implication.** "Self-evolving harness" is no longer a unique USP — HarnessX owns that space and
has stronger benchmark evidence. ClarityLoop must therefore **not** lead with "we evolve workflows
from traces." Instead:

> **HarnessX optimizes harness performance. ClarityLoop decides when an evolved workflow is clear
> enough, safe enough, and authorized enough to become a business procedure.**

**Revised category:** **Agent Workflow Release Control** — not a harness foundry, not a dynamic
workflow engine. **Updated USP:** *Harnesses evolve. ClarityLoop decides what ships.* For the
hackathon: *Qwen generates and improves workflows; ClarityLoop uses uncertainty-guided loops to
decide when to gather evidence, ask a human, commit, or promote.*

**What HarnessX validates:** harness/runtime is a first-class object; static hand-crafted harnesses
are obsolescent; execution traces should drive improvement; typed primitives matter. ClarityLoop
borrows the architectural inspiration (typed governance primitives, a `WorkflowPatch` algebra,
a small AEGIS-like trace→patch→replay→promote loop) but **not** the product category, and does
**not** close the loop into model training (out of MVP scope).

**What HarnessX does not foreground** (our wedge): when is a workflow safe to commit externally;
ask-for-evidence vs ask-a-human; preventing safe-but-dumb behavior; measuring constraint tax;
memory bloat; promoting/rejecting workflows under business risk; auditable procedure versioning;
sandbox-autonomy vs authority-boundary actions.

**Benchmark consequence (implemented).** ClarityLoopBench now includes a fifth baseline,
**`harness_evolution`** — a performance-optimized, HarnessX-like agent that resolves gaps well but
has **no risk gate**. The sharpened claim is no longer "we complete more than a fixed gate"; it is:

> Against a performance-optimized evolved harness, ClarityLoop sacrifices a little raw completion
> (constraint tax) to **eliminate its unsafe commits** (safety gain) — risk-adjusted release
> control, not raw success maximization.

Measured result: `harness_evolution` 100% completion / 36% false-commit vs `clarityloop` 86% / 0%
— a 14-point completion cost for a 36-point safety gain, scored by one uniform rubric.

