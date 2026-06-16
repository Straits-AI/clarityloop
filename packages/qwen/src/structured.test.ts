import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generateStructured } from "./structured";
import type { ModelProvider } from "./provider";

const fakeProvider = (reply: string): ModelProvider => ({
  async complete() { return reply; },
});

const Schema = z.object({ sku: z.string(), qty: z.number() });

describe("generateStructured", () => {
  it("parses fenced JSON from the model reply", async () => {
    const provider = fakeProvider("```json\n{\"sku\":\"A1\",\"qty\":120}\n```");
    const out = await generateStructured(provider, Schema, {
      task: "extraction", messages: [{ role: "user", content: "x" }],
    });
    expect(out).toEqual({ sku: "A1", qty: 120 });
  });

  it("throws on output that fails schema validation", async () => {
    const provider = fakeProvider("{\"sku\":\"A1\"}");
    await expect(
      generateStructured(provider, Schema, { task: "extraction", messages: [] })
    ).rejects.toThrow();
  });
});
