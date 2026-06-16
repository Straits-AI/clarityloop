import { z } from "zod";
import type { EvidenceRef } from "@clarityloop/core";
import type { Tool, ToolResult } from "./tool";

export const CompareQuoteArgsSchema = z.object({
  supplier: z.object({
    lineItems: z.array(
      z.object({ sku: z.string(), description: z.string(), quantity: z.number(), unitPrice: z.number() }),
    ),
    total: z.number(),
    currency: z.string(),
  }),
  catalog: z.array(z.object({ sku: z.string(), unitPrice: z.number() })),
  maxDeltaPct: z.number().default(0.1),
});
export type CompareQuoteArgs = z.infer<typeof CompareQuoteArgsSchema>;
const CompareQuoteArgsInput = CompareQuoteArgsSchema as z.ZodType<CompareQuoteArgs>;

export type QuoteDelta = {
  sku: string;
  supplierUnitPrice: number;
  catalogUnitPrice: number | null;
  deltaPct: number | null;
};
export type CompareResult = { deltas: QuoteDelta[]; withinPolicy: boolean };

export function makeCompareQuoteTool(): Tool<CompareQuoteArgs, CompareResult> {
  return {
    name: "compare_quote",
    description: "Reconcile a supplier quote against current catalog prices.",
    permission: "draft",
    inputs: CompareQuoteArgsInput,
    async run(args: CompareQuoteArgs): Promise<ToolResult<CompareResult>> {
      const deltas: QuoteDelta[] = args.supplier.lineItems.map((li) => {
        const cat = args.catalog.find((c) => c.sku === li.sku);
        const catalogUnitPrice = cat ? cat.unitPrice : null;
        const deltaPct = cat ? (li.unitPrice - cat.unitPrice) / cat.unitPrice : null;
        return { sku: li.sku, supplierUnitPrice: li.unitPrice, catalogUnitPrice, deltaPct };
      });
      const withinPolicy = deltas.every((d) => d.deltaPct !== null && Math.abs(d.deltaPct) <= args.maxDeltaPct);
      const evidence: EvidenceRef[] = [
        {
          id: "ev_compare_quote",
          kind: "pricing_policy",
          sourceTool: "compare_quote",
          uri: null,
          snippet: withinPolicy
            ? "supplier prices within policy of catalog"
            : "supplier prices deviate from catalog beyond policy",
          confidence: 0.85,
        },
      ];
      return { ok: true, data: { deltas, withinPolicy }, evidence, error: null, costHint: { tokens: 0, latencyMs: 8, toolCost: 0.02 } };
    },
  };
}
