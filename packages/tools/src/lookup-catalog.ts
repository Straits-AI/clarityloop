import { z } from "zod";
import type { EvidenceRef } from "@clarityloop/core";
import type { Tool, ToolResult } from "./tool";
import { SEED_CATALOG, type CatalogEntry } from "./fixtures";

export const LookupCatalogArgsSchema = z.object({
  sku: z.string().nullable().default(null),
  query: z.string().nullable().default(null),
});
export type LookupCatalogArgs = z.infer<typeof LookupCatalogArgsSchema>;
const LookupCatalogArgsInput = LookupCatalogArgsSchema as z.ZodType<LookupCatalogArgs>;

export type CatalogResult = { sku: string; name: string; unitPrice: number; currency: string };

export function makeLookupCatalogTool(catalog: CatalogEntry[] = SEED_CATALOG): Tool<LookupCatalogArgs, CatalogResult> {
  return {
    name: "lookup_catalog",
    description: "Look up the current catalog price/spec for a SKU (by sku or fuzzy query).",
    permission: "read_only",
    inputs: LookupCatalogArgsInput,
    async run(args: LookupCatalogArgs): Promise<ToolResult<CatalogResult>> {
      const q = args.query?.toLowerCase() ?? null;
      const entry =
        (args.sku ? catalog.find((c) => c.sku === args.sku) : undefined) ??
        (q ? catalog.find((c) => c.name.toLowerCase().includes(q) || c.sku.toLowerCase().includes(q)) : undefined);
      if (!entry) {
        return {
          ok: false,
          data: null,
          evidence: [],
          error: `no catalog entry for ${args.sku ?? args.query ?? "<empty>"}`,
          costHint: { tokens: 0, latencyMs: 4, toolCost: 0.02 },
        };
      }
      const evidence: EvidenceRef[] = [
        {
          id: `ev_catalog_${entry.sku}`,
          kind: "catalog",
          sourceTool: "lookup_catalog",
          uri: null,
          snippet: `${entry.sku} ${entry.name} @ ${entry.unitPrice} ${entry.currency}`,
          confidence: 0.95,
        },
      ];
      return {
        ok: true,
        data: { sku: entry.sku, name: entry.name, unitPrice: entry.unitPrice, currency: entry.currency },
        evidence,
        error: null,
        costHint: { tokens: 0, latencyMs: 4, toolCost: 0.02 },
      };
    },
  };
}
