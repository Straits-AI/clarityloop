import { z } from "zod";
import { LatentWorkflowStateSchema, type LatentWorkflowState } from "@clarityloop/core";
import { generateStructured, type ModelProvider } from "@clarityloop/qwen";

/** Narrow projection of a WorkflowSpec the loop needs (see plan's decoupling decision). */
export const LatentExtractionInputSchema = z.object({
  request: z.string(),
  workflowVersion: z.string(),
  goal: z.string(),
});
export type LatentExtractionInput = z.infer<typeof LatentExtractionInputSchema>;

// The model returns STRUCTURE only; goal + workflowVersion are authoritative from code.
const ExtractionSchema = LatentWorkflowStateSchema.omit({ goal: true, workflowVersion: true });

const SYSTEM_PROMPT = [
  "You are ClarityLoop's latent-state extractor.",
  "Read the business request and return ONLY a JSON object describing the structured latent state.",
  "Keys: knownFacts, missingFields, claims, riskFlags, policyFlags, staleMemoryRefs, toolFailures.",
  "- knownFacts: { id, text, confidence(0..1) } established directly from the request.",
  "- missingFields: { id, name, necessity: 'required'|'optional' } facts needed before committing.",
  "- claims: { id, text, evidencePointer } — set evidencePointer to null (no tool has run yet).",
  "- riskFlags: { id, kind, severity: 'low'|'medium'|'high' }.",
  "- policyFlags: { id, rule, ambiguous: boolean }.",
  "- staleMemoryRefs: string[]; toolFailures: string[].",
  "NEVER output any entropy, score, probability, or commit decision — code computes those.",
].join("\n");

export async function extractLatentState(
  provider: ModelProvider,
  input: LatentExtractionInput,
): Promise<LatentWorkflowState> {
  const structure = await generateStructured(provider, ExtractionSchema, {
    task: "extraction",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Workflow goal: ${input.goal}\n\nBusiness request:\n${input.request}` },
    ],
  });
  // Deterministic override: goal + version come from code, never the model.
  return LatentWorkflowStateSchema.parse({
    ...structure,
    goal: input.goal,
    workflowVersion: input.workflowVersion,
  });
}
