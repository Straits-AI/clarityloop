import { describe, it, expect } from "vitest";
import { InMemoryArtifactStore } from "./artifact-store";

describe("ArtifactStore (in-memory)", () => {
  it("round-trips a stored artifact by key", async () => {
    const store = new InMemoryArtifactStore();
    await store.put("traces/t1.json", JSON.stringify({ ok: true }));
    const got = await store.get("traces/t1.json");
    expect(JSON.parse(got!)).toEqual({ ok: true });
  });

  it("returns null for a missing key", async () => {
    const store = new InMemoryArtifactStore();
    expect(await store.get("nope")).toBeNull();
  });
});
