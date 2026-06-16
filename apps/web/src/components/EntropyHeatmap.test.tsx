import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntropyHeatmap } from "./EntropyHeatmap";
import type { EntropyScore } from "@clarityloop/core";

const entropy: EntropyScore = {
  taskEntropy: 1, evidenceEntropy: 0.875, actionEntropy: 0.9,
  policyEntropy: 1, memoryEntropy: 0, commitEntropy: 0.82,
};

describe("EntropyHeatmap", () => {
  it("renders the commit entropy and all six component cells", () => {
    render(<EntropyHeatmap entropy={entropy} history={[0.82, 0.44, 0.18]} />);
    expect(screen.getByTestId("heatmap-commit").textContent).toBe("0.82");
    for (const key of [
      "taskEntropy", "evidenceEntropy", "actionEntropy",
      "policyEntropy", "memoryEntropy", "commitEntropy",
    ]) {
      expect(screen.getByTestId(`cell-${key}`)).toBeInTheDocument();
    }
    expect(screen.getByText("Evidence")).toBeInTheDocument();
    expect(screen.getByTestId("heatmap-history").children.length).toBe(3);
  });

  it("colors a high-entropy cell differently from a zero-entropy cell", () => {
    render(<EntropyHeatmap entropy={entropy} history={[]} />);
    const high = screen.getByTestId("cell-policyEntropy").style.backgroundColor; // value 1
    const low = screen.getByTestId("cell-memoryEntropy").style.backgroundColor;  // value 0
    expect(high).not.toBe(low);
  });
});
