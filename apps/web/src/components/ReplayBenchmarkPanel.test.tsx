import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ReplayBenchmarkPanel } from "./ReplayBenchmarkPanel";
import type { PromotionDecision, PromotionReport } from "@clarityloop/core";

const report: PromotionReport = {
  fromVersion: "v1",
  toVersion: "v2",
  caseCount: 4,
  baseline: {
    safeCompletionRate: 0.25,
    falseCommitRate: 0.25,
    policyViolationRate: 0,
    approvalBurden: 0.5,
    evidenceCoverage: 0.75,
    costPerSafeCompletion: 800,
    latencyPerSafeCompletion: 400,
    memoryBloatRate: 0,
  },
  candidate: {
    safeCompletionRate: 1,
    falseCommitRate: 0,
    policyViolationRate: 0,
    approvalBurden: 0,
    evidenceCoverage: 1,
    costPerSafeCompletion: 500,
    latencyPerSafeCompletion: 250,
    memoryBloatRate: 0,
  },
};

const promote: PromotionDecision = { type: "promote", fromVersion: "v1", toVersion: "v2", report };

describe("ReplayBenchmarkPanel (jsdom, no network)", () => {
  it("renders the version header, every metric row, and the promote decision", () => {
    render(<ReplayBenchmarkPanel report={report} decision={promote} />);

    expect(screen.getByText(/v1 → v2 · 4 cases/)).toBeInTheDocument();

    // Safe-completion row: baseline 0.25, candidate 1, signed delta +0.75 with the "better" tone.
    const safeRow = screen.getByText("Safe completion").closest("tr")!;
    const safeCells = within(safeRow).getAllByRole("cell");
    expect(safeCells[1]).toHaveTextContent("0.25");
    expect(safeCells[2]).toHaveTextContent("1");
    expect(safeCells[3]).toHaveTextContent("+0.75");
    expect(safeCells[3].className).toContain("text-go");

    // False-commit improving (lower) shows a negative delta in the "better" tone.
    const fcRow = screen.getByText("False commit").closest("tr")!;
    const fcDelta = within(fcRow).getAllByRole("cell")[3];
    expect(fcDelta).toHaveTextContent("-0.25");
    expect(fcDelta.className).toContain("text-go");

    const footer = screen.getByText("promote");
    expect(footer.className).toContain("v-go");
  });

  it("tones a reject decision in the stop signal", () => {
    render(
      <ReplayBenchmarkPanel
        report={report}
        decision={{ type: "reject", reason: "regressed", regressionReport: { fromVersion: "v1", toVersion: "v2", regressions: [] } }}
      />,
    );
    const tag = screen.getByText("reject");
    expect(tag.className).toContain("v-stop");
  });
});
