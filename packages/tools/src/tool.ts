import type { z } from "zod";
import type { EvidenceRef, ToolName, ToolPermissionLevel } from "@clarityloop/core";

export interface ToolResult<Data = unknown> {
  ok: boolean;
  data: Data | null;
  evidence: EvidenceRef[]; // support this call produced
  error: string | null;
  costHint: { tokens: number; latencyMs: number; toolCost: number }; // feeds CandidateAction costs
}

export interface Tool<Args = Record<string, unknown>, Data = unknown> {
  name: ToolName;
  description: string;
  permission: ToolPermissionLevel;
  inputs: z.ZodType<Args>; // zod schema for args (validated before run)
  run(args: Args): Promise<ToolResult<Data>>;
}
