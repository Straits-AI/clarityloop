import { describe, it, expect } from "vitest";
import { InMemoryMemoryRepository } from "@clarityloop/storage";
import { makeRetrieveMemoryTool, RetrieveMemoryArgsSchema } from "./retrieve-memory";
import { seedMemoryRepository } from "./fixtures";

describe("retrieve_memory tool", () => {
  it("returns scoped memories with approved_memory evidence", async () => {
    const repo = new InMemoryMemoryRepository();
    await seedMemoryRepository(repo);
    const tool = makeRetrieveMemoryTool(repo);
    expect(tool.name).toBe("retrieve_memory");
    expect(tool.permission).toBe("read_only");
    const res = await tool.run(RetrieveMemoryArgsSchema.parse({ scope: "quote_workflows", entity: "Customer ABC" }));
    expect(res.ok).toBe(true);
    expect(res.data?.[0].type).toBe("CustomerPreference");
    expect(res.evidence[0].kind).toBe("approved_memory");
    expect(res.evidence[0].sourceTool).toBe("retrieve_memory");
  });

  it("returns an ok empty result when nothing matches", async () => {
    const repo = new InMemoryMemoryRepository();
    await seedMemoryRepository(repo);
    const tool = makeRetrieveMemoryTool(repo);
    const res = await tool.run(RetrieveMemoryArgsSchema.parse({ scope: "no_such_scope" }));
    expect(res.ok).toBe(true);
    expect(res.data).toEqual([]);
    expect(res.evidence).toEqual([]);
  });
});
