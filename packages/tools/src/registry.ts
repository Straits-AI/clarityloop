import type { ToolName } from "@clarityloop/core";
import type { ModelProvider } from "@clarityloop/qwen";
import type { ArtifactStore, MemoryRepository } from "@clarityloop/storage";
import type { Tool } from "./tool";
import { makeRetrieveMemoryTool } from "./retrieve-memory";
import { makeLookupCatalogTool } from "./lookup-catalog";
import { makeCheckStockTool } from "./check-stock";
import { makeParseSupplierQuoteTool } from "./parse-supplier-quote";
import { makeCompareQuoteTool } from "./compare-quote";
import { makeDraftQuoteTool } from "./draft-quote";

/** All six tools keyed by their ToolName. The loop controller looks tools up by action type. */
export type ToolRegistry = Record<ToolName, Tool<any, any>>;

export type ToolRegistryDeps = {
  memory: MemoryRepository;
  provider: ModelProvider;
  store: ArtifactStore;
};

export function createToolRegistry(deps: ToolRegistryDeps): ToolRegistry {
  return {
    retrieve_memory: makeRetrieveMemoryTool(deps.memory),
    lookup_catalog: makeLookupCatalogTool(),
    check_stock: makeCheckStockTool(),
    parse_supplier_quote: makeParseSupplierQuoteTool({ provider: deps.provider, store: deps.store }),
    compare_quote: makeCompareQuoteTool(),
    draft_quote: makeDraftQuoteTool(deps.store),
  };
}
