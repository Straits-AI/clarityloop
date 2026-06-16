import { z } from "zod";
import type { ArtifactStore } from "@clarityloop/storage";
import type { Tool, ToolResult } from "./tool";

export const DraftQuoteArgsSchema = z.object({
  customer: z.string(),
  lineItems: z.array(z.object({ sku: z.string(), quantity: z.number(), unitPrice: z.number() })),
  deliveryDate: z.string(),
});
export type DraftQuoteArgs = z.infer<typeof DraftQuoteArgsSchema>;

export type DraftQuoteResult = { artifactKey: string; total: number };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function makeDraftQuoteTool(store: ArtifactStore): Tool<DraftQuoteArgs, DraftQuoteResult> {
  return {
    name: "draft_quote",
    description: "Produce a draft quote artifact (internal draft — NOT an external send).",
    permission: "draft",
    inputs: DraftQuoteArgsSchema,
    async run(args: DraftQuoteArgs): Promise<ToolResult<DraftQuoteResult>> {
      const total = args.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
      const artifactKey = `quotes/${slug(args.customer)}.json`;
      const doc = JSON.stringify(
        { customer: args.customer, lineItems: args.lineItems, deliveryDate: args.deliveryDate, total },
        null,
        2,
      );
      await store.put(artifactKey, doc);
      return { ok: true, data: { artifactKey, total }, evidence: [], error: null, costHint: { tokens: 0, latencyMs: 12, toolCost: 0.03 } };
    },
  };
}
