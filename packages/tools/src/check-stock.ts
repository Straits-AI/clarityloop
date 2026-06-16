import { z } from "zod";
import type { EvidenceRef } from "@clarityloop/core";
import type { Tool, ToolResult } from "./tool";
import { SEED_STOCK, type StockEntry } from "./fixtures";

export const CheckStockArgsSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().positive(),
});
export type CheckStockArgs = z.infer<typeof CheckStockArgsSchema>;

export type StockResult = { available: boolean; leadTimeDays: number; onHand: number };

export function makeCheckStockTool(stock: StockEntry[] = SEED_STOCK): Tool<CheckStockArgs, StockResult> {
  return {
    name: "check_stock",
    description: "Check availability and lead time for a SKU + quantity.",
    permission: "read_only",
    inputs: CheckStockArgsSchema,
    async run(args: CheckStockArgs): Promise<ToolResult<StockResult>> {
      const entry = stock.find((s) => s.sku === args.sku);
      if (!entry) {
        return {
          ok: false,
          data: null,
          evidence: [],
          error: `no stock record for ${args.sku}`,
          costHint: { tokens: 0, latencyMs: 6, toolCost: 0.03 },
        };
      }
      const available = entry.available >= args.quantity;
      const evidence: EvidenceRef[] = [
        {
          id: `ev_stock_${entry.sku}`,
          kind: "stock",
          sourceTool: "check_stock",
          uri: null,
          snippet: `${entry.sku}: ${entry.available} on hand, lead ${entry.leadTimeDays}d`,
          confidence: 0.9,
        },
      ];
      return {
        ok: true,
        data: { available, leadTimeDays: entry.leadTimeDays, onHand: entry.available },
        evidence,
        error: null,
        costHint: { tokens: 0, latencyMs: 6, toolCost: 0.03 },
      };
    },
  };
}
