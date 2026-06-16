import { z } from "zod";
import { OperationalMemoryTypeSchema, type EvidenceRef, type OperationalMemory } from "@clarityloop/core";
import type { MemoryRepository } from "@clarityloop/storage";
import type { Tool, ToolResult } from "./tool";

export const RetrieveMemoryArgsSchema = z.object({
  scope: z.string(),
  entity: z.string().nullable().default(null),
  type: OperationalMemoryTypeSchema.nullable().default(null),
});
export type RetrieveMemoryArgs = z.infer<typeof RetrieveMemoryArgsSchema>;
// Cast needed because ZodDefault widens the input type to include `undefined` while the output
// (RetrieveMemoryArgs) is narrower — the Tool interface constrains input == output via ZodType<T>.
const RetrieveMemoryArgsInput = RetrieveMemoryArgsSchema as z.ZodType<RetrieveMemoryArgs>;

function snippet(m: OperationalMemory): string {
  switch (m.type) {
    case "CustomerPreference":
      return `${m.entity}: ${m.fact}`;
    case "WorkflowFailurePatch":
      return `patch: ${m.patch}`;
    case "PolicyException":
      return `exception: ${m.exception}`;
    case "EvidenceSource":
      return `${m.claimCategory} via ${m.sourceTool}`;
    case "VerifierFinding":
      return `${m.verifierName}: ${m.finding}`;
  }
}

export function makeRetrieveMemoryTool(repo: MemoryRepository): Tool<RetrieveMemoryArgs, OperationalMemory[]> {
  return {
    name: "retrieve_memory",
    description: "Fetch relevant approved operational memory for a scope/entity/type.",
    permission: "read_only",
    inputs: RetrieveMemoryArgsInput,
    async run(args: RetrieveMemoryArgs): Promise<ToolResult<OperationalMemory[]>> {
      const memories = await repo.query({
        scope: args.scope,
        entity: args.entity ?? undefined,
        type: args.type ?? undefined,
      });
      const evidence: EvidenceRef[] = memories.map((m) => ({
        id: `ev_mem_${m.id}`,
        kind: "approved_memory",
        sourceTool: "retrieve_memory",
        uri: null,
        snippet: snippet(m),
        confidence: m.confidence,
      }));
      return { ok: true, data: memories, evidence, error: null, costHint: { tokens: 0, latencyMs: 5, toolCost: 0.02 } };
    },
  };
}
