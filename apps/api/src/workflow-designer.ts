import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  WorkflowSpecSchema, ToolNameSchema, assertWorkflowToolsAuthorized,
  type ToolName, type WorkflowDomain, type WorkflowSpec,
  type EvidencePolicy, type CommitPolicy, type MemoryPolicy, type BudgetPolicy,
} from "@clarityloop/core";
import { generateStructured, type ChatMessage, type ModelProvider } from "@clarityloop/qwen";

/**
 * What Qwen is asked to produce: a forgiving OUTLINE of the creative parts only.
 * Everything is optional with a default, so a slightly-off model response still parses —
 * deterministic code assembles the full governed WorkflowSpec (policies, ids, step actions).
 * Tools are accepted as free strings here and validated against the ToolName enum in code,
 * so a hallucinated tool name can't throw — it is dropped, and a real-but-unauthorized tool
 * is still surfaced by assertWorkflowToolsAuthorized (-> 422).
 */
export const WorkflowOutlineSchema = z.object({
  name: z.string().default("Generated workflow"),
  goal: z.string().default(""),
  naturalLanguagePatterns: z.array(z.string()).default([]),
  steps: z
    .array(
      z.object({
        name: z.string().default("step"),
        purpose: z.string().default(""),
        tool: z.string().nullable().default(null),
      }),
    )
    .default([]),
  toolsToUse: z.array(z.string()).default([]),
});
export type WorkflowOutline = z.infer<typeof WorkflowOutlineSchema>;

const isToolName = (s: string): s is ToolName => ToolNameSchema.safeParse(s).success;

const DEFAULT_EVIDENCE_POLICY: EvidencePolicy = {
  requiredForClaims: {
    price: "catalog_or_supplier_quote",
    discount: "pricing_policy",
    delivery: "stock_or_logistics_source",
    customerPreference: "approved_memory_or_prior_order",
    supplierComparison: "uploaded_supplier_quote",
  },
  minimumCoverageForCommit: 0.8,
};
const DEFAULT_COMMIT_POLICY: CommitPolicy = {
  autoCommitAllowed: true,
  requireApprovalIf: {
    quoteValueAbove: 10000,
    discountAbovePct: 10,
    evidenceCoverageBelow: 0.8,
    deliveryUnconfirmed: true,
    externalSend: true,
    policyException: true,
  },
  forbiddenActions: [],
  commitEntropyThreshold: 0.3,
};
const DEFAULT_MEMORY_POLICY: MemoryPolicy = {
  writeEnabled: true,
  allowedTypes: ["CustomerPreference", "WorkflowFailurePatch", "PolicyException", "EvidenceSource", "VerifierFinding"],
  minMemoryValueToWrite: 0.2,
  defaultTtlDays: 180,
  maxEntriesPerScope: 100,
  conflictResolution: "prefer_higher_confidence",
};
const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  maxLoopIterations: 8,
  maxTokens: 100000,
  maxToolCalls: 12,
  maxHumanAsks: 2,
  maxLatencyMs: 60000,
};

export function buildWorkflowDesignerMessages(
  request: string,
  domain: WorkflowDomain | undefined,
  allowedTools: ToolName[],
): ChatMessage[] {
  const system = [
    "You are ClarityLoop's Workflow Designer.",
    "Turn a messy business request into a workflow OUTLINE as a single JSON object with EXACTLY this shape:",
    '{ "name": string, "goal": string, "naturalLanguagePatterns": string[],',
    '  "steps": [{ "name": string, "purpose": string, "tool": <a tool name from the allow-list, or null> }],',
    '  "toolsToUse": [<tool names from the allow-list>] }',
    `Only reference tools from this allow-list: ${allowedTools.join(", ")}.`,
    "Return ONLY the JSON object. Never emit an entropy value, a score, a policy, or a commit decision —",
    "those are added by deterministic code, not by you.",
  ].join(" ");
  const user = domain ? `Domain: ${domain}\nRequest: ${request}` : `Request: ${request}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Deterministically build a complete, schema-valid WorkflowSpec from the model's outline. */
export function assembleWorkflowSpec(
  outline: WorkflowOutline,
  args: { domain?: WorkflowDomain },
): WorkflowSpec {
  const namedTools = [
    ...new Set(
      [...outline.toolsToUse, ...outline.steps.map((s) => s.tool ?? "")].filter(isToolName),
    ),
  ];
  const spec: WorkflowSpec = {
    id: `wf-${randomUUID()}`,
    name: outline.name,
    goal: outline.goal,
    version: "v1",
    trigger: {
      domain: args.domain ?? "quote",
      naturalLanguagePatterns: outline.naturalLanguagePatterns,
    },
    steps: outline.steps.map((s, i) => ({
      id: `step-${i + 1}`,
      name: s.name,
      purpose: s.purpose,
      action:
        s.tool && isToolName(s.tool)
          ? { type: "tool", toolName: s.tool, args: {} }
          : { type: "model", promptTemplate: s.purpose },
      expectedOutputs: [],
      evidenceProduced: null,
      entropyTarget: null,
    })),
    allowedTools: namedTools.map((toolName) => ({ toolName, defaultArgs: null })),
    evidencePolicy: DEFAULT_EVIDENCE_POLICY,
    commitPolicy: DEFAULT_COMMIT_POLICY,
    memoryPolicy: DEFAULT_MEMORY_POLICY,
    budgetPolicy: DEFAULT_BUDGET_POLICY,
  };
  // Safety net: guarantee the assembled object satisfies the canonical schema.
  return WorkflowSpecSchema.parse(spec);
}

/**
 * Qwen generates the creative outline; deterministic code assembles + validates the WorkflowSpec
 * and enforces the allow-list. If the model output is unusable, fall back to a minimal outline so
 * the endpoint stays robust (it never 500s on a malformed generation).
 */
export async function designWorkflow(
  provider: ModelProvider,
  args: { request: string; domain?: WorkflowDomain; allowedTools: ToolName[] },
): Promise<WorkflowSpec> {
  let outline: WorkflowOutline;
  try {
    outline = await generateStructured(provider, WorkflowOutlineSchema, {
      task: "workflow_generation",
      messages: buildWorkflowDesignerMessages(args.request, args.domain, args.allowedTools),
    });
  } catch {
    outline = WorkflowOutlineSchema.parse({ name: "Workflow", goal: args.request });
  }
  const spec = assembleWorkflowSpec(outline, { domain: args.domain });
  assertWorkflowToolsAuthorized(spec, args.allowedTools);
  return spec;
}
