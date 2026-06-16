import { z } from "zod";
import { RiskClassSchema } from "./primitives";
import { ToolPermissionSchema } from "./workflow";

export const AuthorityBoundarySchema = z.object({
  autoCommitMaxRiskClass: RiskClassSchema,
  approvalRequiredFor: z.array(z.enum([
    "external_send", "high_value_quote", "discount_above_threshold", "legal_sensitive",
    "workflow_promotion", "new_tool_permission", "policy_exception", "memory_policy_change",
  ])),
  forbiddenActions: z.array(z.string()),
  allowedTools: z.array(ToolPermissionSchema),
});
export type AuthorityBoundary = z.infer<typeof AuthorityBoundarySchema>;
