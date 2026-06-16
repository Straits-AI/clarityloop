import { z } from "zod";
import { VerifierNameSchema } from "./primitives";

export const ActionTypeSchema = z.enum([
  "retrieve_memory", "lookup_catalog", "check_stock",
  "parse_supplier_quote", "compare_quote", "draft_quote",
  "run_verifier", "ask_customer", "ask_manager", "propose_workflow_patch", "commit",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

/** What Qwen returns when asked for next-best-action candidates (structure only, NO scores). */
export const ProposedActionSchema = z.object({
  id: z.string(),
  actionType: ActionTypeSchema,
  verifierName: VerifierNameSchema.nullable(),
  targetField: z.string().nullable(),
  rationale: z.string(),
});
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

/** A scored candidate. The cost/score fields are CODE-computed, never model-emitted. */
export const CandidateActionSchema = ProposedActionSchema.extend({
  expectedEntropyReduction: z.number(),
  expectedRiskReduction: z.number(),
  tokenCost: z.number(),
  latencyCost: z.number(),
  humanBurdenCost: z.number(),
  toolCost: z.number(),
  score: z.number(),
});
export type CandidateAction = z.infer<typeof CandidateActionSchema>;
