import { z } from "zod";

/** A concrete piece of support a Tool produced. Claim.evidencePointer holds an EvidenceRef.id. */
export const EvidenceRefSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "catalog", "supplier_quote", "stock", "prior_order",
    "approved_memory", "pricing_policy", "logistics", "user_provided",
  ]),
  sourceTool: z.string().nullable(),
  uri: z.string().nullable(),
  snippet: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const WorkflowDomainSchema = z.enum([
  "quote", "supplier_comparison", "invoice_exception", "hr_policy", "customer_support",
]);
export type WorkflowDomain = z.infer<typeof WorkflowDomainSchema>;

export const ToolNameSchema = z.enum([
  "retrieve_memory", "lookup_catalog", "check_stock",
  "parse_supplier_quote", "compare_quote", "draft_quote",
]);
export type ToolName = z.infer<typeof ToolNameSchema>;

export const VerifierNameSchema = z.enum([
  "schema", "numeric_reconciliation", "evidence_coverage",
  "policy", "hallucinated_tool", "missing_info",
]);
export type VerifierName = z.infer<typeof VerifierNameSchema>;

export const RiskClassSchema = z.enum(["L0", "L1", "L2", "L3", "L4"]);
export type RiskClass = z.infer<typeof RiskClassSchema>;

export const ClaimCategorySchema = z.enum([
  "price", "discount", "delivery", "customerPreference", "supplierComparison",
]);
export type ClaimCategory = z.infer<typeof ClaimCategorySchema>;

export const EvidenceRequirementSchema = z.enum([
  "catalog_or_supplier_quote", "pricing_policy", "stock_or_logistics_source",
  "approved_memory_or_prior_order", "uploaded_supplier_quote",
]);
export type EvidenceRequirement = z.infer<typeof EvidenceRequirementSchema>;

export const OperationalMemoryTypeSchema = z.enum([
  "CustomerPreference", "WorkflowFailurePatch", "PolicyException", "EvidenceSource", "VerifierFinding",
]);
export type OperationalMemoryType = z.infer<typeof OperationalMemoryTypeSchema>;
