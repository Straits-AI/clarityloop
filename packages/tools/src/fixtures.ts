import type { OperationalMemory } from "@clarityloop/core";
import type { MemoryRepository } from "@clarityloop/storage";

export type CatalogEntry = { sku: string; name: string; unitPrice: number; currency: string };
export const SEED_CATALOG: CatalogEntry[] = [
  { sku: "CTN-COFFEE-1KG", name: "Coffee Cartons 1kg", unitPrice: 42.5, currency: "MYR" },
  { sku: "CTN-TEA-500G", name: "Tea Cartons 500g", unitPrice: 18.0, currency: "MYR" },
];

export type StockEntry = { sku: string; available: number; leadTimeDays: number };
export const SEED_STOCK: StockEntry[] = [
  { sku: "CTN-COFFEE-1KG", available: 500, leadTimeDays: 3 },
  { sku: "CTN-TEA-500G", available: 40, leadTimeDays: 10 },
];

/** Prior-order knowledge is stored as approved operational memory (memo §16). */
export const SEED_MEMORIES: OperationalMemory[] = [
  {
    type: "CustomerPreference",
    entity: "Customer ABC",
    fact: "Reorders CTN-COFFEE-1KG, 120 cartons, prefers delivery before Thursday noon",
    id: "mem_abc_pref",
    scope: "quote_workflows",
    source: "approved_quote_2026_05_02",
    confidence: 0.86,
    ttlDays: 180,
    createdAt: "2026-05-02T00:00:00Z",
    lastUsedAt: null,
    value: 0.31,
  },
  {
    type: "EvidenceSource",
    claimCategory: "price",
    sourceTool: "lookup_catalog",
    id: "mem_price_src",
    scope: "quote_workflows",
    source: "trace_seed",
    confidence: 0.9,
    ttlDays: 90,
    createdAt: "2026-05-02T00:00:00Z",
    lastUsedAt: null,
    value: 0.2,
  },
];

export async function seedMemoryRepository(repo: MemoryRepository): Promise<void> {
  for (const mem of SEED_MEMORIES) await repo.put(mem);
}
