import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore, InMemoryMemoryRepository } from "@clarityloop/storage";
import type { ModelProvider } from "@clarityloop/qwen";
import { createToolRegistry } from "./registry";

const fakeProvider: ModelProvider = { async complete() { return "{}"; } };

describe("createToolRegistry", () => {
  it("wires all six tools keyed by ToolName", () => {
    const reg = createToolRegistry({
      memory: new InMemoryMemoryRepository(),
      provider: fakeProvider,
      store: new InMemoryArtifactStore(),
    });
    expect(Object.keys(reg).sort()).toEqual([
      "check_stock",
      "compare_quote",
      "draft_quote",
      "lookup_catalog",
      "parse_supplier_quote",
      "retrieve_memory",
    ]);
    expect(reg.lookup_catalog.permission).toBe("read_only");
    expect(reg.draft_quote.permission).toBe("draft");
    expect(reg.retrieve_memory.name).toBe("retrieve_memory");
  });
});
