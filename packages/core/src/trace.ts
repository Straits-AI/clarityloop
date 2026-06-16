import { z } from "zod";
import { WorkflowDomainSchema } from "./primitives";
import { CandidateActionSchema } from "./actions";
import { RunOutcomeSchema } from "./gates";

/** Matches the existing EntropyScore type from Plan 1 (schema form). */
export const EntropyScoreSchema = z.object({
  taskEntropy: z.number(), evidenceEntropy: z.number(), actionEntropy: z.number(),
  policyEntropy: z.number(), memoryEntropy: z.number(), commitEntropy: z.number(),
});

export const TraceStepSchema = z.object({
  index: z.number().int().nonnegative(),
  at: z.string(),
  input: z.unknown(),
  action: CandidateActionSchema,
  toolOutput: z.unknown().nullable(),
  entropyBefore: EntropyScoreSchema,
  entropyAfter: EntropyScoreSchema,
});
export type TraceStep = z.infer<typeof TraceStepSchema>;

export const TraceSchema = z.object({
  id: z.string(),
  runId: z.string(),
  procedureVersionId: z.string().nullable(),
  workflowVersion: z.string(),
  domain: WorkflowDomainSchema,
  createdAt: z.string(),
  steps: z.array(TraceStepSchema),
  outcome: RunOutcomeSchema.nullable(),
});
export type Trace = z.infer<typeof TraceSchema>;

/** Lightweight pointer stored on BusinessProcedureVersion.runTraces. */
export const TraceReferenceSchema = z.object({
  traceId: z.string(),
  runId: z.string(),
  createdAt: z.string(),
  outcomeType: z.enum(["committed", "needs_approval", "needs_more_info", "rejected", "sandbox_only"]),
  artifactKey: z.string().nullable(),
});
export type TraceReference = z.infer<typeof TraceReferenceSchema>;
