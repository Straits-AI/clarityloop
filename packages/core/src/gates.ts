import { z } from "zod";
import { RiskClassSchema, VerifierNameSchema, EvidenceRefSchema } from "./primitives";

/** One verifier finding. A Verifier (§12) returns Check[]. */
export const CheckSchema = z.object({
  name: z.string(),
  verifier: VerifierNameSchema,
  passed: z.boolean(),
  severity: z.enum(["info", "warn", "blocking"]),
  detail: z.string(),
});
export type Check = z.infer<typeof CheckSchema>;

/** What is shown to a human approver. */
export const ApprovalPayloadSchema = z.object({
  runId: z.string(),
  riskClass: RiskClassSchema,
  reason: z.string(),
  summary: z.string(),
  evidence: z.array(EvidenceRefSchema),
  proposedArtifactId: z.string().nullable(),
  failedChecks: z.array(CheckSchema),
});
export type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;

/** The resolved approval. */
export const ApprovalRecordSchema = z.object({
  id: z.string(),
  payload: ApprovalPayloadSchema,
  decision: z.enum(["approved", "rejected"]),
  approver: z.string(),
  decidedAt: z.string(),
  note: z.string().nullable(),
});
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

/** Output of the commit gate (verb-form tags). */
export const CommitDecisionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("commit"),          reason: z.string() }),
  z.object({ type: z.literal("needs_approval"),  reason: z.string(), approvalPayload: ApprovalPayloadSchema }),
  z.object({ type: z.literal("needs_more_info"), missingFields: z.array(z.string()) }),
  z.object({ type: z.literal("reject"),          failedChecks: z.array(CheckSchema) }),
  z.object({ type: z.literal("sandbox_only"),    reason: z.string() }),
]);
export type CommitDecision = z.infer<typeof CommitDecisionSchema>;

/** Terminal record of a run (past-tense tags + run IDs). */
export const RunOutcomeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("committed"),       runId: z.string(), traceId: z.string(), artifactId: z.string() }),
  z.object({ type: z.literal("needs_approval"),  runId: z.string(), traceId: z.string(), approvalPayload: ApprovalPayloadSchema }),
  z.object({ type: z.literal("needs_more_info"), runId: z.string(), traceId: z.string(), missingFields: z.array(z.string()) }),
  z.object({ type: z.literal("rejected"),        runId: z.string(), traceId: z.string(), failedChecks: z.array(CheckSchema) }),
  z.object({ type: z.literal("sandbox_only"),    runId: z.string(), traceId: z.string() }),
]);
export type RunOutcome = z.infer<typeof RunOutcomeSchema>;
