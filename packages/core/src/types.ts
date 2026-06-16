import { z } from "zod";
import {
  FactSchema, MissingFieldSchema, ClaimSchema, RiskFlagSchema,
  PolicyFlagSchema, LatentWorkflowStateSchema,
} from "./schemas";

export type Fact = z.infer<typeof FactSchema>;
export type MissingField = z.infer<typeof MissingFieldSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type RiskFlag = z.infer<typeof RiskFlagSchema>;
export type PolicyFlag = z.infer<typeof PolicyFlagSchema>;
export type LatentWorkflowState = z.infer<typeof LatentWorkflowStateSchema>;

export type EntropyScore = {
  taskEntropy: number;
  evidenceEntropy: number;
  actionEntropy: number;
  policyEntropy: number;
  memoryEntropy: number;
  commitEntropy: number;
};
