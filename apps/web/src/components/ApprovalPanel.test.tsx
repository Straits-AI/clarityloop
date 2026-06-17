import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApprovalPanel } from "./ApprovalPanel";
import type { CommitDecision } from "@clarityloop/core";

const needsApproval: CommitDecision = {
  type: "needs_approval",
  reason: "quote is high-value relative to policy",
  approvalPayload: {
    runId: "run_1",
    riskClass: "L3",
    reason: "quote is high-value relative to policy",
    summary: "Audit: approval required because the quote is high-value.",
    evidence: [],
    proposedArtifactId: "art_1",
    failedChecks: [],
  },
};

describe("ApprovalPanel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the decision view and resolves an approval via submitApproval (fake fetch, no network)", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: { body: string }) => ({
      ok: true,
      status: 200,
      json: async () => ({
        record: { id: "appr_run_1" },
        outcome: { type: "committed", runId: "run_1", traceId: "t1", artifactId: "art_1" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ApprovalPanel baseUrl="http://api.test" decision={needsApproval} traceId="t1" approver="manager@acme.com" />);

    // commitDecisionView output is rendered: title, risk-class line, and the Qwen audit summary.
    expect(screen.getByText("Approval required")).toBeInTheDocument();
    expect(screen.getByText(/Risk class: L3/)).toBeInTheDocument();
    expect(screen.getByText(/Audit:/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Approve"));

    // The outcome line updates once submitApproval resolves.
    await waitFor(() =>
      expect(screen.getByTestId("approval-outcome")).toHaveTextContent("Outcome: committed"),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/approvals/resolve");
    const body = JSON.parse(init.body);
    expect(body.decision).toBe("approved");
    expect(body.approver).toBe("manager@acme.com");
    expect(body.approvalPayload.runId).toBe("run_1");

    // After resolution the action buttons are gone.
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
  });

  it("submits a rejection and reflects the rejected outcome", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        record: { id: "appr_run_1" },
        outcome: { type: "rejected", runId: "run_1", traceId: "t1", failedChecks: [] },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ApprovalPanel baseUrl="http://api.test" decision={needsApproval} traceId="t1" approver="manager@acme.com" />);
    fireEvent.click(screen.getByText("Reject"));

    await waitFor(() =>
      expect(screen.getByTestId("approval-outcome")).toHaveTextContent("Outcome: rejected"),
    );
  });

  it("renders a non-approval decision with no action buttons", () => {
    render(<ApprovalPanel baseUrl="http://api.test" decision={{ type: "commit", reason: "all clear" }} traceId="t1" approver="x" />);
    expect(screen.getByText("Committed")).toBeInTheDocument();
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByTestId("approval-outcome")).not.toBeInTheDocument();
  });
});
