import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreeColumnDemo } from "./ThreeColumnDemo";
import type { DemoViewModel } from "./demoViewModel";

const vm: DemoViewModel = {
  baseline: { title: "Baseline (Harness Evolution)", subtitle: "no governance", rows: [{ label: "False commit rate", value: "33.0%" }] },
  clarityloop: { title: "ClarityLoop", subtitle: "evidence loop + gate", rows: [{ label: "False commit rate", value: "0.0%" }] },
  promotion: { title: "Promotion benchmark", subtitle: "v1 → v2", rows: [{ label: "Cases replayed", value: "36" }] },
};

describe("ThreeColumnDemo", () => {
  it("renders all three column titles", () => {
    const html = renderToStaticMarkup(<ThreeColumnDemo viewModel={vm} />);
    expect(html).toContain("Baseline (Harness Evolution)");
    expect(html).toContain("ClarityLoop");
    expect(html).toContain("Promotion benchmark");
  });

  it("renders a metric row label and value", () => {
    const html = renderToStaticMarkup(<ThreeColumnDemo viewModel={vm} />);
    expect(html).toContain("False commit rate");
    expect(html).toContain("33.0%");
  });
});
