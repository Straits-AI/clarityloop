import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url)); // packages/evals/src -> repo root
const read = (rel: string) => readFile(join(REPO_ROOT, rel), "utf8");

describe("submission docs", () => {
  it("architecture.md contains a mermaid diagram with the core nodes", async () => {
    const md = await read("docs/architecture.md");
    expect(md).toContain("```mermaid");
    expect(md).toContain("Entropy");
    expect(md).toContain("Commit Gate");
    expect(md).toContain("Promotion Gate");
  });

  it("DEVPOST.md covers the required submission sections", async () => {
    const md = await read("DEVPOST.md");
    for (const section of ["## Inspiration", "## What it does", "## How we built it", "## Qwen", "## Alibaba Cloud", "## ClarityLoopBench"]) {
      expect(md).toContain(section);
    }
  });

  it("demo-video-script.md is a timed 3-minute script", async () => {
    const md = await read("docs/demo-video-script.md");
    expect(md).toContain("0:00");
    expect(md).toContain("3:00");
    expect(md.toLowerCase()).toContain("entropy");
  });
});
