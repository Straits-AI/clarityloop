import { z } from "zod";
import { ClaimCategorySchema, ToolNameSchema, VerifierNameSchema } from "./primitives";

/** Fields shared by every operational-memory record. `value` is scoreMemoryValue() output (Plan 6). */
const memoryBase = {
  id: z.string(),
  scope: z.string(),
  source: z.string(),
  confidence: z.number().min(0).max(1),
  ttlDays: z.number().int().positive(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  value: z.number(),
};

export const CustomerPreferenceMemorySchema = z.object({
  type: z.literal("CustomerPreference"),
  entity: z.string(),
  fact: z.string(),
  ...memoryBase,
});

export const WorkflowFailurePatchMemorySchema = z.object({
  type: z.literal("WorkflowFailurePatch"),
  trigger: z.string(),
  patch: z.string(),
  validatedByReplay: z.boolean(),
  expectedEntropyReduction: z.number(),
  ...memoryBase,
});

export const PolicyExceptionMemorySchema = z.object({
  type: z.literal("PolicyException"),
  rule: z.string(),
  exception: z.string(),
  approvedBy: z.string(),
  ...memoryBase,
});

export const EvidenceSourceMemorySchema = z.object({
  type: z.literal("EvidenceSource"),
  claimCategory: ClaimCategorySchema,
  sourceTool: ToolNameSchema,
  ...memoryBase,
});

export const VerifierFindingMemorySchema = z.object({
  type: z.literal("VerifierFinding"),
  verifierName: VerifierNameSchema,
  finding: z.string(),
  ...memoryBase,
});

export const OperationalMemorySchema = z.discriminatedUnion("type", [
  CustomerPreferenceMemorySchema,
  WorkflowFailurePatchMemorySchema,
  PolicyExceptionMemorySchema,
  EvidenceSourceMemorySchema,
  VerifierFindingMemorySchema,
]);
export type OperationalMemory = z.infer<typeof OperationalMemorySchema>;
