import { z } from "zod";

export const FactSchema = z.object({
  id: z.string(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
});

export const MissingFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  necessity: z.enum(["required", "optional"]),
});

export const ClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  // null = unsupported. A string = an evidence reference id.
  evidencePointer: z.string().nullable(),
});

export const RiskFlagSchema = z.object({
  id: z.string(),
  kind: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});

export const PolicyFlagSchema = z.object({
  id: z.string(),
  rule: z.string(),
  ambiguous: z.boolean(),
});

export const LatentWorkflowStateSchema = z.object({
  goal: z.string(),
  workflowVersion: z.string(),
  knownFacts: z.array(FactSchema),
  missingFields: z.array(MissingFieldSchema),
  claims: z.array(ClaimSchema),
  riskFlags: z.array(RiskFlagSchema),
  policyFlags: z.array(PolicyFlagSchema),
  staleMemoryRefs: z.array(z.string()),
  toolFailures: z.array(z.string()),
});
