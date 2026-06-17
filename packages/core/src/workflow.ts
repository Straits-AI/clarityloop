import { z } from "zod";
import {
  WorkflowDomainSchema, ToolNameSchema, VerifierNameSchema, RiskClassSchema,
  ClaimCategorySchema, EvidenceRequirementSchema, OperationalMemoryTypeSchema,
} from "./primitives";

export const ToolPermissionLevelSchema = z.enum(["read_only", "draft", "external", "mutating"]);
export type ToolPermissionLevel = z.infer<typeof ToolPermissionLevelSchema>;

/** A tool the workflow DECLARES it may call (the as-generated proposal). */
export const ToolRefSchema = z.object({
  toolName: ToolNameSchema,
  defaultArgs: z.record(z.unknown()).nullable(),
});
export type ToolRef = z.infer<typeof ToolRefSchema>;

/** A GOVERNED grant of authority for a tool (what the org actually permits). */
export const ToolPermissionSchema = z.object({
  toolName: ToolNameSchema,
  level: ToolPermissionLevelSchema,
  maxRiskClass: RiskClassSchema,
  constraints: z.record(z.unknown()).nullable(),
});
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;

export const WorkflowStepActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("model"),    promptTemplate: z.string() }),
  z.object({ type: z.literal("tool"),     toolName: ToolNameSchema, args: z.record(z.unknown()).default({}) }),
  z.object({ type: z.literal("verifier"), verifierName: VerifierNameSchema }),
  z.object({ type: z.literal("approval"), approvalType: z.string() }),
]);
export type WorkflowStepAction = z.infer<typeof WorkflowStepActionSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  action: WorkflowStepActionSchema,
  expectedOutputs: z.array(z.string()),
  evidenceProduced: z.array(z.string()).nullable(),
  entropyTarget: z.enum([
    "taskEntropy", "evidenceEntropy", "actionEntropy",
    "policyEntropy", "memoryEntropy", "commitEntropy",
  ]).nullable(),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const EvidencePolicySchema = z.object({
  requiredForClaims: z.record(ClaimCategorySchema, EvidenceRequirementSchema),
  minimumCoverageForCommit: z.number().min(0).max(1),
});
export type EvidencePolicy = z.infer<typeof EvidencePolicySchema>;

export const CommitPolicySchema = z.object({
  autoCommitAllowed: z.boolean(),
  requireApprovalIf: z.object({
    quoteValueAbove: z.number().nullable(),
    discountAbovePct: z.number().nullable(),
    evidenceCoverageBelow: z.number().nullable(),
    deliveryUnconfirmed: z.boolean().nullable(),
    externalSend: z.boolean().nullable(),
    policyException: z.boolean().nullable(),
  }),
  forbiddenActions: z.array(z.string()),
  commitEntropyThreshold: z.number().min(0).max(1).default(0.3),
});
export type CommitPolicy = z.infer<typeof CommitPolicySchema>;

export const MemoryPolicySchema = z.object({
  writeEnabled: z.boolean(),
  allowedTypes: z.array(OperationalMemoryTypeSchema),
  minMemoryValueToWrite: z.number(),
  defaultTtlDays: z.number().int().positive(),
  maxEntriesPerScope: z.number().int().positive(),
  conflictResolution: z.enum(["prefer_higher_confidence", "prefer_newer", "reject_on_conflict"]),
});
export type MemoryPolicy = z.infer<typeof MemoryPolicySchema>;

export const BudgetPolicySchema = z.object({
  maxLoopIterations: z.number().int().positive(),
  maxTokens: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  maxHumanAsks: z.number().int().nonnegative(),
  maxLatencyMs: z.number().int().positive(),
});
export type BudgetPolicy = z.infer<typeof BudgetPolicySchema>;

export const WorkflowSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  goal: z.string(),
  version: z.string(),
  trigger: z.object({
    domain: WorkflowDomainSchema,
    naturalLanguagePatterns: z.array(z.string()),
  }),
  steps: z.array(WorkflowStepSchema),
  allowedTools: z.array(ToolRefSchema),
  evidencePolicy: EvidencePolicySchema,
  commitPolicy: CommitPolicySchema,
  memoryPolicy: MemoryPolicySchema,
  budgetPolicy: BudgetPolicySchema,
});
export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;
