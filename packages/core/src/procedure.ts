import { z } from "zod";
import { RiskClassSchema } from "./primitives";
import {
  WorkflowSpecSchema, ToolPermissionSchema, EvidencePolicySchema,
  CommitPolicySchema, MemoryPolicySchema,
} from "./workflow";
import { AuthorityBoundarySchema } from "./governance";
import { ApprovalRecordSchema } from "./gates";
import { TraceReferenceSchema } from "./trace";

export const EvaluationResultSchema = z.object({
  caseId: z.string(),
  metric: z.string(),
  value: z.number(),
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const BusinessProcedureVersionSchema = z.object({
  id: z.string(),
  parentVersion: z.string().nullable(),
  name: z.string(),
  goal: z.string(),
  workflowSpec: WorkflowSpecSchema,
  allowedTools: z.array(ToolPermissionSchema),
  authorityBoundary: AuthorityBoundarySchema,
  evidencePolicy: EvidencePolicySchema,
  riskClass: RiskClassSchema,
  commitPolicy: CommitPolicySchema,
  memoryPolicy: MemoryPolicySchema,
  evalResults: z.array(EvaluationResultSchema),
  approvalRecord: ApprovalRecordSchema.nullable(),
  rollbackPointer: z.string().nullable(),
  runTraces: z.array(TraceReferenceSchema),
  createdAt: z.string(),
  promotedAt: z.string().nullable(),
});
export type BusinessProcedureVersion = z.infer<typeof BusinessProcedureVersionSchema>;
