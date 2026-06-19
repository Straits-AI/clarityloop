import { z } from "zod";
import { LatentWorkflowStateSchema, type LatentWorkflowState } from "@clarityloop/core";
import { generateStructured, extractJson, type ChatMessage, type ModelProvider } from "@clarityloop/qwen";

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

function extractionMessages(input: LatentExtractionInput): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Workflow goal: ${input.goal}\n\nBusiness request:\n${input.request}` },
  ];
}

function finalizeState(structure: unknown, input: LatentExtractionInput): LatentWorkflowState {
  // Deterministic override: goal + version come from code, never the model.
  return LatentWorkflowStateSchema.parse({
    ...ExtractionSchema.parse(structure),
    goal: input.goal,
    workflowVersion: input.workflowVersion,
  });
}

export async function extractLatentState(
  provider: ModelProvider,
  input: LatentExtractionInput,
): Promise<LatentWorkflowState> {
  const structure = await generateStructured(provider, ExtractionSchema, {
    task: "extraction",
    messages: extractionMessages(input),
  });
  return finalizeState(structure, input);
}

/** Streams the raw model tokens of the extraction, then yields the parsed final state.
 *  Lets the UI show the live LLM output as Qwen writes the structured state. */
export async function* extractLatentStateStream(
  provider: ModelProvider,
  input: LatentExtractionInput,
): AsyncGenerator<{ type: "token"; token: string } | { type: "state"; state: LatentWorkflowState }> {
  const messages = extractionMessages(input);
  let raw = "";
  if (provider.completeStream) {
    for await (const tok of provider.completeStream(messages, { task: "extraction" })) {
      raw += tok;
      yield { type: "token", token: tok };
    }
  } else {
    raw = await provider.complete(messages, { task: "extraction" });
    yield { type: "token", token: raw };
  }
  yield { type: "state", state: finalizeState(extractJson(raw), input) };
}
