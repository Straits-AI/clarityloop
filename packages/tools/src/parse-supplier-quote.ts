import { z } from "zod";
import type { EvidenceRef } from "@clarityloop/core";
import { generateStructured, type ModelProvider } from "@clarityloop/qwen";
import type { ArtifactStore } from "@clarityloop/storage";
import type { Tool, ToolResult } from "./tool";

export const SupplierQuoteSchema = z.object({
  lineItems: z.array(
    z.object({
      sku: z.string(),
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
    }),
  ),
  total: z.number(),
  currency: z.string(),
});
export type SupplierQuote = z.infer<typeof SupplierQuoteSchema>;

export const ParseSupplierQuoteArgsSchema = z.object({ artifactKey: z.string() });
export type ParseSupplierQuoteArgs = z.infer<typeof ParseSupplierQuoteArgsSchema>;

export type ParseSupplierQuoteDeps = { provider: ModelProvider; store: ArtifactStore };

export function makeParseSupplierQuoteTool(deps: ParseSupplierQuoteDeps): Tool<ParseSupplierQuoteArgs, SupplierQuote> {
  return {
    name: "parse_supplier_quote",
    description: "Extract structured line items/total from an uploaded supplier quote (Qwen-VL/text).",
    permission: "read_only",
    inputs: ParseSupplierQuoteArgsSchema,
    async run(args: ParseSupplierQuoteArgs): Promise<ToolResult<SupplierQuote>> {
      const raw = await deps.store.get(args.artifactKey);
      if (raw === null) {
        return {
          ok: false,
          data: null,
          evidence: [],
          error: `artifact not found: ${args.artifactKey}`,
          costHint: { tokens: 0, latencyMs: 10, toolCost: 0.05 },
        };
      }
      try {
        const quote = await generateStructured(deps.provider, SupplierQuoteSchema, {
          task: "document_parse",
          messages: [
            {
              role: "system",
              content: "Extract the supplier quote as JSON with lineItems[], total, currency. Return JSON only.",
            },
            { role: "user", content: raw },
          ],
        });
        const evidence: EvidenceRef[] = [
          {
            id: `ev_supquote_${args.artifactKey}`,
            kind: "supplier_quote",
            sourceTool: "parse_supplier_quote",
            uri: args.artifactKey,
            snippet: `supplier total ${quote.total} ${quote.currency} across ${quote.lineItems.length} line(s)`,
            confidence: 0.8,
          },
        ];
        return { ok: true, data: quote, evidence, error: null, costHint: { tokens: 800, latencyMs: 60, toolCost: 0.05 } };
      } catch (e) {
        return {
          ok: false,
          data: null,
          evidence: [],
          error: `parse failed: ${(e as Error).message}`,
          costHint: { tokens: 400, latencyMs: 40, toolCost: 0.05 },
        };
      }
    },
  };
}
